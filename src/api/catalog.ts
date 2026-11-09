import type { ConnectorContext } from "@callopus/connector-sdk";
import { CATALOG_CACHE_KEY, CATALOG_TTL_MS, SITE_BASE } from "./constants";
import { extractBalanced } from "./parser";

export interface RawCatalogCourse {
  id: string | number;
  title: string;
}

let inMemoryCatalog: RawCatalogCourse[] | null = null;

/**
 * Fetches the NPTEL course catalogue, caching results in memory and persistent cache.
 */
export async function fetchCatalogCourses(ctx: ConnectorContext): Promise<RawCatalogCourse[]> {
  if (!inMemoryCatalog) {
    const cached = await ctx.cache.get<{ fetchedAt: number; courses: RawCatalogCourse[] }>(
      CATALOG_CACHE_KEY,
    );
    if (
      cached &&
      Array.isArray(cached.courses) &&
      cached.fetchedAt &&
      Date.now() - cached.fetchedAt < CATALOG_TTL_MS
    ) {
      inMemoryCatalog = cached.courses;
    } else {
      const resp = await ctx.fetch(`${SITE_BASE}/courses`);
      if (!resp.ok) {
        throw new Error(`Could not load the NPTEL course catalog (${resp.status}).`);
      }
      const html = await resp.text();
      const courses = await ctx.json5<RawCatalogCourse[]>(
        await extractBalanced(html, "courses", "[", "]"),
      );
      inMemoryCatalog = courses;
      await ctx.cache.set(CATALOG_CACHE_KEY, { fetchedAt: Date.now(), courses });
    }
  }
  return inMemoryCatalog;
}
