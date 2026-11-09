// NPTEL's per-language transcript files, which live on Google Drive.

export const NPTEL_DRIVE_API_KEY = "AIzaSyDDV8J9hwrVdy4pYrXcmSGtgRXD9lc_QWY";

export const NPTEL_LANGUAGE_CODES: Record<string, string> = {
  English: "eng",
  Bengali: "ben",
  Gujarati: "guj",
  Hindi: "hin",
  Kannada: "kan",
  Malayalam: "mal",
  Marathi: "mar",
  Tamil: "tam",
  Telugu: "tel",
  Punjabi: "pan",
  Odiya: "ori",
  Assamese: "asm",
};

/** The language code NPTEL's transcripts use for a language's name. */
export function transcriptLanguageCode(language: string): string {
  return NPTEL_LANGUAGE_CODES[language] || language;
}

/** The address a transcript file can be downloaded from. */
export function transcriptFileUrl(fileId: string): string {
  return `https://www.googleapis.com/drive/v3/files/${fileId}?key=${NPTEL_DRIVE_API_KEY}&alt=media`;
}
