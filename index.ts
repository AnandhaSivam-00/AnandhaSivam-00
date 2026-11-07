/**
 * TypeScript migration of today.py (Andrew Grant (Andrew6rant), 2022-2025)
 *
 * Uses GitHub's REST API to update dark_mode.svg / light_mode.svg with
 * age, commits, stars, repositories, followers, and lines of code stats.
 * (graphCommits() still queries the GraphQL v4 API, but it is currently unused)
 *
 * Root Repo Link: https://github.com/Andrew6rant/Andrew6rant/
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import type { Element } from '@xmldom/xmldom';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

import { fetchAllRepos, fetchCommitCount, fetchContributorStats, fetchUserData, REST_CALL_COUNT } from './data/githubFetch.js';
import { HEADERS, USER_NAME } from './lib/utils/constants.js';
import { dailyReadme, comma } from './lib/utils/helpers.js';
import type { RepoListItem } from './lib/types/types.js';

const QUERY_COUNT: Record<string, number> = { 'graph_commits': 0 };

// Global variable for the owner's numeric REST ID
// Run curl - https://api.github.com/users/AnandhaSivam-00
let OWNER_ID = 95125093;

type Json = Record<string, any>;

/**
 * Returns a request, or raises an Exception if the response does not succeed.
 * 
 * @param functId - The endpoint key counted against QUERY_COUNT
 * @param query - The GraphQL query string
 * @param variables - The variables for the GraphQL query
 * @returns The raw Response for the caller to parse
 */
async function simpleRequest(funcName: string, query: string, variables: Json): Promise<Response> {
  const request = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ query, variables }),
  });

  if(request.status === 200) {
    return request;
  }

  throw new Error(`${funcName}  has failed with a ${request.status} ${await request.text()} ${JSON.stringify(QUERY_COUNT)}`);
}

/**
 * Uses GitHub's GraphQL v4 API to return my total commit count
 * deprecated: this function is unused, but is left here for posterity
 */
async function graphCommits(startDate: string, endDate: string): Promise<number> {
  queryCount('graph_commits');
  const query = `
    query($start_date: DateTime!, $end_date: DateTime!, $login: String!) {
        user(login: $login) {
            contributionsCollection(from: $start_date, to: $end_date) {
                contributionCalendar {
                    totalContributions
                }
            }
        }
    }`;
  const variables = { 'start_date': startDate, 'end_date': endDate, 'login': USER_NAME };
  const request = await simpleRequest(graphCommits.name, query, variables);
  const json: Json = (await request.json()) as Json;
  return parseInt(json['data']['user']['contributionsCollection']['contributionCalendar']['totalContributions'], 10);
}

/** The default comment block written to a new cache file: a legend for the five columns */
const CACHE_LEGEND: string[] = [
  'This is a cache of all of the repositories I own, have contributed to, or am a member of.',
  '',
  'repository (hashed)  total commits  my commits  LOC added by me  LOC deleted by me',
  '         \\                \\                \\           \\_____________  \\',
  '          \\                \\                \\______________________  \\  \\',
  '           \\                \\___________________________________   \\  \\  \\',
  '____________\\___________________________________________________\\___\\__\\__\\_______',
];

/**
 * Checks each repository in repos to see if its default-branch commit count has changed since the last cache
 * If it has, run fetchContributorStats on that repository to update the LOC count
 * 
 * @param repos - The list of repositories to check
 * @param commentSize - The number of lines in the comment block at the top of the cache file
 * @param forceCache - If true, rebuilds the cache file even if the number of repositories hasn't changed
 * @param locAdd - The total number of lines added across all repositories (default: 0)
 * @param locDel - The total number of lines deleted across all repositories (default: 0)
 * @returns An array containing the total lines added, total lines deleted, net lines, and whether the data was cached
 */
