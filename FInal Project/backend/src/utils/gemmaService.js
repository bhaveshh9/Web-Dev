import ollama from 'ollama';

// ----------------------------------------------------------------------
// Settings (all optional, set in backend/.env)
//   OLLAMA_MODEL=gemma4:e4b      model name from `ollama list`
//   MAX_STUDY_CHARS=7000         how much of the PDF is sent to the model
//   OLLAMA_NUM_CTX=8192          context window
// ----------------------------------------------------------------------
const model = () => process.env.OLLAMA_MODEL || 'gemma4:e4b';
const MAX_CHARS = () => parseInt(process.env.MAX_STUDY_CHARS || '7000', 10);
const NUM_CTX = () => parseInt(process.env.OLLAMA_NUM_CTX || '8192', 10);

const MCQ_COUNT = 10;
const TF_COUNT = 5;
const MAX_ATTEMPTS = 3;

// Lets tests replace the Ollama client
let client = ollama;
export const setOllamaClient = (c) => { client = c; };

// ======================================================================
// Sending text to the model
// ======================================================================
/** Evenly spread slices (start / middle / end) so the whole PDF is represented. */
export function excerpt(text, limit = MAX_CHARS()) {
  text = text.trim();
  if (text.length <= limit) return text;
  const part = Math.floor(limit / 3);
  const mid = Math.floor(text.length / 2);
  return [
    text.slice(0, part),
    text.slice(mid - Math.floor(part / 2), mid + Math.floor(part / 2)),
    text.slice(-part),
  ].join(' ');
}

const QUESTIONS_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          text: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          answer: { type: 'integer' },
        },
        required: ['topic', 'text', 'options', 'answer'],
      },
    },
  },
  required: ['questions'],
};

/**
 * Call Ollama. Tries the strictest settings first (JSON schema + thinking off) and
 * quietly falls back if the installed Ollama doesn't support them.
 */
async function chat(prompt, { schema = null, numPredict = 3072 } = {}) {
  const base = {
    model: model(),
    messages: [{ role: 'user', content: prompt }],
    stream: false,
    options: { num_ctx: NUM_CTX(), num_predict: numPredict, temperature: 0.3 },
  };

  const variants = [];
  if (schema) {
    variants.push({ format: schema, think: false });
    variants.push({ format: schema });
  }
  variants.push({ think: false });
  variants.push({});

  let response = null;
  let lastError = null;
  for (const extra of variants) {
    try {
      response = await client.chat({ ...base, ...extra });
      break;
    } catch (e) {
      lastError = e;
      // only fall back when the server rejected an option (400); anything else
      // (Ollama not running, model not found...) is a real error.
      const status = e && (e.status_code ?? e.status);
      if (status !== 400 && !(e instanceof TypeError)) throw e;
    }
  }
  if (!response) throw lastError;

  const content = (response.message && response.message.content) || '';
  console.log('-'.repeat(50));
  console.log(`RAW MODEL REPLY (${model()}, ${content.length} chars, done_reason=${response.done_reason}):`);
  console.log(content.slice(0, 500) + (content.length > 500 ? ' ...' : ''));
  console.log('-'.repeat(50));
  return content;
}

// ======================================================================
// Reading the model's reply (this is the JSON-repair part)
// ======================================================================
export function stripFences(text) {
  return String(text || '').trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim();
}

/** End index of the {...} object that starts at `start`, or -1 if it never closes (truncated). */
function matchingBrace(text, start) {
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i;
  }
  return -1;
}

/**
 * Every COMPLETE {...} object found in text, even when the text is cut off or has junk
 * around it. This rescues finished questions from a truncated reply.
 */
export function completeObjects(text) {
  const found = [];
  let i = 0;
  while (true) {
    i = text.indexOf('{', i);
    if (i === -1) break;
    const end = matchingBrace(text, i);
    if (end !== -1) {
      try {
        found.push(JSON.parse(text.slice(i, end + 1)));
        i = end + 1;
        continue;
      } catch (e) { /* not valid JSON: look inside it */ }
    }
    i += 1;
  }
  return found;
}

