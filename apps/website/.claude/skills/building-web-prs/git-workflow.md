# Git and CI hints for website pull requests

Read this when a push is rejected, a check fails, or a pull request will not
merge. Each entry gives the symptom, the cause in this repository, and the fix
you can carry out alone. The last section lists what only a person can do.
Verify the symptom with `gh` or `git` before applying a fix; these hints
describe the repository as read on 2026-09-17 and a workflow may have changed.

## What `main` requires

`main` accepts squash merges only, through a merge queue. A change under
`apps/website/**` needs one approval from the `comfy_frontend_devs` team and
one from the `comfy_website_devs` team, and every push dismisses the approvals
already given, so the last push comes before the last approval. Read
`reviewDecision` and `mergeStateStatus` from `gh pr view <number>` rather than
counting approvals yourself; `APPROVED` and `CLEAN` together mean GitHub is
satisfied. Read the required checks from `gh pr checks <number> --required`,
which reflects every active ruleset; on 2026-09-17 they were `test`,
`lint-and-format`, `e2e-status`, `website-e2e`, and `cla-assistant`. Fix a red
check that is not required anyway, because reviewers read the whole list. A "changes requested" review
from CodeRabbit blocks the merge like a human one; the section "CodeRabbit is
blocking" below says how to lift it.

Never push to `main`. The merge decision belongs to whichever skill is
running: `building-web-prs` never merges or queues a pull request, and `fixing-web-prs` sends one
to the queue only when every line of its merge gate holds. The approval is
always a person's.

## CodeRabbit is blocking

`.coderabbit.yaml` sets `request_changes_workflow: true`, so CodeRabbit posts a
"changes requested" review that blocks the merge, and withdraws it only after
it has looked again. Fixing the code is not enough by itself: CodeRabbit pauses
after several quick pushes, skips a review it could not recover, and then the
old block stands on a branch that no longer has the problem.

Find the block by reading the latest review from `coderabbitai` with
`gh pr view <number> --json latestReviews,reviewDecision`. When it stands at
"changes requested", do these in order, once per push:

1. Deal with every open CodeRabbit thread first: fix it or rebut it with
   evidence, reply in the thread, and resolve it. A re-review requested while
   its threads are open returns the same block.
2. Push, and wait until the `CodeRabbit` check on the new commit has finished.
   It often re-reviews on the push alone and approves, as it did on PR 17373.
3. Read the review state again. When the block still stands and no CodeRabbit
   thread is open, comment `@coderabbitai review` on the pull request. When its
   summary comment says "Reviews paused", comment `@coderabbitai resume`
   instead. When it says "Review skipped" or that it could not recover the
   incremental review, comment `@coderabbitai full review`.
4. Wait for its reply and read the state once more. The block is lifted when
   its latest review reads approved or dismissed and `reviewDecision` is no
   longer `CHANGES_REQUESTED`. New findings in that review are a new round:
   return to step 1.

Ask for a review once per push, never twice in a row on the same commit. When
two requests on two commits leave the block standing with nothing open, stop
and escalate with the pull request link and both request comments. Never
dismiss its review yourself, and never ask it to approve; ask it to review.

## Before the first commit

- Run `pnpm install` at the repository root once. The pre-commit hook runs
  the checks that apply to each staged file's type (`lint-staged.config.ts`:
  code and Astro files get lint, format, and the website typecheck; Markdown
  is only formatted; CSS is only linted), and the pre-push hook runs
  `pnpm knip`. A green hook on a docs-only commit says nothing about the
  typecheck. Both hooks fail with confusing errors when dependencies are
  missing. A `[WARN] Unsupported engine` line is not a failure.
- Name the branch for the request, such as `website/pricing-hero-copy`.
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
tool. The checker is `.github/scripts/check-ai-co-authors.sh`; it recognises
Claude, Codex, Copilot, Cursor, Gemini, Jules, Aider, Windsurf, Devin, Amazon
Q, Cline, Continue, Sourcegraph, and OpenCode, so read its pattern list before
assuming which line is at fault. Run it locally to see the offending commits:
`bash .github/scripts/check-ai-co-authors.sh origin/main HEAD`. Interactive
rebase does not work in an agent session, so rewrite without it:

```bash
regex="$(sed -n '/^AGENT_PATTERNS=(/,/^)/p' .github/scripts/check-ai-co-authors.sh \
  | grep -oE "^ *'[^']+'" | tr -d " '" | paste -sd'|' -)"
git rebase origin/main --exec "git commit --amend --allow-empty -q -m \"\$(git log -1 --format=%B \
  | grep -viE '^claude-session:' | grep -viE '^co-authored-by:.*($regex)')\""
bash .github/scripts/check-ai-co-authors.sh origin/main HEAD
git push --force-with-lease
```

The filter is built from the checker's own pattern list, so it removes exactly
the trailers the checker rejects and nothing else: a human at a vendor
address such as `alice@google.com` survives, because the checker accepts it.
The rebase replays the branch on `main` and drops earlier "Merge branch
'main'" commits, which is fine because `main` squashes. Push only after the
checker prints "No AI agent Co-authored-by trailers found". Then check that the repository's root
`.claude/settings.json` still empties `attribution.commit`, since that is what
stops the next trailer.

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

`review-loop.md` holds the list and the message format. Two more that show up
as CI or tooling symptoms: `gh` reporting it is not logged in, or a push
denied for permissions, means the designer needs repository access from an
engineer; a label you lack permission to add is a request to a maintainer.