async function cacheBuilder(
  repos: RepoListItem[],
  commentSize: number,
  forceCache: boolean,
  locAdd = 0,
  locDel = 0,
): Promise<Array<number | boolean>> {
  const cached = true; // Assume all repositories are cached
  const filename = `cache/${createHash('sha256').update(USER_NAME!, 'utf-8').digest('hex')}.txt`; // Create a unique filename for each user
  let data: string[];

  if(!existsSync(filename)) { // If the cache file doesn't exist, create it
    data = [];
    for(let i = 0; i < commentSize; i++) {
      data.push((CACHE_LEGEND[i] ?? 'This line is a comment block. Write whatever you want here.') + '\n');
    }
    mkdirSync('cache', { recursive: true });
    writeFileSync(filename, data.join(''));
  } 
  else {
    data = readFileLines(filename);
  }

  if(data.length - commentSize !== repos.length || forceCache) { // If the number of repos has changed or force_cache is true
    flushCache(repos, filename, commentSize);
    data = readFileLines(filename);
  }

  const cacheComment = data.slice(0, commentSize); // save the comment block
  data = data.slice(commentSize); // remove those lines

  try {
    for(let index = 0; index < repos.length; index++) {
      const repo = repos[index];
      const [repoHash, cachedCount] = data[index].trim().split(/\s+/);

      if(repoHash === createHash('sha256').update(repo.full_name, 'utf-8').digest('hex')) {
        const [owner, repoName] = repo.full_name.split('/');
        const totalCount = await fetchCommitCount(owner, repoName);

        if(cachedCount !== String(totalCount)) { // if the commit count has changed, update loc for that repo
          const stats = await fetchContributorStats(owner, repoName, OWNER_ID);
          if(stats === null) { // empty repository or the user has no commits on the default branch
            data[index] = `${repoHash} ${totalCount} 0 0 0\n`;
          } 
          else {
            const weekAdd = stats.weeks.reduce((sum, week) => sum + week.a, 0);
            const weekDel = stats.weeks.reduce((sum, week) => sum + week.d, 0);
            data[index] = `${repoHash} ${totalCount} ${stats.total} ${weekAdd} ${weekDel}\n`;
          }
        }
      }
    }
  } 
  catch(error) {
    forceCloseFile(data, cacheComment); // saves whatever has been written before this program crashes
    throw error;
  }

  mkdirSync('cache', { recursive: true });
  writeFileSync(filename, cacheComment.join('') + data.join(''));

  for(const line of data) {
    const loc = line.trim().split(/\s+/);
    locAdd += parseInt(loc[3], 10);
    locDel += parseInt(loc[4], 10);
  }

  return [locAdd, locDel, locAdd - locDel, cached];
}

/**
 * Wipes the cache file
 * This is called when the number of repositories changes or when the file is first created
 * 
 * @param repos - The list of repositories to cache
 * @param filename - The name of the cache file
 * @param commentSize - The number of lines in the comment block at the top of the cache file
 */
function flushCache(repos: RepoListItem[], filename: string, commentSize: number): void {
  let data: string[] = [];

  if(commentSize > 0) {
    data = readFileLines(filename).slice(0, commentSize); // only save the comment
  }

  let out = data.join('');
  for(const repo of repos) {
    out += createHash('sha256').update(repo.full_name, 'utf-8').digest('hex') + ' 0 0 0 0\n';
  }

  mkdirSync('cache', { recursive: true });
  writeFileSync(filename, out);
}

/**
 * Several repositories I have contributed to have since been deleted.
 * This function adds them using their last known data
 * 
 * @returns An array containing the total lines added, total lines deleted, net lines, total commits, 
 * and total contributed repositories
 */
