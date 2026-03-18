# PR Review Context

Context for automated PR review system.

## Review Scope

This automated review performs comprehensive analysis:

- Architecture and design patterns
- Security vulnerabilities
- Performance implications
- Code quality and maintainability
- Integration concerns

For implementation details, see `.claude/commands/comprehensive-pr-review.md`.

## GitHub Actions: Fork PR Permissions

Fork PRs get a **read-only `GITHUB_TOKEN`** — no PR comments, no secret access, no pushing.

Any workflow that needs write access must use the **two-workflow split**: a `pull_request`-triggered `ci-*.yaml` uploads artifacts (including PR metadata), then a `workflow_run`-triggered `pr-*.yaml` downloads them and posts comments with write permissions. See `ci-size-data` → `pr-size-report` or `ci-perf-report` → `pr-perf-report`. Use `.github/actions/post-pr-report-comment` for the comment step.

Never write PR comments directly from `pull_request` workflows or use `pull_request_target` to run untrusted code.
