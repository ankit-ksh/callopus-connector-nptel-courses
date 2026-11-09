// src/api/constants.ts
var SITE_BASE = "https://nptel.ac.in";
var CATALOG_CACHE_KEY = "catalog";
var CATALOG_TTL_MS = 24 * 60 * 60 * 1e3;

// src/api/parser.ts
var YIELD_EVERY = 5e4;
var yieldToEventLoop = () => new Promise((resolve) => setTimeout(resolve, 0));
async function extractBalanced(html, key, open, close) {
  const marker = `${key}:${open}`;
  const markerIdx = html.indexOf(marker);
  if (markerIdx === -1) {
    throw new Error(
      `Could not find NPTEL's embedded "${key}" data on the page \u2014 the site's markup may have changed.`
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

// src/api/catalog.ts
var inMemoryCatalog = null;
async function fetchCatalogCourses(ctx) {
  if (!inMemoryCatalog) {
    const cached = await ctx.cache.get(
      CATALOG_CACHE_KEY
    );
    if (cached && Array.isArray(cached.courses) && cached.fetchedAt && Date.now() - cached.fetchedAt < CATALOG_TTL_MS) {
      inMemoryCatalog = cached.courses;
    } else {
      const resp = await ctx.fetch(`${SITE_BASE}/courses`);
      if (!resp.ok) {
        throw new Error(`Could not load the NPTEL course catalog (${resp.status}).`);
      }
      const html = await resp.text();
      const courses = await ctx.json5(
        await extractBalanced(html, "courses", "[", "]")
      );
      inMemoryCatalog = courses;
      await ctx.cache.set(CATALOG_CACHE_KEY, { fetchedAt: Date.now(), courses });
    }
  }
  return inMemoryCatalog;
}

// src/callopus/ids.ts
var NAMESPACE_PREFIX = "nptelcourses_";
function namespaceOf(id) {
  return `${NAMESPACE_PREFIX}${id}`;
}
function idFromNamespace(namespace) {
  return namespace.slice(NAMESPACE_PREFIX.length);
}

// src/callopus/catalog.ts
async function catalog(ctx) {
  const courses = await fetchCatalogCourses(ctx);
  return courses.map((c) => ({
    code: String(c.id),
    name: c.title,
    courseId: namespaceOf(c.id)
  }));
}

// ../../packages/connector-sdk/src/helpers/fetchJson.ts
function toHeadersRecord(headers) {
  const result = {};
  if (!headers) return result;
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    headers.forEach((val, key) => {
      result[key] = val;
    });
    return result;
  }
  if (Array.isArray(headers)) {
    for (const [key, val] of headers) {
      result[key] = val;
    }
    return result;
  }
  return { ...headers };
}
function extractToken(credential) {
  if (!credential) return null;
  if (typeof credential === "string" && credential.trim()) return credential.trim();
  if (typeof credential === "object") {
    const cred = credential;
    if (typeof cred.token === "string" && cred.token.trim()) return cred.token.trim();
    if (typeof cred.accessToken === "string" && cred.accessToken.trim()) {
      return cred.accessToken.trim();
    }
    if (typeof cred.idToken === "string" && cred.idToken.trim()) return cred.idToken.trim();
  }
  return null;
}
function hasAuthHeader(headers) {
  return Object.keys(headers).some((key) => key.toLowerCase() === "authorization");
}
async function fetchJson(ctx, url, options) {
  const opts = { ...options };
  const headers = toHeadersRecord(opts.headers);
  let token = opts.token ?? extractToken(ctx.credential);
  if (token && !hasAuthHeader(headers)) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  let response = await ctx.fetch(url, { ...opts, headers });
  if (response.status === 401) {
    const refreshed = await ctx.reauth();
    const refreshedToken = extractToken(refreshed);
    if (refreshedToken) {
      token = refreshedToken;
      headers["Authorization"] = `Bearer ${token}`;
      response = await ctx.fetch(url, { ...opts, headers });
    }
  }
  if (!response.ok) {
    let detail = "";
    try {
      detail = await response.text();
    } catch {
    }
    throw new Error(`HTTP ${response.status}${detail ? ` \u2014 ${detail}` : ""}`);
  }
  return response.json();
}

// src/api/http.ts
async function fetchJsonSafe(ctx, url) {
  try {
    return await fetchJson(ctx, url);
  } catch {
    return null;
  }
}

// src/api/course.ts
function courseUrl(id) {
  return `${SITE_BASE}/courses/${id}`;
}
async function fetchCourseData(ctx, id) {
  const [resp, subjectRes, statsRes] = await Promise.all([
    ctx.fetch(courseUrl(id)),
    fetchJsonSafe(ctx, `${SITE_BASE}/api/subject-details/${id}`),
    fetchJsonSafe(ctx, `${SITE_BASE}/api/stats/${id}`)
  ]);
  if (!resp.ok) throw new Error(`Could not load this course (${resp.status}).`);
  const html = await resp.text();
  const outline = await ctx.json5(
    await extractBalanced(html, "courseOutline", "{", "}")
  );
  return {
    outline,
    subject: subjectRes?.data || null,
    stats: Array.isArray(statsRes?.data) ? statsRes.data[0] : null
  };
}

// src/callopus/text.ts
function stripHtmlToText(raw) {
  if (!raw) return "";
  return String(raw).replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h[1-6])>/gi, "\n").replace(/<li[^>]*>/gi, "\u2022 ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
}

// src/api/drive.ts
var NPTEL_DRIVE_API_KEY = "AIzaSyDDV8J9hwrVdy4pYrXcmSGtgRXD9lc_QWY";
var NPTEL_LANGUAGE_CODES = {
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
  Assamese: "asm"
};
function transcriptLanguageCode(language) {
  return NPTEL_LANGUAGE_CODES[language] || language;
}
function transcriptFileUrl(fileId) {
  return `https://www.googleapis.com/drive/v3/files/${fileId}?key=${NPTEL_DRIVE_API_KEY}&alt=media`;
}

// src/callopus/transcripts.ts
function buildTranscripts(vttUrl) {
  if (!vttUrl) return void 0;
  const transcripts = Object.entries(vttUrl).filter(([, fileId]) => fileId).map(([language, fileId]) => ({
    lang: transcriptLanguageCode(language),
    url: transcriptFileUrl(fileId)
  }));
  return transcripts.length > 0 ? transcripts : void 0;
}

// src/callopus/course.ts
function buildCourseFacts(id, courseUrl2, outline, subj, stats) {
  const details = [];
  const seenLabels = /* @__PURE__ */ new Set();
  const addFact = (label, value, href) => {
    if (!label || value === void 0 || value === null) return;
    const cleanVal = String(value).trim();
    if (!cleanVal) return;
    const key = label.toLowerCase();
    if (seenLabels.has(key)) return;
    seenLabels.add(key);
    details.push(href ? { label, value: cleanVal, href } : { label, value: cleanVal });
  };
  const professor = (outline.professor || subj?.professor || "").trim() || void 0;
  const institute = (outline.instituteName || subj?.institutename || "").trim() || void 0;
  const coordinating = (outline.nocCoordinatingInstitute || "").trim() || void 0;
  addFact("Original Resource", courseUrl2, courseUrl2);
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
    const href = String(subj.intro_video).startsWith("http") ? String(subj.intro_video) : `https://www.youtube.com/watch?v=${subj.intro_video}`;
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
function buildLesson(lesson, unitName, unitTopic, courseUrl2, professor, institute) {
  const ytUrl = lesson.youtube_id ? `https://www.youtube.com/watch?v=${lesson.youtube_id}` : void 0;
  const itemSourceUrl = ytUrl || courseUrl2;
  const details = [];
  if (ytUrl) details.push({ label: "Original Resource", value: ytUrl, href: ytUrl });
  details.push({ label: "NPTEL Course Page", value: courseUrl2, href: courseUrl2 });
  if (unitName) details.push({ label: "Module / Week", value: unitName });
  if (professor) details.push({ label: "Instructor(s)", value: professor });
  if (institute) details.push({ label: "Institute", value: institute });
  if (lesson.concepts_covered) {
    const concepts = stripHtmlToText(lesson.concepts_covered);
    if (concepts) details.push({ label: "Concepts Covered", value: concepts });
  }
  if (unitTopic) details.push({ label: "Week Syllabus Topics", value: unitTopic });
  if (lesson.vtt_url) {
    const langs = Object.entries(lesson.vtt_url).filter(([, fileId]) => fileId).map(([lang]) => lang).join(", ");
    if (langs) details.push({ label: "Transcripts Available", value: langs });
  }
  return {
    id: String(lesson.id),
    title: String(lesson.name || ""),
    kind: lesson.youtube_id ? "video" : "reading",
    graded: false,
    dueAt: null,
    video: lesson.youtube_id ? { youtubeId: String(lesson.youtube_id), transcripts: buildTranscripts(lesson.vtt_url) } : void 0,
    sourceUrl: itemSourceUrl,
    authors: professor,
    details
  };
}
async function fetchCourse(courseId, ctx) {
  const id = idFromNamespace(courseId);
  const courseUrl2 = courseUrl(id);
  const { outline, subject: subj, stats } = await fetchCourseData(ctx, id);
  const professor = (outline.professor || subj?.professor || "").trim() || void 0;
  const institute = (outline.instituteName || subj?.institutename || "").trim() || void 0;
  const weekTopicsByTitle = /* @__PURE__ */ new Map();
  if (Array.isArray(outline.syllabus?.weeks)) {
    for (const w of outline.syllabus.weeks) {
      if (w?.week && w?.topic) {
        weekTopicsByTitle.set(String(w.week).trim().toLowerCase(), stripHtmlToText(w.topic));
      }
    }
  }
  const sections = (outline.units || []).map((unit) => {
    const unitTopic = unit?.name ? weekTopicsByTitle.get(String(unit.name).trim().toLowerCase()) : void 0;
    const lessons = (unit.lessons || []).map(
      (lesson) => buildLesson(lesson, unit.name, unitTopic, courseUrl2, professor, institute)
    );
    return { id: String(unit.id), title: String(unit.name || ""), lessons };
  }).filter((sec) => sec.lessons.length > 0);
  return {
    id: courseId,
    title: String(outline.title || subj?.title || id),
    category: institute,
    sections,
    details: buildCourseFacts(id, courseUrl2, outline, subj, stats),
    authors: professor,
    sourceUrl: courseUrl2
  };
}

// src/index.ts
var connector = {
  catalog,
  fetchCourse
};
var index_default = connector;
export {
  index_default as default
};
