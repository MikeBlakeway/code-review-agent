import { describe, expect, it } from "vitest";

import { parseGitHubPullRequestUrl } from "./pr-url";

describe("parseGitHubPullRequestUrl", () => {
  it("parses a canonical GitHub pull request URL", () => {
    expect(
      parseGitHubPullRequestUrl("https://github.com/vercel/ai/pull/123"),
    ).toEqual({
      owner: "vercel",
      repo: "ai",
      pullNumber: 123,
      url: "https://github.com/vercel/ai/pull/123",
    });
  });

  it("normalizes trailing path segments and query strings", () => {
    expect(
      parseGitHubPullRequestUrl(
        "https://github.com/vercel/next.js/pull/456/files?diff=split",
      ),
    ).toEqual({
      owner: "vercel",
      repo: "next.js",
      pullNumber: 456,
      url: "https://github.com/vercel/next.js/pull/456",
    });
  });

  it("rejects non-GitHub URLs", () => {
    expect(() =>
      parseGitHubPullRequestUrl("https://example.com/vercel/ai/pull/1"),
    ).toThrow("Enter a valid GitHub pull request URL.");
  });

  it("rejects GitHub URLs that are not pull requests", () => {
    expect(() =>
      parseGitHubPullRequestUrl("https://github.com/vercel/ai/issues/1"),
    ).toThrow("Enter a valid GitHub pull request URL.");
  });

  it("rejects malformed input", () => {
    expect(() => parseGitHubPullRequestUrl("not a url")).toThrow(
      "Enter a valid GitHub pull request URL.",
    );
  });
});
