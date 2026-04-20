# Verify Commands Cookbook

One-shot commands for each False-Defect Verification class. Keep each under ~30s.

## 1. Check for existing fix PR

```bash
# By keyword in title
gh search prs --repo Comfy-Org/ComfyUI_frontend "<keyword>" --state merged --limit 5

# By keyword in body
gh pr list --repo Comfy-Org/ComfyUI_frontend --search "<keyword>" --state all --limit 5

# Recent closing PRs near the reported date
gh pr list --repo Comfy-Org/ComfyUI_frontend --state merged \
  --search "merged:>=<YYYY-MM-DD> <keyword>" --limit 10
```

Verify tag: `fixed` if a merged PR explicitly matches; `pr-open` if an open PR matches.

## 2. Check for existing open Linear issue

```bash
# Via Linear MCP (preferred)
#   mcp__linear__searchIssues({ query: "<keyword>", state: "open" })
#
# Via GraphQL fallback — see reference/linear-api.md
```

Verify tag: `dedupe` with the `LIN-XXX` identifier in the approval row.

## 3. Feature actually exists in codebase

```bash
# Find the component / feature mentioned
rg -l "<ComponentOrFeatureName>" src/ apps/ --type vue --type ts

# Find a setting key
rg "<setting-key>" src/locales/en/ src/stores/settingStore.ts

# Find a store action
rg "<actionName>" src/stores/ --type ts
```

Verify tag: `stale` if 0 hits AND the feature name is specific (not a generic word).

## 4. Intended behavior check

```bash
# Check docs and release notes
rg -l "<feature keyword>" docs/ CHANGELOG.md

# Check if behavior is asserted in an existing test (green today)
rg "<observed behavior>" src/**/*.test.ts browser_tests/
```

Verify tag: `expected` if docs describe this as the intended behavior, or a test asserts it.

## 5. Reporter self-resolution

Already gathered via `slack_read_thread`. Look for reporter's own replies containing:

- "solved", "resolved", "fixed", "no action needed", "nvm", "my bad"
- A `:done:` reaction from the reporter
- A `:white_check_mark:` reaction

Verify tag: `resolved`.

## 6. Env-specific / local setup

If the message mentions "my machine", "my proxy", "my docker", "my cache" AND no other reporter has confirmed in-thread:

```bash
# Check thread for cross-user confirmations
#   slack_read_thread → count distinct users replying with "same", "repro'd", "+1"
```

Verify tag: `env` if only the reporter is affected.

## 7. Cross-post (X posting)

If the top-level message is just a link + "X posting":

```bash
# Follow the link — use slack_search_public to find the original thread
#   slack_search_public({ query: "<in:channel from:@reporter> <before:date>" })
```

If the original is already ingestable, ingest from the original's permalink. If it's a GitHub issue, prefer linking that GitHub issue to the Linear ticket instead of creating two entries.

Verify tag: `cross-post` with the resolved source permalink.
