# Project Briefing: Codebase Review Agent

## Context

I am a senior full-stack engineer (10+ years) applying for a **Senior AI Platform Engineer** role. The job spec repeatedly uses the words "agentic workflows", "orchestration layers", and "intelligent systems that respond to changes in code, documentation and design tools." Salary range £90k–£130k, fully remote UK.

Through a previous planning session, I identified that my current portfolio — while strong on production AI infrastructure — has a specific gap: **nothing demonstrating an agentic LLM loop with tool use**. All my current projects are either RAG pipelines (single-pass retrieval + generation), inference workers (input in, output out), or full-stack AI UX. None show an LLM deciding what to do, calling tools, observing results, and continuing.

The project I am building to close that gap is described below.

---

## My existing public AI projects (for context)

- **digital-legacy** — Self-hosted AI persona platform. RAG over pgvector, Llama 3.1 + LoRA via Modal, XTTS v2 voice cloning, faster-whisper STT. Next.js + Supabase + Python.
- **multi-modal-worker** — Production RunPod serverless inference worker. Six modalities (FLUX.1, AnimateDiff, LTX-Video, ControlNet, inpainting, camera control), GPU memory management, Docker, vLLM. 95%+ test coverage. Published to ghcr.io.
- **media-labs** — Next.js frontend for running ComfyUI workflows on RunPod. Automatic field inference from workflow JSON, model preflight checks, 21 custom hooks, real-time async progress tracking.
- **tribes** — Social platform with pgvector ML-based user positioning, BullMQ + Redis event queues, pnpm monorepo (Next.js + Fastify).

My commercial stack is Next.js App Router, React, TypeScript, Python, Supabase, Vercel.

---

## The project to build: Codebase Review Agent

### What it is

A deployed Next.js web app where a user pastes a GitHub PR URL and an LLM agent works through the change autonomously using tool calls — reading the diff, fetching relevant files, understanding the project structure, searching for related patterns — before producing a structured code review.

This is the "agentic" pattern in practice: the LLM decides what to read, reads it, decides what else it needs, reads that, and continues until it has enough to synthesise a useful output. It is meaningfully different from RAG (single-pass) or a workflow runner (pre-defined steps).

### Why this project specifically

- Directly maps to the job spec's language: "intelligent system that responds to changes in code"
- Demonstrates multi-step agent reasoning with tool use — the missing piece in my portfolio
- Uses the Vercel AI SDK, which is the modern standard for React/Next.js LLM applications and likely familiar to the hiring team
- Small enough scope to build, deploy, and document properly in a focused weekend
- Can be demonstrated live in an interview

### Planned stack

- **Framework**: Next.js 15 App Router, TypeScript, Tailwind CSS
- **LLM framework**: Vercel AI SDK (`ai` package) — `streamText` with `tools` on the server, `useChat` on the client
- **Model**: Anthropic Claude (claude-sonnet-4-6) or OpenAI GPT-4o — to be decided
- **GitHub integration**: Octokit (GitHub REST API) for the tool implementations
- **Deployment**: Vercel

### The four tools (agent capabilities)

1. **`get_pr_diff`** — Fetch the diff for a given PR (owner, repo, PR number). Returns changed files and their diffs.
2. **`read_file`** — Fetch the current contents of a specific file at a given ref. Used by the agent to get context around changed code.
3. **`get_file_tree`** — Return the top-level directory structure of the repo. Helps the agent understand project layout.
4. **`search_codebase`** — Search for a string or pattern across the repo using GitHub's search API. Used to find related code, usages, and patterns.

### The agent loop (intended behaviour)

```
User pastes PR URL → app parses owner/repo/PR number
→ agent starts with get_pr_diff()
→ observes diff, decides which files to read for context
→ calls read_file() one or more times
→ may call get_file_tree() to orient itself
→ may call search_codebase() to find related patterns
→ synthesises structured review: summary, risk areas, specific suggestions with file+line refs
→ streams result to UI
```

The agent should be able to make between 4–12 tool calls per review depending on PR size and complexity.

### Intended output format

A structured review with:
- **Summary**: what the PR does in plain language
- **Risk areas**: specific files/patterns that warrant attention, with reasoning
- **Suggestions**: concrete, actionable recommendations with file references
- **Positive observations**: things done well (to make it useful, not just critical)

### Repository name

`repo-pilot` (or similar — open to suggestions). Public on GitHub with a thorough README documenting the agent architecture, tool call sequence, and design decisions.

### Optional extension (post-MVP)

Extract the four GitHub tools into a published TypeScript MCP server on npm. This would add a second piece of evidence: not just an agentic application, but a reusable AI capability layer — which is exactly the "orchestration layer" language in the job spec.

---

## What I need from this session

Help planning and building this project. Starting points:

1. Validate the architecture decisions above — anything to reconsider before starting?
2. Plan the project structure (file/directory layout for a Next.js App Router project)
3. Design the Vercel AI SDK integration — specifically how to set up `streamText` with tools, handle multi-step agent loops, and stream progress to the client
4. Work through the GitHub API tool implementations
5. Design the UI — what should the user see while the agent is working (tool call progress, intermediate results)?
6. Plan the README so the agentic architecture is clearly communicated

I am comfortable with Next.js App Router, TypeScript, and the GitHub API. My main areas needing guidance are the Vercel AI SDK tool-calling patterns and the agent loop design.
