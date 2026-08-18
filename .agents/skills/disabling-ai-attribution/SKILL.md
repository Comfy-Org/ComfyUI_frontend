---
name: disabling-ai-attribution
description: Disables commit, pull request, and session attribution in contributors' local Claude Code and Amp settings, and checks Codex workspace policy. Use when configuring an AI coding tool to avoid attribution in repository history.
---

# Disabling AI attribution

Update the contributor's user-level settings without changing repository files
outside this skill. Preserve every unrelated setting.

## Workflow

### 1. Inspect before editing

Find the existing user settings files. Expand `~` using the current user's home
directory.

- Claude Code: `~/.claude/settings.json`
- Amp: `~/.config/amp/settings.json` or `settings.jsonc`
- Codex: `~/.codex/config.toml`

If both Amp files exist, stop and ask which one to update. If a settings file is
malformed, report the parse error instead of replacing it.

### 2. Update Claude Code

Merge this object into `~/.claude/settings.json`:

```json
{
  "attribution": {
    "commit": "",
    "pr": "",
    "sessionUrl": false
  }
}
```

Create the directory and file when missing. Preserve other keys inside
`attribution` and elsewhere in the file.

### 3. Update Amp

Set these top-level keys in the existing Amp settings file:

```json
{
  "amp.git.commit.ampThread.enabled": false,
  "amp.git.commit.coauthor.enabled": false
}
```

Create `~/.config/amp/settings.json` when neither supported file exists. Preserve
comments when updating `settings.jsonc`.

### 4. Check Codex

Do not add `commit_attribution` or `features.codex_git_commit` to Codex config.
Current Codex versions removed those local controls. Attribution is determined
by the authenticated workspace's `commit_attribution_enabled` policy.

Report whether Codex is installed. If it is, explain that the contributor or a
workspace administrator must disable commit attribution in the Codex workspace
settings. Do not claim Codex attribution is disabled from a local file change.

### 5. Verify

Parse the updated JSON or JSONC files and read back the exact keys. If the tool
is installed, run a non-mutating command such as `amp --help` or
`claude --version` to catch settings-load errors.

Report each tool as updated, already configured, unavailable, or requiring a
workspace setting. Never print unrelated settings, tokens, or credentials.

## References

- [Claude Code attribution settings](https://code.claude.com/docs/en/settings#attribution-settings)
- [Amp configuration](https://ampcode.com/manual#configuration)
- [Codex configuration reference](https://developers.openai.com/codex/config-reference)
