import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";

import {
  createReviewSystemPrompt,
  extractPullRequestLocatorFromMessages,
  type ReviewMessage,
} from "../../../lib/agent/review-request";
import { createGitHubApi } from "../../../lib/github/api";
import { createGitHubReviewTools } from "../../../lib/github/review-tools";

export const maxDuration = 60;

const defaultModel = "openai/gpt-4.1-mini";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { messages?: UIMessage[] };

    if (!Array.isArray(body.messages)) {
      return Response.json(
        { error: "Expected a messages array." },
        { status: 400 },
      );
    }

    const locator = extractPullRequestLocatorFromMessages(
      body.messages as ReviewMessage[],
    );
    const modelMessages = await convertToModelMessages(body.messages);
    const result = streamText({
      model: process.env.AI_MODEL ?? defaultModel,
      system: createReviewSystemPrompt(locator),
      messages: modelMessages,
      tools: createGitHubReviewTools(createGitHubApi(), locator),
      stopWhen: stepCountIs(12),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start review.";
    const status =
      message.includes("pull request URL") || message.includes("GitHub")
        ? 400
        : 500;

    if (status === 500) {
      console.error(error);
    }

    return Response.json({ error: message }, { status });
  }
}
