import json
import os
import re

import ollama

# ----------------------------------------------------------------------
# Settings (all optional, set in backend/.env)
#   OLLAMA_MODEL=gemma4:e4b      model name from `ollama list`
#   MAX_STUDY_CHARS=7000         how much of the PDF is sent to the model
#   OLLAMA_NUM_CTX=8192          context window
# ----------------------------------------------------------------------
def _model():
    return os.getenv("OLLAMA_MODEL", "gemma4:e4b")


MAX_CHARS = int(os.getenv("MAX_STUDY_CHARS", "7000"))
NUM_CTX = int(os.getenv("OLLAMA_NUM_CTX", "8192"))

MCQ_COUNT = 10
TF_COUNT = 5
MAX_ATTEMPTS = 3


# ======================================================================
# Sending text to the model
# ======================================================================
def _excerpt(text, limit=MAX_CHARS):
    """Evenly spread slices (start / middle / end) so the whole PDF is represented."""
    text = text.strip()
    if len(text) <= limit:
        return text
    part = limit // 3
    mid = len(text) // 2
    return " ".join([
        text[:part],
        text[mid - part // 2: mid + part // 2],
        text[-part:],
    ])


QUESTIONS_SCHEMA = {
    "type": "object",
    "properties": {
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "topic": {"type": "string"},
                    "text": {"type": "string"},
                    "options": {"type": "array", "items": {"type": "string"}},
                    "answer": {"type": "integer"},
                },
                "required": ["topic", "text", "options", "answer"],
            },
        }
    },
    "required": ["questions"],
}


def _chat(prompt, schema=None, num_predict=3072):
    """
    Call Ollama. Tries the strictest settings first (JSON schema + thinking off) and
    quietly falls back if the installed Ollama / python client doesn't support them.
    """
    base = dict(
        model=_model(),
        messages=[{"role": "user", "content": prompt}],
        options={"num_ctx": NUM_CTX, "num_predict": num_predict, "temperature": 0.3},
    )

    variants = []
    if schema:
        variants.append({"format": schema, "think": False})
        variants.append({"format": schema})
    variants.append({"think": False})
    variants.append({})

    response, last_error = None, None
    for extra in variants:
        try:
            response = ollama.chat(**base, **extra)
            break
        except (TypeError, ollama.ResponseError) as e:
            last_error = e
            continue

    if response is None:
        raise last_error

    content = response["message"]["content"] or ""
    reason = getattr(response, "done_reason", None)

    print("-" * 50)
    print(f"RAW MODEL REPLY ({_model()}, {len(content)} chars, done_reason={reason}):")
    print(content[:500] + (" ..." if len(content) > 500 else ""))
    print("-" * 50)
    return content


# ======================================================================
# Reading the model's reply (this is the JSON-repair part)
# ======================================================================
def _strip_fences(text):
    text = (text or "").strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _complete_objects(text):
    """
    Return every COMPLETE {...} object found in text, even when the text is cut off
    or has junk around it. This rescues finished questions from a truncated reply.
    """
    decoder = json.JSONDecoder()
    found, i = [], 0
    while True:
        i = text.find("{", i)
        if i == -1:
            break
        try:
            obj, end = decoder.raw_decode(text, i)
            found.append(obj)
            i = end
        except json.JSONDecodeError:
            i += 1
    return found


def _raw_question_dicts(raw):
    """Reply -> list of dicts that look like questions (whole-JSON first, repair second)."""
    text = _strip_fences(raw)

    # 1) the reply is perfectly valid JSON
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            data = data.get("questions", [data])
        if isinstance(data, list):
            return [d for d in data if isinstance(d, dict)]
    except json.JSONDecodeError:
        pass

    # 2) the reply is damaged / truncated: keep every complete object
    return [d for d in _complete_objects(text) if "options" in d or "text" in d or "question" in d]


def _to_index(answer, n_options):
    if isinstance(answer, bool):
        return 0 if answer else 1
    if isinstance(answer, str):
        a = answer.strip().upper()
        if a in ("TRUE", "T"):
            return 0
        if a in ("FALSE", "F"):
            return 1
        if len(a) == 1 and a in "ABCD":
            return ord(a) - 65
        try:
            answer = int(a)
        except ValueError:
            return None
    try:
        answer = int(answer)
    except (TypeError, ValueError):
        return None
    return answer if 0 <= answer < n_options else None


def _clean_question(d, kind):
    """Validate/normalise one question. Returns None if it is unusable."""
    text = str(d.get("text") or d.get("question") or "").strip()
    if not text:
        return None

    if kind == "tf":
        options = ["True", "False"]
    else:
        options = [str(o).strip() for o in (d.get("options") or []) if str(o).strip()]
        if len(options) != 4:
            return None

    answer = _to_index(d.get("answer"), len(options))
    if answer is None:
        return None

    q = {
        "topic": str(d.get("topic") or "General").strip() or "General",
        "text": text,
        "options": options,
        "answer": answer,
    }
    if d.get("explanation"):
        q["explanation"] = str(d["explanation"]).strip()
    return q


