---
name: ecosystem-compat
description: Checks whether changes break exported symbols that downstream consumers may depend on
severity-default: high
tools: [Grep, Read, glob, mcp__comfy_codesearch__search_code]
---

Check whether this PR introduces breaking changes to exported symbols that downstream consumers may depend on.

## What to Check

- Renamed or removed exported functions/classes/types
- Changed function signatures (parameters added/removed/reordered)
- Changed return types
- Removed or renamed CSS classes used for selectors
- Changed event names or event payload shapes
- Changed global registrations or extension hooks
- Modified integration points with external systems

## Method

1. Read the diff and identify any changes to exported symbols.
2. For each potentially breaking change, try to determine if downstream consumers exist:
   - If `mcp__comfy_codesearch__search_code` is available, search for usages of the changed symbol across downstream repositories.
   - Otherwise, use `Grep` to search for usages within the current repository and note that external usage could not be verified.
3. If consumers are found using the changed API, report it as a finding.

## Severity Guidelines

| Ecosystem Usage | Severity | Guidance                                                     |
| --------------- | -------- | ------------------------------------------------------------ |
| 5+ consumers    | critical | Must address before merge                                    |
| 2-4 consumers   | high     | Should address or document                                   |
| 1 consumer      | medium   | Note in PR, author decides                                   |
| 0 consumers     | low      | Note potential risk only                                     |
| Unknown usage   | medium   | Require explicit note that external usage was not verifiable |

## Suggestion Template

When a breaking change is found, suggest:

- Keeping the old export alongside the new one
- Adding a deprecation wrapper
- Explicitly noting this as a breaking change in the PR description so consumers can update

## ComfyUI Code Search MCP

This check works best with the ComfyUI code search MCP tool, which searches across all custom node repositories for usage of changed symbols.

If the `mcp__comfy_codesearch__search_code` tool is not available, install it:

```
amp mcp add comfy-codesearch https://comfy-codesearch.vercel.app/api/mcp
# OR for Claude Code:
claude mcp add -t http comfy-codesearch https://comfy-codesearch.vercel.app/api/mcp
```

Without this MCP, the check will fall back to searching within the current repository only, and cannot verify external ecosystem usage.