/** Reply -> list of objects that look like questions (whole-JSON first, repair second). */
export function rawQuestionDicts(raw) {
  const text = stripFences(raw);
  const isObj = (d) => d && typeof d === 'object' && !Array.isArray(d);

  // 1) the reply is perfectly valid JSON
  try {
    let data = JSON.parse(text);
    if (isObj(data)) data = Array.isArray(data.questions) ? data.questions : [data];
    if (Array.isArray(data)) return data.filter(isObj);
  } catch (e) { /* fall through */ }

  // 2) damaged / truncated: keep every complete object
  return completeObjects(text).filter((d) => 'options' in d || 'text' in d || 'question' in d);
}

function toIndex(answer, nOptions) {
  if (typeof answer === 'boolean') return answer ? 0 : 1;
  if (typeof answer === 'string') {
    const a = answer.trim().toUpperCase();
    if (a === 'TRUE' || a === 'T') return 0;
    if (a === 'FALSE' || a === 'F') return 1;
    if (a.length === 1 && 'ABCD'.includes(a)) return a.charCodeAt(0) - 65;
    answer = a;
  }
  const n = Number.parseInt(answer, 10);
  return Number.isInteger(n) && n >= 0 && n < nOptions ? n : null;
}

/** Validate / normalise one question. Returns null if it is unusable. */
export function cleanQuestion(d, kind) {
  const text = String(d.text || d.question || '').trim();
  if (!text) return null;

  let options;
  if (kind === 'tf') {
    options = ['True', 'False'];
  } else {
    options = (Array.isArray(d.options) ? d.options : []).map((o) => String(o).trim()).filter(Boolean);
    if (options.length !== 4) return null;
  }

  const answer = toIndex(d.answer, options.length);
  if (answer === null) return null;

  const q = { topic: String(d.topic || 'General').trim() || 'General', text, options, answer };
  if (d.explanation) q.explanation = String(d.explanation).trim();
  return q;
}

// ======================================================================
// Generate Exam Questions
// ======================================================================
const RULES = `
IMPORTANT RULES

- Every question MUST be based ONLY on the study material.
- Do NOT generate duplicate questions.
- Mix easy, medium, and hard questions.
- Keep every question and every option short (under 25 words).
- Every question MUST contain: "topic", "text", "options", "answer".
- NEVER omit the "answer" field.
- No explanations. No markdown. No headings. No code blocks. No LaTeX.
- Return ONE JSON OBJECT only, exactly in the structure shown below.
`;

const MCQ_PROMPT = `
You are an expert teacher.

Generate EXACTLY __COUNT__ Multiple Choice Questions (MCQs) from the study material.

- Exactly 4 options per question.
- "answer" is the index of the correct option and must be 0, 1, 2, or 3.
${RULES}
Return exactly this structure:

{"questions":[{"topic":"Operating System","text":"Question","options":["A","B","C","D"],"answer":2}]}

Study Material:

__TEXT__
`;

const TF_PROMPT = `
You are an expert teacher.

Generate EXACTLY __COUNT__ True/False questions from the study material.

- Options MUST be exactly: ["True", "False"]
- "answer" must be 0 for True or 1 for False.
- Roughly half should be True and half False.
${RULES}
Return exactly this structure:

{"questions":[{"topic":"Operating System","text":"True or False Question","options":["True","False"],"answer":1}]}

Study Material:

__TEXT__
`;

async function generateBatch(material, kind, count, seen) {
  const template = kind === 'mcq' ? MCQ_PROMPT : TF_PROMPT;
  // split/join instead of replace(): the study text may contain "$&" and similar
  const prompt = template.split('__COUNT__').join(String(count)).split('__TEXT__').join(material);

  let best = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let raw;
    try {
      raw = await chat(prompt, { schema: QUESTIONS_SCHEMA });
    } catch (e) {
      console.log(`[${kind}] attempt ${attempt} failed:`, e.message);
      if (attempt === 1 && /ECONNREFUSED|fetch failed|not found/i.test(String(e.message) + String(e.cause))) throw e;
      continue;
    }

    const items = [];
    const local = new Set();
    for (const d of rawQuestionDicts(raw)) {
      const q = cleanQuestion(d, kind);
      const key = q && q.text.toLowerCase();
      if (q && !seen.has(key) && !local.has(key)) {
        items.push(q);
        local.add(key);
      }
    }

    console.log(`[${kind}] attempt ${attempt}: ${items.length}/${count} valid questions`);
    if (items.length > best.length) best = items;
    if (best.length >= count) break;
  }

  best = best.slice(0, count);
  best.forEach((q) => seen.add(q.text.toLowerCase()));
  return best;
}

