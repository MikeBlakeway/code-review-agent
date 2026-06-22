import { Octokit } from "octokit";

import type {
  GitHubApi,
  GitHubChangedFile,
  GitHubFileContent,
  GitHubPullRequest,
  GitHubSearchResult,
} from "./review-tools";

type OctokitResponse<T> = Promise<{ data: T }>;

type PullRequestResponse = {
  title: string;
  html_url: string;
  base: { ref: string };
  head: { ref: string; sha: string };
};

type PullRequestFileResponse = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previous_filename?: string;
};

type FileContentResponse = {
  type?: string;
  path?: string;
  html_url?: string;
  content?: string;
};

type TreeResponse = {
  tree: Array<{
    path?: string;
    type?: string;
  }>;
};

type SearchCodeResponse = {
  items: Array<{
    path: string;
    html_url: string;
    text_matches?: Array<{ fragment?: string }>;
  }>;
};

export type OctokitLike = {
  rest: {
    pulls: {
      get(input: {
        owner: string;
        repo: string;
        pull_number: number;
      }): OctokitResponse<PullRequestResponse>;
      listFiles(input: {
        owner: string;
        repo: string;
        pull_number: number;
        per_page: number;
      }): OctokitResponse<PullRequestFileResponse[]>;
    };
    repos: {
      getContent(input: {
        owner: string;
        repo: string;
        path: string;
        ref: string;
      }): OctokitResponse<FileContentResponse | FileContentResponse[]>;
    };
    git: {
      getTree(input: {
        owner: string;
        repo: string;
        tree_sha: string;
        recursive: "true";
      }): OctokitResponse<TreeResponse>;
    };
    search: {
      code(input: {
        q: string;
        per_page: number;
        headers: {
          accept: "application/vnd.github.text-match+json";
        };
      }): OctokitResponse<SearchCodeResponse>;
    };
  };
};

let cachedOctokit: Octokit | null = null;

export function getOctokit() {
  if (!cachedOctokit) {
    cachedOctokit = new Octokit(
      process.env.GITHUB_TOKEN ? { auth: process.env.GITHUB_TOKEN } : {},
    );
  }

  return cachedOctokit;
}

export function createGitHubApi(
  octokit: OctokitLike = getOctokit() as unknown as OctokitLike,
): GitHubApi {
  return {
    async getPullRequest(locator) {
      const response = await octokit.rest.pulls.get({
        owner: locator.owner,
        repo: locator.repo,
        pull_number: locator.pullNumber,
      });

      return mapPullRequest(response.data);
    },
    async listPullRequestFiles(locator) {
      const response = await octokit.rest.pulls.listFiles({
        owner: locator.owner,
        repo: locator.repo,
        pull_number: locator.pullNumber,
        per_page: 100,
      });

      return response.data.map(mapChangedFile);
    },
    async readFile(input) {
      const response = await octokit.rest.repos.getContent({
        owner: input.owner,
        repo: input.repo,
        path: input.path,
        ref: input.ref,
      });

      if (Array.isArray(response.data) || response.data.type !== "file") {
        throw new Error(`GitHub path is not a file: ${input.path}`);
      }

      return mapFileContent(response.data, input.ref);
    },
    async getFileTree(input) {
      const response = await octokit.rest.git.getTree({
        owner: input.owner,
        repo: input.repo,
        tree_sha: input.ref,
        recursive: "true",
      });

      return response.data.tree.flatMap((entry) => {
        if (!entry.path || (entry.type !== "blob" && entry.type !== "tree")) {
          return [];
        }

        if (entry.path.split("/").length > input.depth) {
          return [];
        }

        return [{ path: entry.path, type: entry.type }];
      });
    },
    async searchCode(input) {
      const response = await octokit.rest.search.code({
        q: `${input.query} repo:${input.owner}/${input.repo}`,
        per_page: input.limit,
        headers: {
          accept: "application/vnd.github.text-match+json",
        },
      });

      return response.data.items.map(mapSearchResult);
    },
  };
}

function mapPullRequest(data: PullRequestResponse): GitHubPullRequest {
  return {
    title: data.title,
    htmlUrl: data.html_url,
    baseRef: data.base.ref,
    headRef: data.head.ref,
    headSha: data.head.sha,
  };
}

function mapChangedFile(data: PullRequestFileResponse): GitHubChangedFile {
  const file: GitHubChangedFile = {
    path: data.filename,
    status: data.status,
    additions: data.additions,
    deletions: data.deletions,
    changes: data.changes,
  };

  if (data.patch) {
    file.patch = data.patch;
  }

  if (data.previous_filename) {
    file.previousPath = data.previous_filename;
  }

  return file;
}

function mapFileContent(data: FileContentResponse, ref: string): GitHubFileContent {
  if (!data.path || !data.content) {
    throw new Error("GitHub file response did not include file content.");
  }

  return {
    path: data.path,
    ref,
    content: Buffer.from(data.content.replace(/\n/g, ""), "base64").toString(
      "utf8",
    ),
    url: data.html_url,
  };
}

function mapSearchResult(data: SearchCodeResponse["items"][number]): GitHubSearchResult {
  return {
    path: data.path,
    url: data.html_url,
    textMatches:
      data.text_matches
        ?.map((match) => match.fragment)
        .filter((fragment): fragment is string => Boolean(fragment)) ?? [],
  };
}