function addArchive(): [number, number, number, number, number] {
  const data = readFileLines('cache/repository_archive.txt');
  const oldData = data;
  const trimmed = data.slice(7, data.length - 3); // remove the comment block
  let addedLoc = 0;
  let deletedLoc = 0;
  let addedCommits = 0;
  const contributedRepos = trimmed.length;

  for(const line of trimmed) {
    const [, , myCommits, ...loc] = line.trim().split(/\s+/);
    addedLoc += parseInt(loc[0], 10);
    deletedLoc += parseInt(loc[1], 10);

    if(Number.isInteger(parseInt(myCommits, 10)) && /^\d+$/.test(myCommits)) {
      addedCommits += parseInt(myCommits, 10);
    }
  }

  addedCommits += parseInt(oldData[oldData.length - 1].trim().split(/\s+/)[4].slice(0, -1), 10);
  return [addedLoc, deletedLoc, addedLoc - deletedLoc, addedCommits, contributedRepos];
}

/**
 * Forces the file to close, preserving whatever data was written to it
 * This is needed because if this function is called, the program would've crashed before the file is properly saved and closed
 * 
 * @param data - The data to write to the file
 * @param cacheComment - The comment block to write to the file
 */
function forceCloseFile(data: string[], cacheComment: string[]): void {
  const filename = `cache/${createHash('sha256').update(USER_NAME!, 'utf-8').digest('hex')}.txt`;
  mkdirSync('cache', { recursive: true });
  writeFileSync(filename, cacheComment.join('') + data.join(''));
  console.log('There was an error while writing to the cache file. The file,', filename, 'has had the partial data saved and closed.');
}

/**
 * Parse SVG files and update elements with my age, commits, stars, repositories, and lines written
 * 
 * @param filename - The name of the SVG file
 * @param ageData - The data for the age element
 * @param commitData - The data for the commits element
 * @param starData - The data for the stars element
 * @param repoData - The data for the repositories element
 */
function svgOverwrite(
  filename: string,
  ageData: string,
  commitData: number,
  starData: number,
  repoData: number,
  contribData: number,
  followerData: number,
  locData: (string | number)[],
): void {
  // mimic lxml's etree.parse(filename) + etree.write(filename, encoding='utf-8', xml_declaration=True)
  const doc = new DOMParser().parseFromString(readFileSync(filename, 'utf-8'), 'text/xml');
  const root = doc.documentElement!;
  justifyFormat(root, 'commit_data', commitData, 22);
  justifyFormat(root, 'star_data', starData, 14);
  justifyFormat(root, 'repo_data', repoData, 6);
  justifyFormat(root, 'contrib_data', contribData);
  justifyFormat(root, 'follower_data', followerData, 10);
  justifyFormat(root, 'loc_data', locData[2], 9);
  justifyFormat(root, 'loc_add', locData[0]);
  justifyFormat(root, 'loc_del', locData[1], 7);

  // keep whatever whitespace separated the xml declaration from the root element,
  // since the parser drops it (the original SVGs separate them with a newline)
  const raw = readFileSync(filename, 'utf-8');
  const separator = raw.match(/^<\?xml[\s\S]*?\?>\s*/)?.[0].slice(raw.match(/^<\?xml[\s\S]*?\?>/)?.[0].length ?? 0) ?? '';

  // reuse the original declaration when present, so unrelated runs never churn the file
  const declaration = raw.match(/^<\?xml[\s\S]*?\?>/)?.[0] ?? `<?xml version='1.0' encoding='utf-8'?>`;

  // mimic lxml's etree.write(filename, encoding='utf-8', xml_declaration=True)
  let serialized = new XMLSerializer().serializeToString(doc);
  serialized = serialized.replace(/^<\?xml[\s\S]*?\?>\s*/, '');

  writeFileSync(filename, declaration + separator + serialized);
}

/**
 * Updates and formats the text of the element, and modifes the amount of dots in the previous element to justify the new text on the svg
 * 
 * @param root - The root element of the SVG file
 * @param elementId - The ID of the element to update
 * @param newText - The new text to set for the element
 * @param length - The total length of the text, including dots and whitespace
 */
