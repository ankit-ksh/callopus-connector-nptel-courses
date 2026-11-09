// Course fetching and mapping for NPTEL Courses.
import type { Course, DetailFact, Lesson, Section } from "@callopus/course-model";
import type { ConnectorContext } from "@callopus/connector-sdk";
import { courseUrl as courseUrlOf, fetchCourseData } from "../api/course";
import type { RawOutline, RawStats, RawSubjectDetails } from "../api/course";
import { idFromNamespace } from "./ids";
import { stripHtmlToText } from "./text";
import { buildTranscripts } from "./transcripts";

function buildCourseFacts(
  id: string,
  courseUrl: string,
  outline: RawOutline,
  subj: RawSubjectDetails | null,
  stats: RawStats | null,
): DetailFact[] {
  const details: DetailFact[] = [];
  const seenLabels = new Set<string>();

  const addFact = (label?: string, value?: unknown, href?: string) => {
    if (!label || value === undefined || value === null) return;
    const cleanVal = String(value).trim();
    if (!cleanVal) return;
    const key = label.toLowerCase();
    if (seenLabels.has(key)) return;
    seenLabels.add(key);
    details.push(href ? { label, value: cleanVal, href } : { label, value: cleanVal });
  };

  const professor = (outline.professor || subj?.professor || "").trim() || undefined;
  const institute = (outline.instituteName || subj?.institutename || "").trim() || undefined;
  const coordinating = (outline.nocCoordinatingInstitute || "").trim() || undefined;

  addFact("Original Resource", courseUrl, courseUrl);
  addFact("Course ID", outline.id || id);
  if (subj?.courseid && String(subj.courseid) !== String(outline.id || id)) {
    addFact("NOC Course Code", subj.courseid);
  }
  addFact("Instructor(s)", professor);
  addFact("Institute", institute);
  if (coordinating && coordinating !== institute) {
    addFact("Coordinating Institute", coordinating);
  }
  addFact("Content Format", outline.contentType);

  outline.syllabus?.meta?.forEach((m) => m?.label && addFact(m.label, stripHtmlToText(m.value)));
  outline.syllabus?.facts?.forEach((f) => f?.label && addFact(f.label, stripHtmlToText(f.value)));

  if (subj?.duration) addFact("Term / Duration", subj.duration);
  if (subj?.enrollment) addFact("Enrollment Window", subj.enrollment);
  if (subj?.registration) addFact("Exam Registration", subj.registration);
  if (subj?.exam) addFact("Exam Date", subj.exam);
  if (subj?.syllabus_url) addFact("Syllabus Document", subj.syllabus_url, subj.syllabus_url);
  if (subj?.intro_video) {
    const href = String(subj.intro_video).startsWith("http")
      ? String(subj.intro_video)
      : `https://www.youtube.com/watch?v=${subj.intro_video}`;
    addFact("Intro Video", href, href);
  }

  if (stats?.Enrolled) addFact("Learners Enrolled", Number(stats.Enrolled).toLocaleString());
  if (stats?.Registered) addFact("Exam Registered", Number(stats.Registered).toLocaleString());
  if (stats?.Certified) addFact("Certified Learners", Number(stats.Certified).toLocaleString());

  const about = stripHtmlToText(outline.syllabus?.aboutHtml || subj?.course_abstract);
  if (about) addFact("About Course", about);
  const bio = stripHtmlToText(outline.syllabus?.instructorHtml);
  if (bio) addFact("Instructor Bio", bio);
  const books = stripHtmlToText(outline.syllabus?.booksHtml);
  if (books) addFact("Books & References", books);

  return details;
}

function buildLesson(
  lesson: NonNullable<NonNullable<RawOutline["units"]>[number]["lessons"]>[number],
  unitName: string | undefined,
  unitTopic: string | undefined,
  courseUrl: string,
  professor: string | undefined,
  institute: string | undefined,
): Lesson {
  const ytUrl = lesson.youtube_id ? `https://www.youtube.com/watch?v=${lesson.youtube_id}` : undefined;
  const itemSourceUrl = ytUrl || courseUrl;
  const details: DetailFact[] = [];
  if (ytUrl) details.push({ label: "Original Resource", value: ytUrl, href: ytUrl });
  details.push({ label: "NPTEL Course Page", value: courseUrl, href: courseUrl });
  if (unitName) details.push({ label: "Module / Week", value: unitName });
  if (professor) details.push({ label: "Instructor(s)", value: professor });
  if (institute) details.push({ label: "Institute", value: institute });
  if (lesson.concepts_covered) {
    const concepts = stripHtmlToText(lesson.concepts_covered);
    if (concepts) details.push({ label: "Concepts Covered", value: concepts });
  }
  if (unitTopic) details.push({ label: "Week Syllabus Topics", value: unitTopic });
  if (lesson.vtt_url) {
    const langs = Object.entries(lesson.vtt_url)
      .filter(([, fileId]) => fileId)
      .map(([lang]) => lang)
      .join(", ");
    if (langs) details.push({ label: "Transcripts Available", value: langs });
  }

  return {
    id: String(lesson.id),
    title: String(lesson.name || ""),
    kind: lesson.youtube_id ? "video" : "reading",
    graded: false,
    dueAt: null,
    video: lesson.youtube_id
      ? { youtubeId: String(lesson.youtube_id), transcripts: buildTranscripts(lesson.vtt_url) }
      : undefined,
    sourceUrl: itemSourceUrl,
    authors: professor,
    details,
  };
}

/**
 * Turns an NPTEL course into a Callopus course.
 */
export async function fetchCourse(courseId: string, ctx: ConnectorContext): Promise<Course> {
  const id = idFromNamespace(courseId);
  const courseUrl = courseUrlOf(id);
  const { outline, subject: subj, stats } = await fetchCourseData(ctx, id);

  const professor = (outline.professor || subj?.professor || "").trim() || undefined;
  const institute = (outline.instituteName || subj?.institutename || "").trim() || undefined;

  const weekTopicsByTitle = new Map<string, string>();
  if (Array.isArray(outline.syllabus?.weeks)) {
    for (const w of outline.syllabus.weeks) {
      if (w?.week && w?.topic) {
        weekTopicsByTitle.set(String(w.week).trim().toLowerCase(), stripHtmlToText(w.topic));
      }
    }
  }

  const sections: Section[] = (outline.units || [])
    .map((unit) => {
      const unitTopic = unit?.name
        ? weekTopicsByTitle.get(String(unit.name).trim().toLowerCase())
        : undefined;
      const lessons = (unit.lessons || []).map((lesson) =>
        buildLesson(lesson, unit.name, unitTopic, courseUrl, professor, institute),
      );
      return { id: String(unit.id), title: String(unit.name || ""), lessons };
    })
    .filter((sec) => sec.lessons.length > 0);

  return {
    id: courseId,
    title: String(outline.title || subj?.title || id),
    category: institute,
    sections,
    details: buildCourseFacts(id, courseUrl, outline, subj, stats),
    authors: professor,
    sourceUrl: courseUrl,
  };
}