/**
 * Returns an array of question objects.
 * 10 MCQs + 5 True/False, generated in two small requests so replies never get cut off.
 */
export async function generateQuestions(text) {
  const material = excerpt(text);
  const seen = new Set();

  const mcqs = await generateBatch(material, 'mcq', MCQ_COUNT, seen);
  const tfs = await generateBatch(material, 'tf', TF_COUNT, seen);

  const questions = [...mcqs, ...tfs];
  if (!questions.length) throw new Error('The model did not return any valid questions.');

  console.log(`Generated ${mcqs.length} MCQs + ${tfs.length} True/False = ${questions.length} questions`);
  return questions;
}

// ==========================================================================
// Generate AI Feedback
// ==========================================================================
export async function generateFeedback({
  chapter, totalQuestions, correctAnswers, percentage, grade, correctTopics, weakTopics,
}) {
  const total_questions = totalQuestions;
  const correct_answers = correctAnswers;
  const correct_topics = correctTopics;
  const weak_topics = weakTopics;

  const prompt = `
You are an expert AI tutor.

A student has completed an exam.

Chapter:
${chapter}

Exam Summary:
- Total Questions: ${total_questions}
- Correct Answers: ${correct_answers}
- Score: ${percentage}%
- Grade: ${grade}

Decision Rules:

1. If the student's score is LESS THAN 70%:
- Focus on revision.
- Give constructive feedback.
- recommended_topics should contain exactly 3 topics to revise.
- youtube_videos should contain exactly 3 YouTube search suggestions.
- Do NOT generate YouTube URLs.

2. If the student's score is 70% OR HIGHER:
- Congratulate the student.
- recommended_topics should contain exactly 3 next topics to learn.
- youtube_videos must be an empty array [].

Topics answered correctly:
${correct_topics.length ? correct_topics.join(', ') : 'None'}

Topics answered incorrectly:
${weak_topics.length ? weak_topics.join(', ') : 'None'}

Generate ONLY valid JSON.

Rules:
- No markdown.
- No code blocks.
- No explanation outside JSON.
- Keep feedback under 70 words.
- Give exactly 3 strengths.
- Give exactly 3 weak topics.
- Give exactly 3 recommended topics.
- If score < 70%, return exactly 3 youtube_videos.
- If score >= 70%, youtube_videos must be [].
- Never generate YouTube URLs.
- Only generate search queries.

Return ONLY this JSON:

{
  "feedback":"...",

  "strengths":[
    "...",
    "...",
    "..."
  ],

  "weak_topics":[
    "...",
    "...",
    "..."
  ],

  "recommended_topics":[
    "...",
    "...",
    "..."
  ],

  "youtube_videos":[
    {
      "title":"...",
      "search_query":"..."
    },
    {
      "title":"...",
      "search_query":"..."
    },
    {
      "title":"...",
      "search_query":"..."
    }
  ]
}
`;

  try {
    const raw = await chat(prompt, { numPredict: 1500 });
    const text = stripFences(raw);
    let data = null;
    try {
      data = JSON.parse(text);
    } catch (e) {
      const start = text.indexOf('{'), end = text.lastIndexOf('}');
      if (start !== -1 && end > start) data = JSON.parse(text.slice(start, end + 1));
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('feedback is not a JSON object');

    // make sure the page always gets the lists it expects
    for (const key of ['strengths', 'weak_topics', 'recommended_topics', 'youtube_videos']) {
      if (!Array.isArray(data[key])) data[key] = [];
    }
    data.feedback = String(data.feedback || 'Good effort. Keep practising!');
    return data;
  } catch (e) {
    console.log('Feedback generation failed:', e.message);
    const uniq = (xs) => [...new Set(xs)];
    return {
      feedback: `You scored ${percentage}% (Grade ${grade}). Review your weak topics and try again.`,
      strengths: uniq(correctTopics).slice(0, 3),
      weak_topics: uniq(weakTopics).slice(0, 3),
      recommended_topics: uniq(weakTopics).slice(0, 3),
      youtube_videos: percentage < 70
        ? uniq(weakTopics).slice(0, 3).map((t) => ({ title: `${t} — explained`, search_query: `${t} explained for students` }))
        : [],
    };
  }
}
