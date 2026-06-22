import { tool } from "ai";
import { z } from "zod";

import type { PullRequestLocator } from "./pr-url";

export type GitHubPullRequest = {
  title: string;
  htmlUrl: string;
  baseRef: string;
  headRef: string;
  headSha: string;
};

export type GitHubChangedFile = {
  path: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previousPath?: string;
};

export type GitHubFileContent = {
  path: string;
  ref: string;
  content: string;
  url?: string;
};

export type GitHubTreeEntry = {
  path: string;
  type: "blob" | "tree";
};

export type GitHubSearchResult = {
  path: string;
  url: string;
  textMatches: string[];
};

export type GitHubApi = {
  getPullRequest(locator: PullRequestLocator): Promise<GitHubPullRequest>;
  listPullRequestFiles(
    locator: PullRequestLocator,
  ): Promise<GitHubChangedFile[]>;
  readFile(input: {
    owner: string;
    repo: string;
    path: string;
    ref: string;
  }): Promise<GitHubFileContent>;
  getFileTree(input: {
    owner: string;
    repo: string;
    ref: string;
    depth: number;
  }): Promise<GitHubTreeEntry[]>;
  searchCode(input: {
    owner: string;
    repo: string;
    query: string;
    limit: number;
  }): Promise<GitHubSearchResult[]>;
};

export type GetPrDiffInput = {
  maxFiles?: number;
};

export type ReadFileInput = {
  path: string;
  ref?: string;
};

export type GetFileTreeInput = {
  ref?: string;
  depth?: number;
};

export type SearchCodebaseInput = {
  query: string;
  limit?: number;
};

export async function getPrDiffForReview(
  api: GitHubApi,
  locator: PullRequestLocator,
  input: GetPrDiffInput = {},
) {
  const [pullRequest, files] = await Promise.all([
    api.getPullRequest(locator),
    api.listPullRequestFiles(locator),
  ]);
  const maxFiles = clampInteger(input.maxFiles ?? 40, 1, 100);

  return {
    pullRequest: {
      title: pullRequest.title,
      url: pullRequest.htmlUrl,
      baseRef: pullRequest.baseRef,
      headRef: pullRequest.headRef,
      headSha: pullRequest.headSha,
    },
    files: files.slice(0, maxFiles),
    totalFiles: files.length,
  };
}

export async function readFileForReview(
  api: GitHubApi,
  locator: PullRequestLocator,
  input: ReadFileInput,
) {
  const ref = input.ref ?? (await getPullRequestHeadSha(api, locator));

  return api.readFile({
    owner: locator.owner,
    repo: locator.repo,
    path: input.path,
    ref,
  });
}

export async function getFileTreeForReview(
  api: GitHubApi,
  locator: PullRequestLocator,
  input: GetFileTreeInput = {},
) {
  const ref = input.ref ?? (await getPullRequestHeadSha(api, locator));
  const depth = clampInteger(input.depth ?? 2, 1, 4);
  const entries = await api.getFileTree({
    owner: locator.owner,
    repo: locator.repo,
    ref,
    depth,
  });

  return { entries };
}

export async function searchCodebaseForReview(
  api: GitHubApi,
  locator: PullRequestLocator,
  input: SearchCodebaseInput,
) {
  const results = await api.searchCode({
    owner: locator.owner,
    repo: locator.repo,
    query: input.query,
    limit: clampInteger(input.limit ?? 10, 1, 20),
  });

  return { results };
}

export function createCachingGitHubApi(api: GitHubApi): GitHubApi {
  const pullRequests = new Map<string, Promise<GitHubPullRequest>>();

  return {
    ...api,
    getPullRequest(locator) {
      const key = `${locator.owner}/${locator.repo}#${locator.pullNumber}`;
      const existing = pullRequests.get(key);

      if (existing) {
        return existing;
      }

      const pullRequest = api.getPullRequest(locator);
      pullRequests.set(key, pullRequest);
      return pullRequest;
    },
  };
}

export function createGitHubReviewTools(
  api: GitHubApi,
  locator: PullRequestLocator,
) {
  const cachedApi = createCachingGitHubApi(api);

  return {
    get_pr_diff: tool({
      description:
        "Fetch metadata and changed files for the pull request, including patch hunks where GitHub provides them.",
      inputSchema: z.object({
        maxFiles: z.number().int().min(1).max(100).optional(),
      }),
      strict: true,
      execute: (input) => getPrDiffForReview(cachedApi, locator, input),
    }),
    read_file: tool({
      description:
        "Read a repository file. If ref is omitted, the PR head commit is used.",
      inputSchema: z.object({
        path: z.string().min(1),
        ref: z.string().min(1).optional(),
      }),
      strict: true,
      execute: (input) => readFileForReview(cachedApi, locator, input),
    }),
    get_file_tree: tool({
      description:
        "Get a flattened repository file tree. If ref is omitted, the PR head commit is used.",
      inputSchema: z.object({
        ref: z.string().min(1).optional(),
        depth: z.number().int().min(1).max(4).optional(),
      }),
      strict: true,
      execute: (input) => getFileTreeForReview(cachedApi, locator, input),
    }),
    search_codebase: tool({
      description:
        "Search for code patterns, symbols, usages, or related implementation details inside the PR repository.",
      inputSchema: z.object({
        query: z.string().min(1),
        limit: z.number().int().min(1).max(20).optional(),
      }),
      strict: true,
      execute: (input) => searchCodebaseForReview(cachedApi, locator, input),
    }),
  };
}

async function getPullRequestHeadSha(
  api: GitHubApi,
  locator: PullRequestLocator,
) {
  const pullRequest = await api.getPullRequest(locator);
  return pullRequest.headSha;
}

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.trunc(value)));
}
