// Reading the data NPTEL embeds in its pages.

const YIELD_EVERY = 50000;
const yieldToEventLoop = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Extracts a balanced substring bounded by open and close delimiters starting
 * from key:open. Quote-aware and yields periodically to avoid locking the event loop.
 */
export async function extractBalanced(
  html: string,
  key: string,
  open: string,
  close: string,
): Promise<string> {
  const marker = `${key}:${open}`;
  const markerIdx = html.indexOf(marker);
  if (markerIdx === -1) {
    throw new Error(
      `Could not find NPTEL's embedded "${key}" data on the page — the site's markup may have changed.`,
    );
  }
  const start = markerIdx + `${key}:`.length;
  let depth = 0;
  let inString = false;
  for (let i = start; i < html.length; i++) {
    if (i > start && (i - start) % YIELD_EVERY === 0) await yieldToEventLoop();
    const ch = html[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return html.slice(start, i + 1);
    }
  }
  throw new Error(`NPTEL's embedded "${key}" data looked truncated.`);
}
