import { describe, expect, it } from "vitest";

import type { GitHubApi } from "./review-tools";
import {
  getFileTreeForReview,
  getPrDiffForReview,
  readFileForReview,
  searchCodebaseForReview,
} from "./review-tools";

const locator = {
  owner: "vercel",
  repo: "ai",
  pullNumber: 123,
  url: "https://github.com/vercel/ai/pull/123",
};

function createFakeApi(overrides: Partial<GitHubApi> = {}): GitHubApi {
  return {
    async getPullRequest() {
      throw new Error("getPullRequest was not expected");
    },
    async listPullRequestFiles() {
      throw new Error("listPullRequestFiles was not expected");
    },
    async readFile() {
      throw new Error("readFile was not expected");
    },
    async getFileTree() {
      throw new Error("getFileTree was not expected");
    },
    async searchCode() {
      throw new Error("searchCode was not expected");
    },
    ...overrides,
  };
}

describe("GitHub review tool helpers", () => {
  it("returns PR metadata and changed file patches for the diff tool", async () => {
    const result = await getPrDiffForReview(
      createFakeApi({
        async getPullRequest(input) {
          expect(input).toEqual(locator);
          return {
            title: "Improve streaming",
            htmlUrl: locator.url,
            baseRef: "main",
            headRef: "feature/streaming",
            headSha: "abc123",
          };
        },
        async listPullRequestFiles(input) {
          expect(input).toEqual(locator);
          return [
            {
              path: "src/app/api/chat/route.ts",
              status: "modified",
              additions: 12,
              deletions: 3,
              changes: 15,
              patch: "@@ -1,3 +1,12 @@",
            },
          ];
        },
      }),
      locator,
      { maxFiles: 10 },
    );

    expect(result).toEqual({
      pullRequest: {
        title: "Improve streaming",
        url: locator.url,
        baseRef: "main",
        headRef: "feature/streaming",
        headSha: "abc123",
      },
      files: [
        {
          path: "src/app/api/chat/route.ts",
          status: "modified",
          additions: 12,
          deletions: 3,
          changes: 15,
          patch: "@@ -1,3 +1,12 @@",
        },
      ],
      totalFiles: 1,
    });
  });

  it("limits returned diff files without hiding the total count", async () => {
    const result = await getPrDiffForReview(
      createFakeApi({
        async getPullRequest() {
          return {
            title: "Large PR",
            htmlUrl: locator.url,
            baseRef: "main",
            headRef: "feature/large",
            headSha: "def456",
          };
        },
        async listPullRequestFiles() {
          return [
            {
              path: "one.ts",
              status: "modified",
              additions: 1,
              deletions: 0,
              changes: 1,
            },
            {
              path: "two.ts",
              status: "modified",
              additions: 1,
              deletions: 0,
              changes: 1,
            },
          ];
        },
      }),
      locator,
      { maxFiles: 1 },
    );

    expect(result.files).toHaveLength(1);
    expect(result.totalFiles).toBe(2);
  });

  it("reads files from the PR head when no ref is supplied", async () => {
    const result = await readFileForReview(
      createFakeApi({
        async getPullRequest() {
          return {
            title: "Improve streaming",
            htmlUrl: locator.url,
            baseRef: "main",
            headRef: "feature/streaming",
            headSha: "abc123",
          };
        },
        async readFile(input) {
          expect(input).toEqual({
            owner: "vercel",
            repo: "ai",
            path: "src/app/api/chat/route.ts",
            ref: "abc123",
          });
          return {
            path: "src/app/api/chat/route.ts",
            ref: "abc123",
            content: "export async function POST() {}",
          };
        },
      }),
      locator,
      { path: "src/app/api/chat/route.ts" },
    );

    expect(result.content).toContain("POST");
  });

  it("gets a repository tree from the PR head by default", async () => {
    const result = await getFileTreeForReview(
      createFakeApi({
        async getPullRequest() {
          return {
            title: "Improve streaming",
            htmlUrl: locator.url,
            baseRef: "main",
            headRef: "feature/streaming",
            headSha: "abc123",
          };
        },
        async getFileTree(input) {
          expect(input).toEqual({
            owner: "vercel",
            repo: "ai",
            ref: "abc123",
            depth: 2,
          });
          return [{ path: "src/app", type: "tree" }];
        },
      }),
      locator,
      { depth: 2 },
    );

    expect(result).toEqual({ entries: [{ path: "src/app", type: "tree" }] });
  });

  it("searches code through the repository adapter", async () => {
    const result = await searchCodebaseForReview(
      createFakeApi({
        async searchCode(input) {
          expect(input).toEqual({
            owner: "vercel",
            repo: "ai",
            query: "streamText",
            limit: 5,
          });
          return [
            {
              path: "src/app/api/chat/route.ts",
              url: "https://github.com/vercel/ai/blob/main/src/app/api/chat/route.ts",
              textMatches: ["streamText({"],
            },
          ];
        },
      }),
      locator,
      { query: "streamText", limit: 5 },
    );

    expect(result.results).toEqual([
      {
        path: "src/app/api/chat/route.ts",
        url: "https://github.com/vercel/ai/blob/main/src/app/api/chat/route.ts",
        textMatches: ["streamText({"],
      },
    ]);
  });
});
