import type { ConnectorContext } from "@callopus/connector-sdk";
import { fetchJsonSafe } from "./http";
import { SITE_BASE } from "./constants";
import { extractBalanced } from "./parser";

export interface RawSubjectDetails {
  courseid?: string | number;
  professor?: string;
  institutename?: string;
  duration?: string;
  enrollment?: string;
  registration?: string;
  exam?: string;
  syllabus_url?: string;
  intro_video?: string;
  course_abstract?: string;
  title?: string;
}

export interface RawStats {
  Enrolled?: string | number;
  Registered?: string | number;
  Certified?: string | number;
}

export interface RawOutline {
  id?: string | number;
  title?: string;
  contentType?: string;
  professor?: string;
  instituteName?: string;
  nocCoordinatingInstitute?: string;
  syllabus?: {
    meta?: Array<{ label?: string; value?: string }>;
    facts?: Array<{ label?: string; value?: string }>;
    weeks?: Array<{ week?: string; topic?: string }>;
    aboutHtml?: string;
    instructorHtml?: string;
    booksHtml?: string;
  };
  units?: Array<{
    id?: string | number;
    name?: string;
    lessons?: Array<{
      id?: string | number;
      name?: string;
      youtube_id?: string;
      concepts_covered?: string;
      vtt_url?: Record<string, string>;
    }>;
  }>;
}

/** The address of a course's page on NPTEL. */
export function courseUrl(id: string): string {
  return `${SITE_BASE}/courses/${id}`;
}

/** Everything NPTEL has on one course: its outline, details and statistics. */
export interface NptelCourseData {
  outline: RawOutline;
  subject: RawSubjectDetails | null;
  stats: RawStats | null;
}

/**
 * Fetches course outline, syllabus, instructor details and stats from NPTEL.
 */
export async function fetchCourseData(ctx: ConnectorContext, id: string): Promise<NptelCourseData> {
  const [resp, subjectRes, statsRes] = await Promise.all([
    ctx.fetch(courseUrl(id)),
    fetchJsonSafe<{ data?: RawSubjectDetails }>(ctx, `${SITE_BASE}/api/subject-details/${id}`),
    fetchJsonSafe<{ data?: RawStats[] }>(ctx, `${SITE_BASE}/api/stats/${id}`),
  ]);
  if (!resp.ok) throw new Error(`Could not load this course (${resp.status}).`);

  const html = await resp.text();
  const outline = await ctx.json5<RawOutline>(
    await extractBalanced(html, "courseOutline", "{", "}"),
  );

  return {
    outline,
    subject: subjectRes?.data || null,
    stats: Array.isArray(statsRes?.data) ? statsRes.data[0] : null,
  };
}
