/** User payload returned by GET /users/{username} */
export interface GitHubUser {
  id: number;
  login: string;
  created_at: string;
  followers: number;
}

/** Repository item returned by GET /user/repos (minimal fields used by the script) */
export interface RepoListItem {
  full_name: string;
  owner: { login: string };
  stargazers_count: number;
}

/** Weekly commit hash from GET /repos/{owner}/{repo}/stats/contributors (w: week, a: additions, d: deletions, c: commits) */
export interface ContributorWeek {
  w: number;
  a: number;
  d: number;
  c: number;
}

/** Per-author entry from GET /repos/{owner}/{repo}/stats/contributors */
export interface ContributorActivity {
  author: { id: number } | null;
  total: number;
  weeks: ContributorWeek[];
}