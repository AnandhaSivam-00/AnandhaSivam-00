# Guidelines for AI agents.

## Project overview

This project is to Uses GitHub's GraphQL v4 API to update dark_mode.svg / light_mode.svg with age, commits, stars, repositories, followers, and lines of code stats.

## Tech Stacks & Deployments

- **Language:** TypeScript v7
- **Package Manager:** `pnpm`
- **Production Deployment:** GitHub

## Build & Test commands

- Don't use the npm commands, instead use the pnpm for running, typechecking and linting the project
- Here, in this project there is no use of the pnpm build.

```bash
# Run the project
pnpm run

# Typechecking the codebase
pnpm typecheck

# Testing linting
pnpm lint
```

## Code style guidelines

- Provide the short one line comments for better understanding and readability, Use the JSDoc style commenting
  Example:

```ts
/**
 * The next.js on the Cloudflare need a resolver
 * @returns The resolved env secrets only based on the environment
 */
```

- Avoid `any` must strict type, Prefer `interface` for component props and `type` for state and constants, use `as const` for literal types
- Avoid the empty last line in the code file.
- Follow the below styles for the code blocks
  Example:

```ts
// Do like this
if(variable) {

}
else {

}

try {

}
catch(error) {

}

// Do not use like this
if (variable) {

} else {

}

try {

} catch(error) {
    
}

```

Note: You must use the up-to-date syntax and best practices, for this use the available skills and context7 MCP for the document references.

## Security considerations

- Don't look the .env, and node\_modules files/directories, even you have access to them
- Ask the confirmation to the user before delete the file or directory.
- Avoid the AI slops.

## Project Structure

```
.github
  +--- workflows
  |       build.yml --> GitHub Actions workflow for updating the README file
cache
  |
data
  |   githubFetch.ts --> Fetches the required data using the respective GitHub REST API endpoints
  |
old-readme --> The old README file with the previous codebase (deprecated)
  |
today.ts --> TypeScript script to update the README file with the latest stats
  |
lib
  +--- utils
  |        constants.ts --> Contains the constants used in the project
  |        helpers.ts --> Contains the helper functions used in the project
  |        queries.ts --> Contains the GraphQL queries used in the project
  +--- types
  |         types.ts --> Contains the typescript types
```

## PR Instructions

- If the user asked to open the PR or ask for the summary of the changes made on the code, provide the short and sweet summary of the changes made with any emoji's
- Make sure to follow the PR instructions and guidelines provided by the repository or project you are contributing to.
- If you are unsure about something, don't hesitate to ask for clarification or seek help from the user.