function justifyFormat(root: Element, elementId: string, newText: string | number, length = 0): void {
  if(typeof newText === 'number') {
    newText = comma(newText);
  }

  newText = String(newText);

  findAndReplace(root, elementId, newText);

  const justLen = Math.max(0, length - newText.length);
  let dotString: string;

  if(justLen <= 2) {
    const dotMap: Record<number, string> = { 0: '', 1: ' ', 2: '. ' };
    dotString = dotMap[justLen];
  } 
  else {
    dotString = ' ' + '.'.repeat(justLen) + ' ';
  }

  findAndReplace(root, `${elementId}_dots`, dotString);
}

/**
 * Finds the element in the SVG file and replaces its text with a new value
 * 
 * @param root - The root element of the SVG file
 * @param elementId - The ID of the element to update
 * @param newText - The new text to set for the element
 */
function findAndReplace(root: Element, elementId: string, newText: string): void {
  const element = getElementById(root, elementId);

  if(element !== null) {
    while(element.firstChild) {
      element.removeChild(element.firstChild);
    }
    element.appendChild((element.ownerDocument ?? root.ownerDocument)!.createTextNode(newText));
  }
}

/** equivalent of lxml's root.find(".//*[@id='...']") — first match only */
function getElementById(root: Element, elementId: string): Element | null {
  const walk = (node: Element): Element | null => {
    for(let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i];

      if(child.nodeType === 1) {
        if((child as Element).getAttribute?.('id') === elementId) {
          return child as Element;
        }

        const found = walk(child as Element);
        if(found) {
          return found;
        }
      }
    }

    return null;
  };

  return walk(root);
}

/**
 * Counts up my total commits, using the cache file created by cache_builder.
 * 
 * @param commentSize - The number of lines in the comment block at the top of the cache file
 * @returns The total number of commits across all repositories
 */
function commitCounter(commentSize: number): number {
  let totalCommits = 0;
  const filename = `cache/${createHash('sha256').update(USER_NAME!, 'utf-8').digest('hex')}.txt`; // Use the same filename as cache_builder
  const data = readFileLines(filename);
  const cacheComment = data.slice(0, commentSize); // save the comment block
  void cacheComment;
  const dataLines = data.slice(commentSize); // remove those lines

  for(const line of dataLines) {
    totalCommits += parseInt(line.trim().split(/\s+/)[2], 10);
  }

  return totalCommits;
}

/**
 * Counts how many times the GitHub GraphQL API is called
 * 
 * @param functId - The ID of the function being called
 */
function queryCount(functId: string): void {
  QUERY_COUNT[functId] = (QUERY_COUNT[functId] ?? 0) + 1;
}

/**
 * Calculates the time it takes for a function to run
 * Returns the function result and the time differential
 * 
 * @param funct - The function to run
 * @param args - The arguments to pass to the function
 * @returns A tuple containing the function result and the time differential in seconds
 */
async function perfCounter<T, A extends unknown[]>(funct: (...args: A) => T | Promise<T>, ...args: A): Promise<[T, number]> {
  const start = performance.now();
  const functReturn = (await funct(...args)) as T;

  return [functReturn, (performance.now() - start) / 1000];
}

/**
 * Prints a formatted time differential
 * Returns formatted result if whitespace is specified, otherwise returns raw result
 * 
 * @param queryType - The type of query being timed
 * @param difference - The time differential in seconds
 * @param functReturn - The result of the function being timed
 * @param whitespace - The number of characters to pad the result to (default: 0)
 * @returns The formatted result if whitespace is specified, otherwise returns raw result
 */
function formatter<T>(queryType: string, difference: number, functReturn?: T, whitespace = 0): T | string | undefined {
  process.stdout.write(`   ${queryType}:`.padEnd(23));

  if(difference > 1) {
    console.log(`${difference.toFixed(4)} s `.padStart(12));
  } 
  else {
    console.log(`${(difference * 1000).toFixed(4)} ms`.padStart(12));
  }

  if(whitespace) {
    return comma(Number(functReturn)).padEnd(whitespace);
  }

  return functReturn;
}

