import { describe, expect, it } from "vitest";

import { createGitHubApi } from "./api";

const locator = {
  owner: "vercel",
  repo: "ai",
  pullNumber: 123,
  url: "https://github.com/vercel/ai/pull/123",
};

describe("createGitHubApi", () => {
  it("maps pull request metadata from Octokit", async () => {
    const api = createGitHubApi({
      rest: {
        pulls: {
          async get(input) {
            expect(input).toEqual({
              owner: "vercel",
              repo: "ai",
              pull_number: 123,
            });
            return {
              data: {
                title: "Improve streaming",
                html_url: locator.url,
                base: { ref: "main" },
                head: { ref: "feature/streaming", sha: "abc123" },
              },
            };
          },
          async listFiles() {
            throw new Error("listFiles was not expected");
          },
        },
        repos: { async getContent() {} },
        git: { async getTree() {} },
        search: { async code() {} },
      },
    });

    await expect(api.getPullRequest(locator)).resolves.toEqual({
      title: "Improve streaming",
      htmlUrl: locator.url,
      baseRef: "main",
      headRef: "feature/streaming",
      headSha: "abc123",
    });
  });

  it("maps changed pull request files", async () => {
    const api = createGitHubApi({
      rest: {
        pulls: {
          async get() {
            throw new Error("get was not expected");
          },
          async listFiles(input) {
            expect(input).toEqual({
              owner: "vercel",
              repo: "ai",
              pull_number: 123,
              per_page: 100,
            });
            return {
              data: [
                {
                  filename: "src/app/api/chat/route.ts",
                  status: "modified",
                  additions: 12,
                  deletions: 3,
                  changes: 15,
                  patch: "@@ -1,3 +1,12 @@",
                  previous_filename: undefined,
                },
              ],
            };
          },
        },
        repos: { async getContent() {} },
        git: { async getTree() {} },
        search: { async code() {} },
      },
    });

    await expect(api.listPullRequestFiles(locator)).resolves.toEqual([
      {
        path: "src/app/api/chat/route.ts",
        status: "modified",
        additions: 12,
        deletions: 3,
        changes: 15,
        patch: "@@ -1,3 +1,12 @@",
      },
    ]);
  });

  it("decodes file contents from GitHub content responses", async () => {
    const api = createGitHubApi({
      rest: {
        pulls: {
          async get() {},
          async listFiles() {},
        },
        repos: {
          async getContent(input) {
            expect(input).toEqual({
              owner: "vercel",
              repo: "ai",
              path: "src/app/api/chat/route.ts",
              ref: "abc123",
            });
            return {
              data: {
                type: "file",
                path: "src/app/api/chat/route.ts",
                html_url:
                  "https://github.com/vercel/ai/blob/abc123/src/app/api/chat/route.ts",
                content: Buffer.from("export async function POST() {}").toString(
                  "base64",
                ),
              },
            };
          },
        },
        git: { async getTree() {} },
        search: { async code() {} },
      },
    });

    await expect(
      api.readFile({
        owner: "vercel",
        repo: "ai",
        path: "src/app/api/chat/route.ts",
        ref: "abc123",
      }),
    ).resolves.toEqual({
      path: "src/app/api/chat/route.ts",
      ref: "abc123",
      content: "export async function POST() {}",
      url: "https://github.com/vercel/ai/blob/abc123/src/app/api/chat/route.ts",
    });
  });

  it("filters recursive tree entries by depth", async () => {
    const api = createGitHubApi({
      rest: {
        pulls: {
          async get() {},
          async listFiles() {},
        },
        repos: { async getContent() {} },
        git: {
          async getTree(input) {
            expect(input).toEqual({
              owner: "vercel",
              repo: "ai",
              tree_sha: "abc123",
              recursive: "true",
            });
            return {
              data: {
                tree: [
                  { path: "src", type: "tree" },
                  { path: "src/app", type: "tree" },
                  { path: "src/app/api/chat/route.ts", type: "blob" },
                ],
              },
            };
          },
        },
        search: { async code() {} },
      },
    });

    await expect(
      api.getFileTree({
        owner: "vercel",
        repo: "ai",
        ref: "abc123",
        depth: 2,
      }),
    ).resolves.toEqual([
      { path: "src", type: "tree" },
      { path: "src/app", type: "tree" },
    ]);
  });

  it("scopes code search to the repository", async () => {
    const api = createGitHubApi({
      rest: {
        pulls: {
          async get() {},
          async listFiles() {},
        },
        repos: { async getContent() {} },
        git: { async getTree() {} },
        search: {
          async code(input) {
            expect(input).toEqual({
              q: "streamText repo:vercel/ai",
              per_page: 5,
              headers: {
                accept: "application/vnd.github.text-match+json",
              },
            });
            return {
              data: {
                items: [
                  {
                    path: "src/app/api/chat/route.ts",
                    html_url:
                      "https://github.com/vercel/ai/blob/main/src/app/api/chat/route.ts",
                    text_matches: [{ fragment: "streamText({" }],
                  },
                ],
              },
            };
          },
        },
      },
    });

    await expect(
      api.searchCode({
        owner: "vercel",
        repo: "ai",
        query: "streamText",
        limit: 5,
      }),
    ).resolves.toEqual([
      {
        path: "src/app/api/chat/route.ts",
        url: "https://github.com/vercel/ai/blob/main/src/app/api/chat/route.ts",
        textMatches: ["streamText({"],
      },
    ]);
  });
});
