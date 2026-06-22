export type PullRequestLocator = {
  owner: string;
  repo: string;
  pullNumber: number;
  url: string;
};

const invalidPullRequestUrlMessage = "Enter a valid GitHub pull request URL.";

export function parseGitHubPullRequestUrl(input: string): PullRequestLocator {
  let url: URL;

  try {
    url = new URL(input.trim());
  } catch {
    throw new Error(invalidPullRequestUrlMessage);
  }

  if (url.hostname !== "github.com") {
    throw new Error(invalidPullRequestUrlMessage);
  }

  const [owner, repo, segment, pullNumberSegment] = url.pathname
    .split("/")
    .filter(Boolean);
  const pullNumber = Number(pullNumberSegment);

  if (!owner || !repo || segment !== "pull" || !Number.isInteger(pullNumber)) {
    throw new Error(invalidPullRequestUrlMessage);
  }

  return {
    owner,
    repo,
    pullNumber,
    url: `https://github.com/${owner}/${repo}/pull/${pullNumber}`,
  };
}