/** Python's file.readlines(): individual strings with their line terminators kept */
function readFileLines(path: string): string[] {
  return readFileSync(path, 'utf-8').match(/[^\r\n]*\r?\n|[^\r\n]+/g) ?? [];
}

const main = async (): Promise<void> => {
  console.log('Calculation times:');
  // define global variable for owner ID (numeric REST form)
  const [userData, userTime] = await perfCounter(fetchUserData, USER_NAME!);
  OWNER_ID = userData.id;
  formatter('account data', userTime);
  const [ageData, ageTime] = await perfCounter(dailyReadme, new Date(2002, 6, 5));
  formatter('age calculation', ageTime);

  // one paginated repository list feeds the LOC pass and every repo/star/contributor count
  const [repos, repoListTime] = await perfCounter(fetchAllRepos);
  const [locResult, locTime] = await perfCounter(cacheBuilder, repos, 7, false);
  const totalLoc: Array<number | string | boolean> = locResult as Array<number | string | boolean>;

  if(totalLoc[totalLoc.length - 1]) { // If repository data was cached
    formatter('LOC (cached)', locTime);
  } 
  else {
    formatter('LOC (no cache)', locTime);
  }

  let [commitData, commitTime] = await perfCounter(commitCounter, 7) as [number, number];
  const login = USER_NAME!.toLowerCase();
  const ownerRepos = repos.filter((repo) => repo.owner.login.toLowerCase() === login);
  const starData = ownerRepos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
  const repoData = ownerRepos.length;
  let contribData = repos.length;
  const followerData = userData.followers;

  // several repositories that I've contributed to have since been deleted.
  // the archive file only ships with Andrew6rant's repo, so skip the block when it is absent
  if(OWNER_ID === 95125093 && existsSync('cache/repository_archive.txt')) {
    const archivedData = addArchive();
    for(let index = 0; index < totalLoc.length - 1; index++) {
      totalLoc[index] = (totalLoc[index] as number) + archivedData[index];
    }
    contribData = contribData + archivedData[4];
    commitData = commitData + archivedData[3];
  }

  for(let index = 0; index < totalLoc.length - 1; index++) {
    totalLoc[index] = comma(totalLoc[index] as number); // format added, deleted, and total LOC
  }

  svgOverwrite('dark_mode.svg', ageData, commitData, starData, repoData, contribData, followerData, totalLoc.slice(0, -1) as (string | number)[]);
  svgOverwrite('light_mode.svg', ageData, commitData, starData, repoData, contribData, followerData, totalLoc.slice(0, -1) as (string | number)[]);

  // move cursor to override 'Calculation times:' with 'Total function time:' and the total function time, then move cursor back
  const totalFunctionTime = userTime + ageTime + locTime + commitTime + repoListTime;
  process.stdout.write('\x1b[F'.repeat(8) + 'Total function time:'.padEnd(21) +
    totalFunctionTime.toFixed(4).padStart(11) + ' s ' + '\x1b[E'.repeat(8));

  console.log('');
  console.log('Total GitHub REST API calls:', String(Object.values(REST_CALL_COUNT).reduce((a, b) => a + b, 0)).padStart(3));
  for(const [functName, count] of Object.entries(REST_CALL_COUNT)) {
    console.log(`   ${functName}:`.padEnd(28), String(count).padStart(6));
  }
  
  console.log('Total GitHub GraphQL API calls:', String(Object.values(QUERY_COUNT).reduce((a, b) => a + b, 0)).padStart(3));
  for(const [functName, count] of Object.entries(QUERY_COUNT)) {
    console.log(`   ${functName}:`.padEnd(28), String(count).padStart(6));
  }
};

if(import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  void main();
}