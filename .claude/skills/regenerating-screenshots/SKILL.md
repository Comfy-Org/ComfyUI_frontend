---
name: regenerating-screenshots
description: 'Creates a PR to regenerate Playwright screenshot expectations. Use when screenshot tests are failing on main or PRs due to stale golden images. Triggers on: regen screenshots, regenerate screenshots, update expectations, fix screenshot tests.'
---

# Regenerating Playwright Screenshot Expectations

Automates the process of triggering the `PR: Update Playwright Expectations`
GitHub Action by creating a PR from `origin/main` and requesting a full rerun.

## Steps

1. **Fetch latest main**

   ```bash
   git fetch origin main
   ```

2. **Create a timestamped branch** from `origin/main`

   Format: `regen-screenshots/YYYY-MM-DDTHH` (hour resolution, local time)

   ```bash
   git checkout -b regen-screenshots/<datetime> origin/main
   ```

3. **Create an empty commit**

   ```bash
   git commit --allow-empty -m "test: regenerate screenshot expectations"
   ```

4. **Push the branch**

   ```bash
   git push origin regen-screenshots/<datetime>
   ```

5. **Generate a poem** about regenerating screenshots. Be creative — a
   new, unique poem every time. Short (4–8 lines). Can be funny, wistful,
   epic, haiku-style, limerick, sonnet fragment — vary the form.

6. **Create the PR** with the poem as the body.

   Write the poem to a temp file and use `--body-file`:

   ```bash
   # Write poem to temp file
   # Create PR:
   gh pr create \
     --base main \
     --head regen-screenshots/<datetime> \
     --title "test: regenerate screenshot expectations" \
     --body-file <temp-file>
   ```

7. **Request the full rerun** with a comment on the PR. The path filter
   skips the Playwright jobs of an empty-commit PR, so there are no failed
   screenshots to take from its E2E run.

   ```bash
   gh pr comment <pr-number> --body '/update-playwright full'
   ```

8. **Report the result** to the user:
   - PR URL
   - Branch name
   - Note that the GitHub Action will run automatically and commit
     updated screenshots to the branch.

## Notes

- The `/update-playwright full` comment triggers the
  `pr-update-playwright-expectations.yaml` workflow, which runs Playwright
  with `--update-snapshots` and commits the results back to the PR branch.
- On a PR whose E2E run has screenshot diffs, the
  `New Browser Test Expectations` label or a plain `/update-playwright`
  comment commits the images from that run instead of rerunning Playwright.
- This is fire-and-forget — no need to wait for or monitor the Action.
- Always return to the original branch/worktree state after pushing.
