# Git and CI hints for website pull requests

Read this when a push is rejected, a check fails, or a pull request will not
merge. Each entry gives the symptom, the cause in this repository, and the fix
you can carry out alone. The last section lists what only a person can do.
Verify the symptom with `gh` or `git` before applying a fix; these hints
describe the repository as read on 2026-09-17 and a workflow may have changed.

## What `main` requires

`main` accepts squash merges only, through a merge queue, with one approving
review. The required checks are `test`, `lint-and-format`, `e2e-status`, and
`website-e2e`. Every other check is advisory, but fix a red advisory check
anyway, because reviewers read the whole list. A "changes requested" review
from CodeRabbit blocks the merge like a human one; it lifts when CodeRabbit
re-reviews after its threads are fixed or answered (it approved PR 17373 that
way). Comment `@coderabbitai review` when it has paused itself, which it does
after several quick pushes.

Never push to `main`. The `task` skill never merges or queues a pull request.
The `fix-it` skill may send one to the queue, and only when every line of its
merge gate holds.

## Before the first commit

- Run `pnpm install` at the repository root once. The pre-commit hook runs
  lint, format, and the website typecheck on staged files, and the pre-push hook
  runs `pnpm knip`; both fail with confusing errors when dependencies are
  missing. A `[WARN] Unsupported engine` line is not a failure.
- Name the branch for the request, such as `website/pricing-hero-copy`. Branches
  starting `wip/`, `draft/`, or `temp/` skip the website checks, and branches
  starting `core/` or `cloud/` get no preview deployment.
- A hook failure is a real finding. Fix what it reports. `--no-verify` is
  banned here.

## Push rejected

- "Updates were rejected because the remote contains work that you do not
  have": the `lint-and-format` check commits its own fixes to your branch under
  the message "[automated] Apply ESLint and Oxfmt fixes", and the screenshot
  workflow commits new baselines. Run `git pull --rebase origin <branch>` and
  push again. Pull before starting each new round of edits so this never
  happens mid-change.
- Use `git push --force-with-lease` only on your own task branch, and only
  after you rewrote its commits on purpose (the trailer fix below). Never force
  push a branch someone else has committed to; check `git log --format='%an'`
  first.

## `Check for AI agent co-author trailers` is red

A commit message on the branch carries a `Co-authored-by` line naming an AI
tool. Find it with
`git log --format='%h %(trailers:key=Co-authored-by)' origin/main..HEAD`.
Interactive rebase does not work in an agent session, so rewrite without it:

```bash
git rebase origin/main --exec \
  'git commit --amend -q -m "$(git log -1 --format=%B | grep -viE "^(co-authored-by:.*(claude|anthropic)|claude-session:)")"'
git push --force-with-lease
```

This replays the branch on `main` and drops earlier "Merge branch 'main'"
commits, which is fine because `main` squashes. Confirm the first command's
output list is empty afterwards. Then check that
`apps/website/.claude/settings.json` exists, since its absence is how the
trailer got there.

## The branch is behind or conflicts with `main`

- Behind with no conflict: `git fetch origin && git rebase origin/main`, run
  the website checks, push with `--force-with-lease`. Do this once per round at
  most. PR 17373 collected five "Merge branch 'main'" commits in a week; each one
  re-ran every check and none was needed until the final round.
- Conflict in `pnpm-lock.yaml`: never edit that file by hand. Take `main`'s copy
  (`git checkout origin/main -- pnpm-lock.yaml`), run `pnpm install`, and commit
  the result. The repository also repairs lockfile conflicts on its own after
  `main` changes; pull before assuming you must fix it.
- Conflict in `src/i18n/translations.ts`, `src/config/routes.ts`,
  `public/llms.txt`, or `SiteFooter.vue`: these are lists that every new page
  appends to. Keep both sides' entries.
- Conflict in a file this task did not change: stop and escalate.

## Preview link is missing or stale

The preview deploys only when the pull request changes something under
`apps/website/`, `packages/design-system/`, or `packages/tailwind-utils/`, and
never for a pull request from a fork. The address is
`https://comfy-website-preview-pr-<number>.vercel.app`. When the
`deploy-preview` check is green and the page still shows old work, the alias
step failed; the pull request comment then says "Stable alias update failed"
and carries a one-off address to use instead. A red `deploy-preview` with an
error about a token or a missing secret is a person's job.

## `website-e2e` is red

Open the failing shard's log with `gh run view <run-id> --log-failed` and read
the first failing assertion.

- A test fails to find a button, link, or menu by name: open the built page and
  read the name it really has. PR 17373 waited six days on a test that looked
  for a navigation name the page did not use.
- To reproduce locally, build in production mode first, exactly as
  `e2e/README.md` shows, then run the one spec. If port 4321 is taken, set
  `WEBSITE_E2E_PORT` to a free port.
- Screenshot comparisons fail after an intended visual change: baselines are
  named `*-visual-linux.png` and come from the Linux CI container. Never commit
  baselines generated on a Mac. Comment `/update-website-screenshots` on the
  pull request; the workflow commits fresh baselines to the branch. Pull
  afterwards, look at each changed image, and list them in the description.
- The same test passes on re-run with no code change: re-run once with
  `gh run rerun <run-id> --failed`. A second flake on the same test is an
  escalation with both run links.

## Other red checks

- `lint-and-format`: it usually fixes itself by committing to the branch. When
  it stays red, run `pnpm lint:website:fix` and `pnpm format` and push.
- `website-unit` or `test`: run `pnpm test:unit` inside `apps/website` and fix
  the cause. A missing translation does not fail a test (the site falls back to
  English), so check the `zh-CN` page by eye.
- `build`: run `pnpm --filter @comfyorg/website build` and fix the first error
  it prints.
- `codecov/patch/website`: new logic has no test. Add a unit test beside the
  file; do not chase the number with a test that asserts nothing.
- `fallow` or the pre-push `knip`: you left an unused export, file, or
  dependency. Remove it, or use it.
- A check red on files outside `apps/website` that this task never touched:
  re-run once, then escalate.

## Only a person can do these

Tell the designer exactly what to click or whom to message, per the skill's
escalation format.

- `CLA Check` is red: the pull request's author must comment, word for word,
  `I have read and agree to the Contributor License Agreement` on the pull
  request. Nobody else can sign for them.
- `gh` says it is not logged in, or a push is denied for permissions: the
  designer needs repository access from an engineer.
- The approving review, the merge, and anything about the merge queue.
- A secret, token, or Vercel setting is missing.
- A label is needed and you lack permission to add it.
