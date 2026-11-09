import { transcriptFileUrl, transcriptLanguageCode } from "../api/drive";

export interface TranscriptItem {
  lang: string;
  url: string;
}

/**
 * Builds transcript track entries from NPTEL's per-language Google Drive file map.
 */
export function buildTranscripts(
  vttUrl?: Record<string, string> | null,
): TranscriptItem[] | undefined {
  if (!vttUrl) return undefined;
  const transcripts: TranscriptItem[] = Object.entries(vttUrl)
    .filter(([, fileId]) => fileId)
    .map(([language, fileId]) => ({
      lang: transcriptLanguageCode(language),
      url: transcriptFileUrl(fileId),
    }));
  return transcripts.length > 0 ? transcripts : undefined;
}
