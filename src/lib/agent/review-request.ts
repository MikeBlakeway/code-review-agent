import {
  parseGitHubPullRequestUrl,
  type PullRequestLocator,
} from "../github/pr-url";

export type ReviewMessage = {
  role?: string;
  content?: unknown;
  parts?: Array<{
    type?: string;
    text?: unknown;
  }>;
};

const missingPullRequestUrlMessage =
  "Send a GitHub pull request URL to start a review.";

export function extractPullRequestLocatorFromMessages(
  messages: ReviewMessage[],
): PullRequestLocator {
  for (const message of [...messages].reverse()) {
    if (message.role !== "user") {
      continue;
    }

    for (const candidate of extractUrlCandidates(getMessageText(message))) {
      try {
        return parseGitHubPullRequestUrl(candidate);
      } catch {
        // Keep scanning in case the message contains another valid PR URL.
      }
    }
  }

  throw new Error(missingPullRequestUrlMessage);
}

export function createReviewSystemPrompt(locator: PullRequestLocator) {
  return `You are Repo Pilot, a senior code review agent.

Review pull request ${locator.url} in ${locator.owner}/${locator.repo}.

Agent workflow:
- Call get_pr_diff first. Do not write the review before inspecting the diff.
- Use read_file for changed files where the diff lacks enough context.
- Use get_file_tree when repository structure affects the review.
- Use search_codebase to find related patterns, call sites, or existing conventions.
- Prefer 4-12 purposeful tool calls over a shallow one-pass response.
- Stop using tools once you have enough evidence to write a specific review.

Output format:
## Summary
Explain what the PR changes in plain language.

## Risk areas
List concrete risks with reasoning and file references.

## Suggestions
Give actionable recommendations. Include file references and line or hunk context when available.

## Positive observations
Call out what is well designed or easy to maintain.

Review standard:
- Be specific and evidence-backed.
- Do not invent files, line numbers, behavior, tests, or project conventions.
- If a concern is uncertain, say what evidence would confirm it.
- Prioritize correctness, security, maintainability, testing gaps, and operational risk.`;
}

function getMessageText(message: ReviewMessage) {
  const textParts =
    message.parts
      ?.filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text as string) ?? [];

  if (typeof message.content === "string") {
    textParts.push(message.content);
  }

  return textParts.join("\n");
}

function extractUrlCandidates(text: string) {
  return Array.from(
    text.matchAll(/https:\/\/github\.com\/[^\s<>"')]+/g),
    ([match]) => match.replace(/[.,;:!?]+$/, ""),
  );
}
