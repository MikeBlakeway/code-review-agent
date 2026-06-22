"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useChat } from "@ai-sdk/react";

type RenderablePart = {
  type: string;
  text?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

const exampleUrl = "https://github.com/vercel/ai/pull/7417";

export function ReviewAgent() {
  const [prUrl, setPrUrl] = useState("");
  const { messages, sendMessage, status, error } = useChat();
  const isRunning = status === "submitted" || status === "streaming";
  const toolEvents = useMemo(
    () =>
      messages.flatMap((message) =>
        (message.parts ?? [])
          .filter(isRenderablePart)
          .filter((part) => part.type.startsWith("tool-")),
      ),
    [messages],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = prUrl.trim();

    if (!text || isRunning) {
      return;
    }

    await sendMessage({ text });
  }

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-sm text-cyan-300">repo-pilot</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Agentic code review for GitHub pull requests.
            </h1>
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.03] px-4 py-3 font-mono text-xs text-zinc-400">
            AI SDK v6 · Octokit · Next.js
          </div>
        </header>

        <form
          onSubmit={handleSubmit}
          className="grid gap-3 rounded-lg border border-white/10 bg-zinc-950 p-3 shadow-2xl shadow-black/30 sm:grid-cols-[1fr_auto]"
        >
          <label className="sr-only" htmlFor="pr-url">
            GitHub pull request URL
          </label>
          <input
            id="pr-url"
            value={prUrl}
            onChange={(event) => setPrUrl(event.target.value)}
            placeholder={exampleUrl}
            className="h-12 rounded-md border border-white/10 bg-black px-4 font-mono text-sm text-white outline-none transition focus:border-cyan-300"
          />
          <button
            type="submit"
            disabled={isRunning || !prUrl.trim()}
            className="h-12 rounded-md bg-cyan-300 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {isRunning ? "Reviewing..." : "Review PR"}
          </button>
        </form>

        {error ? (
          <div className="rounded-md border border-red-400/30 bg-red-950/40 px-4 py-3 text-sm text-red-100">
            {error.message}
          </div>
        ) : null}

        <div className="grid flex-1 gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="rounded-lg border border-white/10 bg-zinc-950 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Tool calls</h2>
              <span className="font-mono text-xs text-zinc-500">
                {toolEvents.length} observed
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {toolEvents.length === 0 ? (
                <EmptyState>
                  Tool progress will appear here as the model reads the diff,
                  files, tree, and search results.
                </EmptyState>
              ) : (
                toolEvents.map((part, index) => (
                  <ToolEvent key={`${part.type}-${index}`} part={part} />
                ))
              )}
            </div>
          </aside>

          <section className="rounded-lg border border-white/10 bg-zinc-950 p-4">
            <h2 className="text-sm font-semibold text-white">Review</h2>
            <div className="mt-4 space-y-5">
              {messages.length === 0 ? (
                <EmptyState>
                  Paste a public GitHub PR URL. The agent will inspect the diff,
                  fetch context files, search related code, then stream a
                  structured review.
                </EmptyState>
              ) : (
                messages.map((message) => (
                  <article
                    key={message.id}
                    className="rounded-md border border-white/10 bg-black/40 p-4"
                  >
                    <div className="mb-3 font-mono text-xs uppercase text-zinc-500">
                      {message.role}
                    </div>
                    <div className="space-y-4">
                      {(message.parts ?? [])
                        .filter(isRenderablePart)
                        .map((part, index) => (
                          <MessagePart key={index} part={part} />
                        ))}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function MessagePart({ part }: { part: RenderablePart }) {
  if (part.type === "text") {
    return (
      <div className="whitespace-pre-wrap text-sm leading-7 text-zinc-200">
        {part.text}
      </div>
    );
  }

  if (part.type.startsWith("tool-")) {
    return <ToolEvent part={part} compact />;
  }

  return null;
}

function ToolEvent({
  part,
  compact = false,
}: {
  part: RenderablePart;
  compact?: boolean;
}) {
  const toolName = part.type.replace(/^tool-/, "").replaceAll("_", " ");

  return (
    <div
      className={
        compact
          ? "rounded-md border border-cyan-300/20 bg-cyan-300/5 px-3 py-2"
          : "rounded-md border border-white/10 bg-black/40 px-3 py-3"
      }
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs text-cyan-200">{toolName}</span>
        <span className="font-mono text-[11px] text-zinc-500">
          {part.state ?? "pending"}
        </span>
      </div>
      {part.errorText ? (
        <p className="mt-2 text-xs text-red-200">{part.errorText}</p>
      ) : null}
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm leading-6 text-zinc-500">
      {children}
    </div>
  );
}

function isRenderablePart(part: unknown): part is RenderablePart {
  return (
    typeof part === "object" &&
    part !== null &&
    "type" in part &&
    typeof (part as { type: unknown }).type === "string"
  );
}
