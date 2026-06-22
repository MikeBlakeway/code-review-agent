"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useChat } from "@ai-sdk/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
              <h2 className="text-sm font-semibold text-white">Agent trace</h2>
              <span className="font-mono text-xs text-zinc-500">
                {toolEvents.length} steps
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {toolEvents.length === 0 ? (
                <EmptyState>
                  The agent timeline will appear here as it inspects the diff,
                  reads files, searches patterns, and builds evidence.
                </EmptyState>
              ) : (
                toolEvents.map((part, index) => (
                  <ToolEvent
                    key={`${part.type}-${index}`}
                    part={part}
                    stepNumber={index + 1}
                  />
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
      <MarkdownContent>{part.text ?? ""}</MarkdownContent>
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
  stepNumber,
}: {
  part: RenderablePart;
  compact?: boolean;
  stepNumber?: number;
}) {
  const toolName = part.type.replace(/^tool-/, "").replaceAll("_", " ");
  const trace = getToolTrace(toolName, part);
  const hasDetails = Boolean(part.input || part.output);

  return (
    <div
      className={
        compact
          ? "rounded-md border border-cyan-300/20 bg-cyan-300/5 px-3 py-2"
          : "rounded-md border border-white/10 bg-black/40 px-3 py-3"
      }
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs text-cyan-200">
          {typeof stepNumber === "number" ? `${stepNumber}. ` : ""}
          {toolName}
        </span>
        <span className="font-mono text-[11px] text-zinc-500">
          {part.state ?? "pending"}
        </span>
      </div>
      <dl className="mt-3 space-y-2 text-xs leading-5">
        <TraceRow label="Why" value={trace.why} />
        <TraceRow label="Input" value={trace.input} />
        <TraceRow label="Learned" value={trace.learned} />
        <TraceRow label="Next" value={trace.next} />
      </dl>
      {part.errorText ? (
        <p className="mt-2 text-xs text-red-200">{part.errorText}</p>
      ) : null}
      {hasDetails && !compact ? (
        <details className="mt-3 rounded-md border border-white/10 bg-black/40 px-3 py-2">
          <summary className="cursor-pointer font-mono text-[11px] text-zinc-500">
            raw tool payload
          </summary>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-zinc-400">
            {JSON.stringify({ input: part.input, output: part.output }, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

function TraceRow({ label, value }: { label: string; value?: string }) {
  if (!value) {
    return null;
  }

  return (
    <div className="grid grid-cols-[54px_1fr] gap-2">
      <dt className="font-mono text-[11px] uppercase tracking-wide text-zinc-500">
        {label}
      </dt>
      <dd className="break-words font-mono text-zinc-300">{value}</dd>
    </div>
  );
}

function MarkdownContent({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="mt-6 text-2xl font-semibold text-white first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="mt-6 text-xl font-semibold text-white first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mt-5 text-base font-semibold text-white first:mt-0">
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className="my-3 text-sm leading-7 text-zinc-200">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="my-3 list-disc space-y-2 pl-5 text-sm leading-7 text-zinc-200">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="my-3 list-decimal space-y-2 pl-5 text-sm leading-7 text-zinc-200">
            {children}
          </ol>
        ),
        li: ({ children }) => <li>{children}</li>,
        code: ({ children }) => (
          <code className="rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[0.9em] text-cyan-100">
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="my-4 overflow-auto rounded-md border border-white/10 bg-black/50 p-4 text-xs leading-6 text-zinc-200">
            {children}
          </pre>
        ),
        a: ({ children, href }) => (
          <a
            className="text-cyan-300 underline decoration-cyan-300/40 underline-offset-4"
            href={href}
            rel="noreferrer"
            target="_blank"
          >
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="my-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm text-zinc-200">
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-white/10 bg-white/[0.04] px-3 py-2 text-left font-semibold text-white">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-white/10 px-3 py-2 align-top">
            {children}
          </td>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-4 border-l-2 border-cyan-300/50 pl-4 text-zinc-300">
            {children}
          </blockquote>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

function getToolTrace(toolName: string, part: RenderablePart) {
  const input = asRecord(part.input);
  const output = asRecord(part.output);

  if (toolName === "read file") {
    const path = stringValue(input.path) ?? stringValue(output.path);
    const ref = stringValue(input.ref) ?? stringValue(output.ref);
    return {
      why: "Read source context that was not visible in the diff.",
      input: [path, ref ? `@ ${ref}` : undefined].filter(Boolean).join(" "),
      learned: stringValue(output.path)
        ? `Loaded ${stringValue(output.path)}`
        : undefined,
      next: "Use the file context to validate or reject review findings.",
    };
  }

  if (toolName === "search codebase") {
    const query = stringValue(input.query);
    const resultCount = arrayLength(output.results);
    return {
      why: "Find related patterns, usages, or project conventions.",
      input: query ? `"${query}"` : undefined,
      learned:
        typeof resultCount === "number" ? `${resultCount} results` : undefined,
      next: "Compare the PR against matching codebase patterns.",
    };
  }

  if (toolName === "get pr diff") {
    const totalFiles = numberValue(output.totalFiles);
    const headSha = stringValue(asRecord(output.pullRequest).headSha);
    return {
      why: "Start from the changed files and patch hunks.",
      input: "Submitted pull request",
      learned: [
        typeof totalFiles === "number"
          ? `${totalFiles} changed files`
          : undefined,
        headSha ? `head ${headSha}` : undefined,
      ]
        .filter(Boolean)
        .join(", "),
      next: "Choose changed files that need deeper context.",
    };
  }

  if (toolName === "get file tree") {
    const depth = numberValue(input.depth);
    const entries = arrayLength(output.entries);
    return {
      why: "Orient around repository structure.",
      input: typeof depth === "number" ? `depth ${depth}` : undefined,
      learned: typeof entries === "number" ? `${entries} entries` : undefined,
      next: "Use structure to decide which files or conventions matter.",
    };
  }

  return {
    why: "Run a model-selected tool step.",
    input: compactJson(input),
    learned: compactJson(output),
    next: "Continue review once the tool result is available.",
  };
}

function compactJson(value: unknown) {
  const text = JSON.stringify(value);
  return text && text !== "{}" ? text.slice(0, 160) : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function arrayLength(value: unknown) {
  return Array.isArray(value) ? value.length : undefined;
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
