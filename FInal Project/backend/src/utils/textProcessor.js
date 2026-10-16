export function cleanText(text) {
  // Remove multiple spaces / blank lines (same as the Python version)
  return String(text || '').replace(/\s+/g, ' ').replace(/\n+/g, '\n').trim();
}
