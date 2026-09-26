# Release QA drafts

`Release: QA Draft` generates a reviewable test plan when a `cloud/X.Y` branch
is created. It also accepts a manual run from `main` for a patched candidate.
It works with the existing release cut workflow and does not require the
twice-weekly schedule change.

## Run inputs

- `target`: candidate release branch or full commit SHA.
- `base`: previously shipped ref or SHA. Leave blank to resolve the production
  `x-frontend-version` header. An unavailable or unresolvable header fails the
  run; retry with an explicit base after checking the deployed version.
- `environment`: `testcloud` or `stagingcloud`.

Branch inputs resolve to immutable SHAs before generation. The candidate's
`package.json` supplies the version; a minor cut freezes the outgoing minor,
so the next version on `main` must not be used for this plan. A branch creation
captures that event's commit even if the branch advances before the job starts.

## Outputs and review

The run uploads a 30-day artifact containing the Markdown plan, resolved release
context, and commit delta. The delta excludes patch-equivalent commits already
on the base side. The plan must retain its base/target SHAs, flag setup, test
cases and unchecked review section. These checks verify structure, not the
correctness or completeness of generated cases.

The workflow uses Christian Byrne's
[release-test-plan skill](https://github.com/christian-byrne/comfy-skills/tree/6b821c5ddc04527e83b5fd88e7e9ebccd3c438bc/skills/release-test-plan)
and its companion PR test-plan skill at a pinned revision. Updating the pin
requires reviewing both skills. Generation can edit only the draft through
its file tools; it has read-only GitHub access and no Notion publishing tools.

A separate job posts the artifact link, candidate and proposed environment to
`#frontend-releases`. This is a review request, not a QA handoff. The sheriff
must confirm scope, flag ON/OFF setup, deployed SHA, login/checkout smoke,
QA owner and results deadline before sharing the approved plan with QA.
Unknown flag setup remains `NEEDS CONFIRMATION` rather than becoming an
invented query-string override.

Deployment remains separate. A generated plan never proves the candidate is
running on the proposed environment, and a green draft job never implies
smoke tests passed. Rerun for an updated target after a patch and review the
new delta before handoff. Manual reruns can send another review notification.

## Configuration

- Repository secret `ANTHROPIC_API_KEY` for the existing Claude action.
- Repository secret `SLACK_BOT_TOKEN`, with access to the release channel.
- Actions variable `SLACK_FRONTEND_RELEASES_CHANNEL_ID` for that channel.
- The release branch must be created with the existing release PAT so its
  creation can trigger another workflow. A plain `GITHUB_TOKEN` push does not.

Slack credentials are available only to the notification job. The generation
job does not run candidate code. Generation failures produce no ready message;
a failed Slack step leaves the artifact available in the workflow run.
The deterministic collector supplies per-commit patches and referenced PR
metadata. The model has file tools only, with shell execution disabled; missing
backport provenance is left as a review question instead of expanding its access.