# ======================================================================
# Generate Exam Questions
# ======================================================================
_RULES = """
IMPORTANT RULES

- Every question MUST be based ONLY on the study material.
- Do NOT generate duplicate questions.
- Mix easy, medium, and hard questions.
- Keep every question and every option short (under 25 words).
- Every question MUST contain: "topic", "text", "options", "answer".
- NEVER omit the "answer" field.
- No explanations. No markdown. No headings. No code blocks. No LaTeX.
- Return ONE JSON OBJECT only, exactly in the structure shown below.
"""

_MCQ_PROMPT = """
You are an expert teacher.

Generate EXACTLY __COUNT__ Multiple Choice Questions (MCQs) from the study material.

- Exactly 4 options per question.
- "answer" is the index of the correct option and must be 0, 1, 2, or 3.
""" + _RULES + """
Return exactly this structure:

{"questions":[{"topic":"Operating System","text":"Question","options":["A","B","C","D"],"answer":2}]}

Study Material:

__TEXT__
"""

_TF_PROMPT = """
You are an expert teacher.

Generate EXACTLY __COUNT__ True/False questions from the study material.

- Options MUST be exactly: ["True", "False"]
- "answer" must be 0 for True or 1 for False.
- Roughly half should be True and half False.
""" + _RULES + """
Return exactly this structure:

{"questions":[{"topic":"Operating System","text":"True or False Question","options":["True","False"],"answer":1}]}

Study Material:

__TEXT__
"""


def _generate_batch(material, kind, count, seen):
    template = _MCQ_PROMPT if kind == "mcq" else _TF_PROMPT
    prompt = template.replace("__COUNT__", str(count)).replace("__TEXT__", material)

    best = []
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            raw = _chat(prompt, schema=QUESTIONS_SCHEMA)
        except Exception as e:
            print(f"[{kind}] attempt {attempt} failed:", e)
            continue

        items = []
        for d in _raw_question_dicts(raw):
            q = _clean_question(d, kind)
            if q and q["text"].lower() not in seen and q["text"].lower() not in {i["text"].lower() for i in items}:
                items.append(q)

        print(f"[{kind}] attempt {attempt}: {len(items)}/{count} valid questions")
        if len(items) > len(best):
            best = items
        if len(best) >= count:
            break

    best = best[:count]
    seen.update(q["text"].lower() for q in best)
    return best


def generate_questions(text):
    """
    Returns a JSON string (array of question objects) so the Flask route can parse it.
    10 MCQs + 5 True/False, generated in two small requests so replies never get cut off.
    """
    material = _excerpt(text)
    seen = set()

    mcqs = _generate_batch(material, "mcq", MCQ_COUNT, seen)
    tfs = _generate_batch(material, "tf", TF_COUNT, seen)

    questions = mcqs + tfs
    if not questions:
        raise ValueError("The model did not return any valid questions.")

    print(f"Generated {len(mcqs)} MCQs + {len(tfs)} True/False = {len(questions)} questions")
    return json.dumps(questions)


# ==========================================================================
# Generate AI Feedback
# ==========================================================================
def generate_feedback(
    chapter,
    total_questions,
    correct_answers,
    percentage,
    grade,
    correct_topics,
    weak_topics
):

    prompt = f"""
You are an expert AI tutor.

A student has completed an exam.

Chapter:
{chapter}

Exam Summary:
- Total Questions: {total_questions}
- Correct Answers: {correct_answers}
- Score: {percentage}%
- Grade: {grade}

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
{", ".join(correct_topics) if correct_topics else "None"}

Topics answered incorrectly:
{", ".join(weak_topics) if weak_topics else "None"}

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

{{
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
    {{
      "title":"...",
      "search_query":"..."
    }},
    {{
      "title":"...",
      "search_query":"..."
    }},
    {{
      "title":"...",
      "search_query":"..."
    }}
  ]
}}
"""

    try:
        data = None
        raw = _chat(prompt, num_predict=1500)
        text = _strip_fences(raw)
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            start, end = text.find("{"), text.rfind("}")
            if start != -1 and end > start:
                data = json.loads(text[start:end + 1])
        if not isinstance(data, dict):
            raise ValueError("feedback is not a JSON object")

        # make sure the page always gets the lists it expects
        for key in ("strengths", "weak_topics", "recommended_topics", "youtube_videos"):
            if not isinstance(data.get(key), list):
                data[key] = []
        data["feedback"] = str(data.get("feedback") or "Good effort. Keep practising!")
        return data

    except Exception as e:
        print("Feedback generation failed:", e)
        uniq = lambda xs: list(dict.fromkeys(xs))
        return {
            "feedback": f"You scored {percentage}% (Grade {grade}). Review your weak topics and try again.",
            "strengths": uniq(correct_topics)[:3],
            "weak_topics": uniq(weak_topics)[:3],
            "recommended_topics": uniq(weak_topics)[:3],
            "youtube_videos": [
                {"title": f"{t} — explained", "search_query": f"{t} explained for students"}
                for t in uniq(weak_topics)[:3]
            ] if percentage < 70 else [],
        }