# NPTEL Courses connector

A Callopus course connector for the open-access, login-free NPTEL catalogue at
[nptel.ac.in](https://nptel.ac.in). This is distinct from the login-required
NPTEL GATE portal.

## Connection and authentication

- **What it connects to:** `https://nptel.ac.in` (declared in manifest
  `network`).
- **Signing in:** None (`auth: { "kind": "none" }`). No account, token, or
  credentials required.
- **Transcripts:** Transcript URLs point directly to Google Drive captions using
  NPTEL's public frontend client key. URLs are constructed by the connector but
  fetched directly by the desktop application when viewing transcripts.

## Supported capabilities

Implements Protocol 2:
- `catalog(ctx)`: Lists all publicly available NPTEL courses (~3,500
  courses across engineering, science, and humanities).
- `fetchCourse(courseId, ctx)`: Retrieves the course outline, metadata facts,
  syllabus, instructors, video lessons, and transcripts.

## How the data maps to the Callopus course model

- **Catalogue:**
  NPTEL embeds its course database as an inline JavaScript object literal
  `courses:[...]` in the SSR HTML of `https://nptel.ac.in/courses`. The connector
  extracts and parses this literal, mapping each entry to `CatalogCourseEntry`:
  `code` (course ID), `name` (course title), and `courseId` (`nptelcourses_<id>`).
  Catalogue results are cached in memory and in `ctx.cache` with a 24-hour TTL.
- **Course Outline:**
  The course outline is embedded as `courseOutline:{...}` on
  `https://nptel.ac.in/courses/:id`. The connector extracts this structure and
  combines it with data from `https://nptel.ac.in/api/subject-details/:id` and
  `https://nptel.ac.in/api/stats/:id`:
  - `units` map to Callopus `Section`s.
  - `lessons` map to Callopus `Lesson`s:
    - Lessons with `youtube_id` become `video` lessons with YouTube IDs and
      multilingual transcript tracks.
    - Lessons without video become `reading` lessons.
  - Metadata, syllabus, enrollment stats, books, and instructor bios are
    formatted into Callopus `DetailFact` entries.

## How to build and test

```sh
# Install dependencies
pnpm install --ignore-workspace

# Run regression tests against recorded fixtures
pnpm test

# Typecheck TypeScript modules
pnpm typecheck

# Build single ES module bundle
pnpm build

# Verify built bundle against manifest declaration
npx callopus-connector check
```

## Content licence

NPTEL's course material is published under Creative Commons BY-NC-SA. This
connector neither hosts nor redistributes any content; it formats public
NPTEL pages on the user's machine at the user's request.
