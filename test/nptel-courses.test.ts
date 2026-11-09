import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CatalogCourseEntry, Course } from "@callopus/course-model";
import { createTestContext, expectValid } from "@callopus/connector-sdk/testing";
import nptelConnector from "../src/index";
import expectedCatalog from "./expected/catalog.json";
import expectedCatalogRequests from "./expected/catalog.requests.json";
import expectedCourse from "./expected/fetchCourse-106106184.json";
import expectedCourseRequests from "./expected/fetchCourse-106106184.requests.json";

const fixturesDir = fileURLToPath(new URL("fixtures", import.meta.url));
const catalogHtml = fs.readFileSync(path.join(fixturesDir, "catalog.html"), "utf-8");
const courseHtml = fs.readFileSync(path.join(fixturesDir, "course-106106184.html"), "utf-8");
const subjectDetails = JSON.parse(
  fs.readFileSync(path.join(fixturesDir, "subject-details-106106184.json"), "utf-8"),
);
const stats = JSON.parse(
  fs.readFileSync(path.join(fixturesDir, "stats-106106184.json"), "utf-8"),
);

describe("nptel-courses connector", () => {
  it("fetches catalog, as recorded", async () => {
    const ctx = createTestContext({
      routes: {
        "https://nptel.ac.in/courses": catalogHtml,
      },
    });

    const entries = await nptelConnector.catalog!(ctx);
    expect(entries).toEqual(expectedCatalog);
    expect(ctx.requests).toEqual(expectedCatalogRequests);
    for (const entry of entries) {
      expectValid(CatalogCourseEntry, entry);
    }
  });

  it("fetches course outline, as recorded", async () => {
    const ctx = createTestContext({
      routes: {
        "https://nptel.ac.in/courses/106106184": courseHtml,
        "https://nptel.ac.in/api/subject-details/106106184": subjectDetails,
        "https://nptel.ac.in/api/stats/106106184": stats,
      },
    });

    const course = await nptelConnector.fetchCourse("nptelcourses_106106184", ctx);
    expect(course).toEqual(expectedCourse);
    expect(ctx.requests).toEqual(expectedCourseRequests);
    expectValid(Course, course);
  });

  it("throws when course cannot be loaded", async () => {
    const ctx = createTestContext({
      routes: {
        "https://nptel.ac.in/courses/999999": {
          status: 404,
          body: "Not Found",
        },
      },
    });

    await expect(nptelConnector.fetchCourse("nptelcourses_999999", ctx)).rejects.toThrow(
      "Could not load this course (404).",
    );
  });
});
