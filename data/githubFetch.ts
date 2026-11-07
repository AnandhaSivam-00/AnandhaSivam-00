/**
 * Fetches the required data using the respective GitHub REST API endpoints
 * 
 * API Version: 2026-03-10
 */
import { API_BASE, HEADERS, PER_PAGE } from '../lib/utils/constants.js';
import type { ContributorActivity, GitHubUser, RepoListItem } from '../lib/types/types.js';

/** Counts how many times each GitHub REST API endpoint is called */
export const REST_CALL_COUNT: Record<string, number> = {
  'user_getter': 0, 'repos_list': 0, 'loc_stats': 0,
};

/**
 * Counts one request against the given endpoint key
 * 
 * @param functId - The endpoint key to increment
 */
function queryCount(functId: string): void {
  REST_CALL_COUNT[functId] = (REST_CALL_COUNT[functId] ?? 0) + 1;
}

/**
 * Returns a request, or raises an Exception if the response does not succeed
 * 
 * @param functId - The endpoint key counted against REST_CALL_COUNT
 * @param url - The absolute request URL
 * @param allowed - Status codes treated as success
 * @returns The raw Response for the caller to parse
 */
async function restRequest(functId: string, url: string, allowed: number[] = [200]): Promise<Response> {
  queryCount(functId);
  const request = await fetch(url, { headers: HEADERS });
  if(allowed.includes(request.status)) {
    return request;
  }
  throw new Error(`${functId} has failed with a ${request.status} ${await request.text()} ${JSON.stringify(REST_CALL_COUNT)}`);
}

/**
 * Extracts the rel="next" URL from a Link header
 * 
 * @param link - The raw Link header value (or null when absent)
 * @returns The absolute URL of the next page, or null on the last page
 */
function parseNextLink(link: string | null): string | null {
  if(link === null) {
    return null;
  }
  for(const part of link.split(',')) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if(match) {
      return match[1];
    }
  }
  return null;
}

/**
 * Fetches every page of a paginated REST endpoint by following the Link header
 * 
 * @param functId - The endpoint key counted against REST_CALL_COUNT
 * @param path - The API path with its query string (per_page is appended)
 * @returns The concatenated items of every page
 */
async function paginate<T>(functId: string, path: string): Promise<T[]> {
  const items: T[] = [];
  let url: string | null = `${API_BASE}${path}${path.includes('?') ? '&' : '?'}per_page=${PER_PAGE}`;
  while(url !== null) {
    const request = await restRequest(functId, url);
    items.push(...(await request.json()) as T[]);
    url = parseNextLink(request.headers.get('link'));
  }
  return items;
}

/**
 * Fetches the account ID, creation time, and follower count of the user
 * 
 * @param username - The login of the account to fetch
 * @returns The user's REST payload
 */
export async function fetchUserData(username: string): Promise<GitHubUser> {
  const request = await restRequest('user_getter', `${API_BASE}/users/${username}`);
  return await request.json() as GitHubUser;
}

/**
 * Fetches every repository the authenticated user has explicit access to
 * (owner, collaborator, and organization_member affiliations)
 * 
 * @returns The full repository list across all pages
 */
export async function fetchAllRepos(): Promise<RepoListItem[]> {
  return await paginate<RepoListItem>('repos_list', '/user/repos?affiliation=owner,collaborator,organization_member');
}

/**
 * Fetches per-author commit activity for a repository's default branch
 * Retries while GitHub compiles the statistics in the background (202 Accepted)
 * 
 * @param owner - The repository owner
 * @param repo - The repository name
 * @param ownerId - The numeric account ID to match against each author
 * @returns The matching author's activity, or null for empty/unavailable repositories
 */
export async function fetchContributorStats(owner: string, repo: string, ownerId: number): Promise<ContributorActivity | null> {
  const url = `${API_BASE}/repos/${owner}/${repo}/stats/contributors`;
  for(let attempt = 0; attempt < 3; attempt++) {
    const request = await restRequest('loc_stats', url, [200, 202, 204]);
    if(request.status === 200) {
      const activities = await request.json() as ContributorActivity[];
      return activities.find((activity) => activity.author?.id === ownerId) ?? null;
    }
    if(request.status === 204) {
      return null; // empty repository
    }
    await new Promise((resolve) => setTimeout(resolve, 1000)); // let GitHub finish compiling
  }
  throw new Error(`loc_stats is still compiling statistics after 3 attempts for ${owner}/${repo} ${JSON.stringify(REST_CALL_COUNT)}`);
}