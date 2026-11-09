import type { CatalogCourseEntry } from "@callopus/course-model";
import type { ConnectorContext } from "@callopus/connector-sdk";
import { fetchCatalogCourses } from "../api/catalog";
import { namespaceOf } from "./ids";

/**
 * The NPTEL course catalogue, in Callopus's words.
 */
export async function catalog(ctx: ConnectorContext): Promise<CatalogCourseEntry[]> {
  const courses = await fetchCatalogCourses(ctx);
  return courses.map((c) => ({
    code: String(c.id),
    name: c.title,
    courseId: namespaceOf(c.id),
  }));
}
