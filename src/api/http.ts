import type { ConnectorContext } from "@callopus/connector-sdk";
import { fetchJson } from "@callopus/connector-sdk";

/**
 * Safely fetches a JSON endpoint, returning null if the request fails or is not ok.
 */
export async function fetchJsonSafe<T>(
  ctx: ConnectorContext,
  url: string,
): Promise<T | null> {
  try {
    return await fetchJson<T>(ctx, url);
  } catch {
    return null;
  }
}
