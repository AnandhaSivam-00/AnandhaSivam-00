import { config } from 'dotenv';

// load .env before reading process.env, so local values win over Windows' built-in USERNAME variable
config({ override: true });

// Fine-grained personal access token with All Repositories access:
// Account permissions: read:Followers, read:Starring, read:Watching
// Repository permissions: read:Commit statuses, read:Contents, read:Issues, read:Metadata, read:Pull Requests
// Note: read:Starring / read:Watching are no longer required by the code (star counts come from the repo payload)
export const HEADERS: Record<string, string> = {
  'authorization': 'token ' + process.env['PAT_TOKEN'],
  'accept': 'application/vnd.github+json',
  'content-type': 'application/json',
  'x-github-api-version': '2026-03-10',
};
export const USER_NAME = process.env['USERNAME'];
export const API_BASE = 'https://api.github.com';
export const PER_PAGE = 100;