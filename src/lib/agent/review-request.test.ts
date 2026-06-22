import { describe, expect, it } from "vitest";

import {
  createReviewSystemPrompt,
  extractPullRequestLocatorFromMessages,
} from "./review-request";

describe("review request helpers", () => {
  it("extracts the latest GitHub PR URL from UI message text parts", () => {
    expect(
      extractPullRequestLocatorFromMessages([
        {
          role: "user",
          parts: [
            {
              type: "text",
              text: "Please review https://github.com/vercel/ai/pull/123/files",
            },
          ],
        },
      ]),
    ).toEqual({
      owner: "vercel",
      repo: "ai",
      pullNumber: 123,
      url: "https://github.com/vercel/ai/pull/123",
    });
  });

  it("prefers the most recent user message", () => {
    expect(
      extractPullRequestLocatorFromMessages([
        {
          role: "user",
          parts: [{ type: "text", text: "https://github.com/old/repo/pull/1" }],
        },
        {
          role: "assistant",
          parts: [{ type: "text", text: "Ready." }],
        },
        {
          role: "user",
          parts: [{ type: "text", text: "https://github.com/new/repo/pull/2" }],
        },
      ]),
    ).toMatchObject({
      owner: "new",
      repo: "repo",
      pullNumber: 2,
    });
  });

  it("throws a useful error when no PR URL is present", () => {
    expect(() =>
      extractPullRequestLocatorFromMessages([
        { role: "user", parts: [{ type: "text", text: "review this please" }] },
      ]),
    ).toThrow("Send a GitHub pull request URL to start a review.");
  });

  it("tells the model to use the PR diff tool before writing the review", () => {
    const prompt = createReviewSystemPrompt({
      owner: "vercel",
      repo: "ai",
      pullNumber: 123,
      url: "https://github.com/vercel/ai/pull/123",
    });

    expect(prompt).toContain("Call get_pr_diff first");
    expect(prompt).toContain("Risk areas");
    expect(prompt).toContain("file references");
  });

  it("requires observable trace and evidence-backed suggestions", () => {
    const prompt = createReviewSystemPrompt({
      owner: "vercel",
      repo: "ai",
      pullNumber: 123,
      url: "https://github.com/vercel/ai/pull/123",
    });

    expect(prompt).toContain("## Agent trace");
    expect(prompt).toContain("Why this tool");
    expect(prompt).toContain("Severity:");
    expect(prompt).toContain("Confidence:");
    expect(prompt).toContain("Evidence:");
    expect(prompt).toContain("Reasoning:");
    expect(prompt).toContain("Do not reveal hidden chain-of-thought");
  });
});
