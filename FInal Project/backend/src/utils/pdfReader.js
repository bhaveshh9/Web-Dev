import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

/** Extract all text from a PDF buffer. */
export async function extractText(buffer) {
  const data = new Uint8Array(buffer);
  const pdf = await getDocument({ data, verbosity: 0, useSystemFonts: true }).promise;

  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item) => item.str + (item.hasEOL ? '\n' : ' ')).join('') + '\n';
  }
  await pdf.destroy();
  return text;
}
