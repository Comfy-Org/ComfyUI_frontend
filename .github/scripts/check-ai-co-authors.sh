#!/usr/bin/env bash
# Checks pull request commits for AI agent attribution.
#
# Two distinct sources, both of which land on the squash commit:
#   1. Co-authored-by trailers written into the commit message.
#   2. The commit *author* identity. GitHub regenerates Co-authored-by trailers
#      from the authors of the squashed commits at merge time, so an AI-authored
#      commit puts the trailer back even when the message is spotless. Checking
#      messages alone passes a branch whose merge reintroduces exactly what this
#      check exists to prevent.
# Exits non-zero when either is found and prints fix instructions.
set -euo pipefail

base_sha="${1:?usage: check-ai-co-authors.sh <base_sha> <head_sha>}"
head_sha="${2:?usage: check-ai-co-authors.sh <base_sha> <head_sha>}"

# Agent display names, matched by name rather than by address. One list drives
# both checks below, so the trailer and identity forms cannot drift apart --
# adding an agent here covers it in both places.
AGENT_NAMES=(
    '[Cc]laude'
    '[Cc]opilot'
    '[Cc]ursor'
    '[Cc]odex'
    '[Gg]emini'
    '[Aa]ider'
    '[Dd]evin'
    '[Ww]indsurf'
    '[Cc]line'
    '[Aa]mazon Q'
    '[Jj]ules'
    'OpenCode'
    '[Aa]mp'
)

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
)

# Same names, trailer-shaped. Generated from AGENT_NAMES so the two checks stay
# in step.
for name in "${AGENT_NAMES[@]}"; do
    AGENT_PATTERNS+=("Co-authored-by:.*\\b${name}\\b")
done

# Build a single alternation regex from all patterns.
regex=""
for pattern in "${AGENT_PATTERNS[@]}"; do
    if [[ -n "$regex" ]]; then
        regex="${regex}|${pattern}"
    else
        regex="$pattern"
    fi
done

# Identity-shaped patterns, matched against "author <email>" rather than against
# a Co-authored-by line. These are the ones GitHub turns into trailers on squash.
# Addresses and bot handles. Valid in both a Co-authored-by line and an author
# identity, so they feed both regexes unchanged.
AGENT_IDENTITY_PATTERNS=(
    'noreply@anthropic\.com'
    'claude\[bot\]'
    'amp@ampcode\.com'
    'cursoragent@cursor\.com'
    'copilot-swe-agent\[bot\]'
    'copilot@github\.com'
    'noreply@openai\.com'
    'codex@openai\.com'
    'aider@aider\.chat'
    'gemini@google\.com'
    'jules@google\.com'
    '@codeium\.com'
    'devin-ai-integration\[bot\]'
    'devin@cognition\.ai'
    'devin@cognition-labs\.com'
    'cline-bot'
    'cline@cline\.ai'
    'continue-agent'
    'continue@continue\.dev'
    'noreply@sourcegraph\.com'
)

# An identity renders as "Name <addr>", so anchor the name before the bracket.
for name in "${AGENT_NAMES[@]}"; do
    AGENT_IDENTITY_PATTERNS+=("^[^<]*\\b${name}\\b[^<]*<")
done

identity_regex=""
for pattern in "${AGENT_IDENTITY_PATTERNS[@]}"; do
    if [[ -n "$identity_regex" ]]; then
        identity_regex="${identity_regex}|${pattern}"
    else
        identity_regex="$pattern"
    fi
done

commit_trailers="$(
    git log --format='  %h: %(trailers:key=Co-authored-by,separator=%x09)' \
        "${base_sha}..${head_sha}"
)"
violations="$(grep -iE "$regex" <<<"$commit_trailers" || true)"

# %an/%ae is the author, %cn/%ce the committer. Both feed GitHub's squash
# trailer generation, so both are checked.
commit_identities="$(
    git log --format='  %h: %an <%ae>%n  %h: %cn <%ce>' "${base_sha}..${head_sha}"
)"
identity_violations="$(grep -iE "$identity_regex" <<<"$commit_identities" || true)"

if [[ -n "$identity_violations" ]]; then
    echo "::error::AI agent commit authorship detected in PR commits."
    echo ""
    echo "These commits are authored or committed by an AI coding agent:"
    echo ""
    echo "$identity_violations"
    echo "GitHub regenerates Co-authored-by trailers from commit authorship when it"
    echo "squashes, so removing the trailer from the message is NOT enough here --"
    echo "the trailer comes back on the squash commit."
    echo ""
    echo "To fix, rewrite the authorship as well as the message:"
    echo "  git rebase ${base_sha} --exec 'git commit --amend --no-edit --reset-author'"
    echo ""
    echo "If those commits also carry Co-authored-by trailers for the same agent,"
    echo "remove them in the same pass, otherwise the trailer check below still fails:"
    echo "  git rebase -i ${base_sha}   # mark the commits 'edit', drop the lines,"
    echo "                              # then git commit --amend and git rebase --continue"
    echo ""
    echo "then force-push your branch."
    echo ""
    echo "To prevent future attribution, use the disabling-ai-attribution skill:"
    echo "  https://github.com/Comfy-Org/ComfyUI_frontend/tree/main/.agents/skills/disabling-ai-attribution"
    echo ""
    echo "If you believe this is a false positive, please open an issue."
    exit 1
fi

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

echo "No AI agent Co-authored-by trailers or commit authorship found."
