# Comprehensive PR Review for ComfyUI Frontend

Review the pull request in `$PR_NUMBER` as a senior engineer would: design, correctness, security, performance and repository conventions, not a lint pass. `.github/workflows/pr-claude-review.yaml` runs this command when a PR gets the `claude-review` label.

## Rules

- Post every finding as its own inline comment on the changed line. Do not post a summary comment.
- `GITHUB_TOKEN` grants `pull-requests: write`. Use `gh api` to post; do not report that you lack permission.
- Comment only on lines the diff adds, changes or removes, and only when you can name a concrete fix.
- Keep comments short. No Markdown headers and no emojis inside a comment.

## 1. Gather context

The workflow provides `PR_NUMBER`, `COMMIT_SHA`, `BASE_SHA` and `REPOSITORY` (`owner/name`), and checks out the PR head with full history.

```bash
gh pr view "$PR_NUMBER" --json title,body,files,additions,deletions
git diff --name-status "$BASE_SHA...$COMMIT_SHA"
git diff "$BASE_SHA...$COMMIT_SHA"
```

## 2. Load the repository's standards

These files are the review criteria. Read them before judging the diff, and cite them in comments instead of restating general advice.

1. Root `AGENTS.md`, and every `AGENTS.md` in a directory the diff touches (for example `src/AGENTS.md`, `browser_tests/AGENTS.md`, `.github/AGENTS.md`).
2. The `docs/guidance/*.md` files for the changed file types: `typescript.md`, `vue-components.md`, `state-and-effects.md`, `error-handling.md`, `testing-principles.md`, `vitest.md`, `playwright.md`, `storybook.md`.
3. Accepted ADRs in `docs/adr/` that govern the changed area.
4. The review lenses in `.agents/checks/*.md`. Each file's frontmatter `description` says what it checks. Apply the lenses that match the diff, such as `bug-hunter`, `architecture-reviewer`, `security-auditor`, `performance-profiler`, `vue-patterns`, `error-handling`, `test-quality`, `pattern-compliance`, `adr-compliance`, `api-contract` and `ecosystem-compat`. Skip lenses that run external tools you do not have.

## 3. Review the diff

Beyond the lenses, check these repository-specific points, all from root `AGENTS.md`:

- **Comments.** Any comment added by the diff, other than curt JSDoc on an exported API, is a finding. Tool directives such as `eslint-disable-next-line` or `@vitest-environment` are not comments; the Suppressions rule below judges them. Run the `comment-sicko` skill (`.claude/skills/comment-sicko/SKILL.md`) and fold its triaged findings into this review.
- **Suppressions.** Search added lines for `eslint-disable`, `oxlint-disable`, `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error`, `as any`, double assertions and non-null assertions. Request changes for every `@ts-ignore`, `@ts-nocheck` and `as any`, for `@ts-expect-error` outside a test that verifies a compiler error, and for file-wide or multi-rule lint disables. Accept a narrow exception only when the PR description names an external constraint you can verify, and say what you verified.
- **Server and API types.** A hand-declared response type that duplicates one from `@comfyorg/ingest-types` or `@comfyorg/registry-types` is a finding.
- **Server facts.** A gate that derives a server fact on the client is a finding (`docs/adr/API-SERVER-FACTS-0042-server-facts-are-rendered-not-derived.md`).
- **Libraries.** Flag reimplementations of `es-toolkit`, VueUse, `@comfyorg/design-system` components, `cn()` from `@comfyorg/tailwind-utils`, and `DOMPurify`. PrimeVue imports are banned. Use Tailwind 4 semantic theme tokens, not `dark:` variants or `!important`.
- **Entity architecture.** New methods on `LGraphNode`, `LGraphCanvas`, `LGraph` or `Subgraph`, or changes to extension-facing callbacks without migration guidance, are findings.
- **Tests.** A bug fix needs a regression test; a behavioral change needs its contract tested. Judge tests against `docs/guidance/testing-principles.md`.

Consider the PR type: a feature needs tests and backward compatibility, a bug fix needs its root cause addressed, and a refactor must preserve behavior.

## 4. Post inline comments

Use this body format:

```text
**[category] severity Priority**

**Issue**: what is wrong
**Context**: why it matters, citing the guidance file or ADR
**Suggestion**: the smallest fix
```

Categories: `architecture`, `security`, `performance`, `quality`. Severities: `critical`, `high`, `medium`, `low`.

Build the body in a shell variable with real newlines, then post one comment per finding as a single command line:

```bash
COMMENT_BODY="**[quality] medium Priority**

**Issue**: Hand-declared response type duplicates the generated one
**Context**: docs/guidance/typescript.md: hand-declared copies drift from the API contract
**Suggestion**: Import the type from @comfyorg/ingest-types"

gh api --method POST -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" "/repos/$REPOSITORY/pulls/$PR_NUMBER/comments" -f body="$COMMENT_BODY" -f commit_id="$COMMIT_SHA" -f path="src/path/to/file.ts" -F line=42 -f side="RIGHT"
```

`line` must be inside a diff hunk. For an added or changed line, use `side="RIGHT"` and the line number in the new version of the file. For a removed line, use `side="LEFT"` and the line number in the old version.
