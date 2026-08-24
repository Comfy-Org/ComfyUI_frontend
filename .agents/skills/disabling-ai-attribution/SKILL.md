---
name: disabling-ai-attribution
description: Disables commit, pull request, and session attribution in contributors' local Claude Code and Amp settings, and checks Codex workspace policy. Use when configuring an AI coding tool to avoid attribution in repository history.
---

# Disabling AI attribution

Update the contributor's user-level settings through the repository's settings
helper. Never read or print the settings files directly.

## Workflow

### 1. Run the settings helper

Run:

```bash
pnpm exec tsx scripts/skills/update-ai-attribution.ts
```

The helper updates only the Claude Code and Amp attribution keys. It preserves
all other values and JSONC comments. Its output contains status labels only,
never configuration values. Do not replace this command with file reads or
direct edits.

### 2. Handle the result

Report each status from the helper. If it reports an error, relay the error and
stop. Do not inspect the settings file to diagnose it.

Codex reports `workspace setting required` because current versions removed the
local attribution controls. The contributor or a workspace administrator must
disable commit attribution in the Codex workspace settings. Do not add
`commit_attribution` or `features.codex_git_commit` to Codex config.

### 3. Verify

Run the helper a second time. Claude Code and Amp should report
`already configured`. Do not open their settings files to verify the result.

## References

- [Claude Code attribution settings](https://code.claude.com/docs/en/settings#attribution-settings)
- [Amp configuration](https://ampcode.com/manual#configuration)
- [Codex configuration reference](https://developers.openai.com/codex/config-reference)
