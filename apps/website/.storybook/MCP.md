# Marketing Storybook MCP

The marketing Storybook exposes an MCP server for component discovery, story
authoring, previews, interaction tests, and accessibility checks.

## Local setup

Install dependencies and start the marketing Storybook from the repository
root:

```bash
pnpm install
pnpm --filter @comfyorg/website storybook
```

The Storybook UI is available at `http://localhost:6008/` and its MCP endpoint
is `http://localhost:6008/mcp`.

### Codex

Add the following entry to `~/.codex/config.toml`:

```toml
[mcp_servers.comfy_marketing_storybook]
url = "http://localhost:6008/mcp"
```

Start Storybook before starting Codex. Restart Codex after changing its MCP
configuration.

### Other MCP clients

Use the same HTTP endpoint or run the interactive MCP configuration helper:

```bash
pnpm dlx mcp-add http://localhost:6008/mcp
```

Choose a descriptive server name such as `comfy-marketing-storybook`.

## Verify the connection

Ask the agent to perform both checks:

1. List the documented marketing components.
2. Find and run the stories for `ButtonPill`.

The first check validates the published component manifest. The second checks
the local development and testing toolsets.

## Shared remote documentation

The CI workflow publishes the marketing Storybook and its documentation-only
MCP server to a dedicated Vercel project. This project is separate from the
comfy.org website deployment. Local story authoring, previews, and tests still
require a local Storybook development server.

Create a separate Vercel project for `apps/website-storybook-mcp`. The workflow
uses the repository's existing `VERCEL_WEBSITE_ORG_ID` and
`VERCEL_WEBSITE_TOKEN` secrets. Add the new project's ID as:

- `VERCEL_WEBSITE_STORYBOOK_PROJECT_ID`

Pull requests publish preview deployments. A push to `main` publishes the
stable production deployment. The shared endpoint is the deployment origin
followed by `/mcp`.

For a remote Codex connection, replace the local URL with the shared Vercel
endpoint:

```toml
[mcp_servers.comfy_marketing_storybook]
url = "https://comfy-website-storybook-mcp.vercel.app/mcp"
bearer_token_env_var = "COMFY_STORYBOOK_MCP_TOKEN"
```

Set `COMFY_STORYBOOK_MCP_TOKEN` to the team token supplied by the Storybook
project owner. Browser access uses Google Workspace login and is restricted to
verified `@comfy.org` accounts. Anonymous requests to the Storybook, manifests,
and MCP endpoint are rejected.

### Coworker installation

Request `COMFY_STORYBOOK_MCP_TOKEN` from the Storybook project owner through the
team's approved secret-sharing tool. Never commit or paste the token into
screenshots, tickets, or chat. Set it in the shell that launches the agent:

```bash
export COMFY_STORYBOOK_MCP_TOKEN="<team token>"
```

Install the remote server in Codex:

```bash
codex mcp add comfy_marketing_storybook \
  --url https://comfy-website-storybook-mcp.vercel.app/mcp \
  --bearer-token-env-var COMFY_STORYBOOK_MCP_TOKEN
```

This branch also includes a project-level `.mcp.json` for Claude Code. Start
Claude Code from the repository root after setting the environment variable,
then approve the `comfy-marketing-storybook` server. For a user-level install:

```bash
claude mcp add --scope user --transport http comfy-marketing-storybook \
  https://comfy-website-storybook-mcp.vercel.app/mcp \
  --header "Authorization: Bearer $COMFY_STORYBOOK_MCP_TOKEN"
```

Restart the client after installation. Verify with
`codex mcp get comfy_marketing_storybook` or
`claude mcp get comfy-marketing-storybook`.

Storybook's official component manifests currently support React only. This
Vue Storybook adapts its checked-in design-system manifest to Storybook MCP's
v0 schema during the Vercel build. The remote server provides component and
story documentation; development and testing tools remain local.

## Agent guidance

When working on marketing UI, agents should:

- query Storybook documentation before using a component or prop;
- never infer undocumented component properties;
- fetch Storybook story-writing instructions before editing stories or UI;
- preview affected stories after visual changes;
- run Storybook's MCP tests, including accessibility checks, before handoff;
- treat missing documented patterns as gaps instead of inventing substitutes.

Storybook's MCP capabilities are currently a preview feature and may change
between Storybook releases.
