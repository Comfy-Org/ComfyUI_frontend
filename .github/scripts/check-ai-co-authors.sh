#!/usr/bin/env bash
# Checks pull request commits for AI agent Co-authored-by trailers.
# Exits non-zero when any are found and prints fix instructions.
set -euo pipefail

base_sha="${1:?usage: check-ai-co-authors.sh <base_sha> <head_sha>}"
head_sha="${2:?usage: check-ai-co-authors.sh <base_sha> <head_sha>}"

# Known AI coding-agent trailer patterns (case-insensitive).
# Each entry is an extended-regex fragment matched against Co-authored-by lines.
AGENT_PATTERNS=(
    # Anthropic — Claude Code / Amp
    'noreply@anthropic\.com'
    # Cursor
    'cursoragent@cursor\.com'
    # GitHub Copilot
    'copilot-swe-agent\[bot\]'
    'copilot@github\.com'
    # OpenAI Codex
    'noreply@openai\.com'
    'codex@openai\.com'
    # Aider
    'aider@aider\.chat'
    # Google — Gemini / Jules
    'gemini@google\.com'
    'jules@google\.com'
    # Windsurf / Codeium
    '@codeium\.com'
    # Devin
    'devin-ai-integration\[bot\]'
    'devin@cognition\.ai'
    'devin@cognition-labs\.com'
    # Amazon Q Developer
    'amazon-q-developer'
    '@amazon\.com.*[Qq].[Dd]eveloper'
    # Cline
    'cline-bot'
    'cline@cline\.ai'
    # Continue
    'continue-agent'
    'continue@continue\.dev'
    # Sourcegraph
    'noreply@sourcegraph\.com'
    # Generic catch-alls for common agent name patterns
    'Co-authored-by:.*\b[Cc]laude\b'
    'Co-authored-by:.*\b[Cc]opilot\b'
    'Co-authored-by:.*\b[Cc]ursor\b'
    'Co-authored-by:.*\b[Cc]odex\b'
    'Co-authored-by:.*\b[Gg]emini\b'
    'Co-authored-by:.*\b[Aa]ider\b'
    'Co-authored-by:.*\b[Dd]evin\b'
    'Co-authored-by:.*\b[Ww]indsurf\b'
    'Co-authored-by:.*\b[Cc]line\b'
    'Co-authored-by:.*\b[Aa]mazon Q\b'
    'Co-authored-by:.*\b[Jj]ules\b'
    'Co-authored-by:.*\bOpenCode\b'
)

# Build a single alternation regex from all patterns.
regex=""
for pattern in "${AGENT_PATTERNS[@]}"; do
    if [[ -n "$regex" ]]; then
        regex="${regex}|${pattern}"
    else
        regex="$pattern"
    fi
done

commit_trailers="$(
    git log --format='  %h: %(trailers:key=Co-authored-by,separator=%x09)' \
        "${base_sha}..${head_sha}"
)"
violations="$(grep -iE "$regex" <<<"$commit_trailers" || true)"

if [[ -n "$violations" ]]; then
    echo "::error::AI agent Co-authored-by trailers detected in PR commits."
    echo ""
    echo "The following commits contain Co-authored-by trailers from AI coding agents:"
    echo ""
    echo "$violations"
    echo "These trailers should be removed before merging."
    echo ""
    echo "To fix, rewrite the commit messages with:"
    echo "  git rebase -i ${base_sha}"
    echo ""
    echo "and remove the Co-authored-by lines, then force-push your branch."
    echo ""
    echo "To prevent future attribution, use the disabling-ai-attribution skill:"
    echo "  https://github.com/Comfy-Org/ComfyUI_frontend/tree/main/.agents/skills/disabling-ai-attribution"
    echo ""
    echo "If you believe this is a false positive, please open an issue."
    exit 1
fi

echo "No AI agent Co-authored-by trailers found."
