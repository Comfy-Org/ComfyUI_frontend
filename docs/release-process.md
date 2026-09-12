# Release Process

## Bump Types

All releases use `release-version-bump.yaml`. Effects differ by bump type:

| Bump       | Target     | Creates branches?                     | GitHub release               |
| ---------- | ---------- | ------------------------------------- | ---------------------------- |
| Minor      | `main`     | `core/` + `cloud/` for previous minor | Published, "latest"          |
| Patch      | `main`     | No                                    | Published, "latest"          |
| Patch      | `core/X.Y` | No                                    | **Draft** (uncheck "latest") |
| Prerelease | any        | No                                    | Draft + prerelease           |

## Generated API types on release branches

Never hand-edit files under `packages/ingest-types/src`, including in a
backport. The Cloud repository owns the source OpenAPI contract and generates
the frontend package for `main` and every active `cloud/x.y` line named in its
`frontend-version.json`. A release branch must accept that generated contract
or a newer one; unrelated generated changes are expected when a release line
has fallen behind.

If a backport needs a generated type, update the Cloud OpenAPI source and use
the typegen automation. Do not copy or recreate one declaration in a generated
file.

**Minor bump** (e.g. 1.41→1.42): freezes the previous minor into `core/1.41`
and `cloud/1.41`, branched from the commit _before_ the bump. Nightly patch
bumps on `main` are convenience snapshots — no branches created.

The minor bump is scheduled automatically: `release-version-bump.yaml` runs a
**minor** bump on `main` every Monday 20:00 UTC and enables auto-merge on the
resulting `version-bump-*` PR (marked with the `weekly-release-cut` label, which
exempts it from the nightly stale-PR closer), so once its checks pass the merge
triggers `release-branch-create.yaml` and the `core/` + `cloud/` cut is
hands-off. The separate nightly `0 0 * * *` cron stays a **patch** bump.

**Patch on `core/X.Y`**: publishes a hotfix draft release. Must not be marked
"latest" so `main` stays current.

### Dual-homed commits

When a minor bump happens, unreleased commits appear in both places:

```
v1.40.1 ── A ── B ── C ── [bump to 1.41.0]
                │
                └── core/1.40
```

A, B, C become v1.41.0 on `main` AND sit on `core/1.40` (where they could
later ship as v1.40.2). Same commits, no divergence — the branch just prevents
1.41+ features from mixing in so ComfyUI can stay on 1.40.x.

## Backporting

1. Add `needs-backport` + version label to the merged PR
2. `pr-backport.yaml` cherry-picks and creates a backport PR
3. Conflicts produce a comment with details and an agent prompt

## Release Sheriff Assignment

`pr-assign-release-sheriff.yaml` assigns the on-call release sheriff to any
open PR that has no assignee and is either:

- a backport (label `backport`, or a `[backport ...]` title);
- a release version bump (label `Release`, or a `version-bump-<version>`
  branch);
- opened by automation — `dependabot`, `comfy-pr-bot`, or `cloud-code-bot`.

It also requests their review, since backport merges are gated on an approval.
Existing assignees and review requests are never overwritten.

When the sheriff wrote the PR themselves, the review is requested from the
**next person in the rotation** instead — GitHub rejects a self-review request,
so previously those PRs were assigned to their own author with nobody asked to
review, and then waited on an approval that had never been requested. The order
comes from the Datadog layer's member list, so it needs no separate config. If
nobody in the rotation can stand in, the run says so rather than staying quiet.

Automation-authored PRs are included because nobody feels addressed by what a
robot opens: they accumulated unassigned for weeks. Note these are matched by
author rather than by content, so a dependency bump counts as sheriff work.

It runs on PR events and hourly. Bot PRs are picked up by the hourly sweep
rather than on open — the `pull_request_target` gate matches labels, titles and
branches, and teaching it about bot logins would duplicate the author list in a
second syntax (the webhook says `dependabot[bot]` where `gh` says
`app/dependabot`), which would drift.

The rotation itself lives in Datadog On-Call ("Frontend Team – Oncall
Schedule", layer "Release Sheriff") and is read at execution time, so handovers
need no commit.

### Mapping a Datadog user to a GitHub login

Datadog exposes no GitHub identity, and GitHub only resolves commit emails its
users chose to publish, so the two have to be bridged explicitly. That bridge is
the repo **secret** `RELEASE_SHERIFF_DIRECTORY`, a JSON array read straight from
the environment by `parseGithubLogins`:

```json
[{ "datadog_email": "ben@comfy.org", "github_login": "benceruleanlu" }]
```

Entries are keyed by the email's local part, lower-cased; GitHub logins are
case-insensitive, so the login's own case does not matter. Unknown fields are
ignored, so the file can carry more than this script needs.

The secret's source of truth is `rosters/release-sheriff-directory.json` in the
private repo **`Comfy-Org/github-workflows-ops`**. Adding someone to the rotation
is therefore two steps: add them to the Datadog layer, and open a PR adding their
entry to that file, then run that repo's sync script to push the file into this
repo's secret. The file is out of this repo because this repo is public, and it
is in a repo rather than a Datadog field so a change is reviewed.

It has to be a **secret**, never an Actions variable: Actions prints a step's
`env:` block before the step runs and this repo's run logs are public, so a
variable would publish the whole map. Secret values are masked.

It used to live on the Datadog schedule as `github:<user>:<login>` tags, and the
`PUT` full-replace trap described below is why it no longer does: one
tags-unaware rotation edit deleted every entry at once. Those tags are now
vestigial and can be deleted from the schedule.

### Editing the schedule over the API

Rotation membership and order are normally edited in the on-call UI. The
scripted procedure below is scoped to **tags-only edits** (e.g. deleting the
vestigial `github:<user>:<login>` tags after the directory moved to a secret):
its guard aborts unless every field except `tags` matches the original. A
broader runbook that safely scripts rotation membership changes is tracked as a
follow-up; until then, use the UI for those. Note that
**`PUT /api/v2/on-call/schedules/{id}` is a full replace** — `PATCH` answers
`{"errors":["Not found"]}` even for a schedule that `GET` returns fine — so read
the schedule first and edit what comes back rather than composing a body by
hand. Any field the body omits is wiped, the call returns 200, and nothing
warns.

The workflow's `DATADOG_APP_KEY` repo secret must remain read-only with the
`on_call_read` permission. A manual `PUT` requires a separate local application
key with `on_call_write`; export it as `DATADOG_WRITE_APP_KEY`, and never widen
or reuse the CI secret for this destructive operation.

`PUT` is a full replace, so read the schedule first and edit what comes back
rather than composing a body by hand. Save the following block as a script and
run the saved file with Bash; do not paste it into an interactive shell, where
queued input could satisfy its confirmation prompts:

`EDITOR` must contain one executable path that blocks until the file closes.
For an editor that needs arguments, such as `code -w`, create a blocking wrapper
script and set `EDITOR` to that wrapper's path.

```bash
set -euo pipefail
umask 077

BASE=https://api.us5.datadoghq.com/api/v2/on-call/schedules
SCHEDULE_ID=f3258942-c040-4c33-8228-63a03e9092d6
WORK_DIR=$(mktemp -d "${TMPDIR:-/tmp}/release-sheriff.XXXXXX")
trap 'rm -rf "$WORK_DIR"' EXIT
READ_CONFIG="$WORK_DIR/read.curl"
WRITE_CONFIG="$WORK_DIR/write.curl"
PUT_FILTER="$WORK_DIR/to-put.jq"
printf 'header = "DD-API-KEY: %s"\nheader = "DD-APPLICATION-KEY: %s"\n' \
  "$DATADOG_API_KEY" "$DATADOG_APP_KEY" >"$READ_CONFIG"
printf 'header = "DD-API-KEY: %s"\nheader = "DD-APPLICATION-KEY: %s"\n' \
  "$DATADOG_API_KEY" "$DATADOG_WRITE_APP_KEY" >"$WRITE_CONFIG"

read -r -p 'Confirm a schedule change freeze is active? [y/N] ' CONFIRM_FREEZE
test "$CONFIRM_FREEZE" = y

cat >"$PUT_FILTER" <<'JQ'
  def included($response; $type; $id):
    [$response.included[] | select(.type == $type and .id == $id)]
    | if length == 1 then .[0]
      else error("expected exactly one included \($type) resource with id \($id)")
      end;

  . as $response
  | .data as $schedule
  | {
      data: {
        id: $schedule.id,
        type: $schedule.type,
        attributes: (
          $schedule.attributes
          | .layers = [
              $schedule.relationships.layers.data[] as $layer_ref
              | included($response; "layers"; $layer_ref.id)
              | . as $layer
              | $layer.attributes + {
                  id: $layer.id,
                  members: [
                    $layer.relationships.members.data[] as $member_ref
                    | included($response; "members"; $member_ref.id)
                    | .relationships.user.data.id as $user_id
                    | if ($user_id | type == "string" and length > 0)
                      then {user: {id: $user_id}}
                      else error("member \($member_ref.id) has no user id")
                      end
                  ]
                }
            ]
        ),
        relationships: {teams: $schedule.relationships.teams}
      }
    }
JQ

curl --fail-with-body -sS --config "$READ_CONFIG" \
  "$BASE/$SCHEDULE_ID?include=teams,layers,layers.members,layers.members.user" \
  --output "$WORK_DIR/schedule.response.original.json"
jq -f "$PUT_FILTER" "$WORK_DIR/schedule.response.original.json" \
  >"$WORK_DIR/schedule.put.original.json"
cp "$WORK_DIR/schedule.put.original.json" \
  "$WORK_DIR/schedule.put.edited.json"
"${EDITOR:?Set EDITOR to one blocking executable path}" \
  "$WORK_DIR/schedule.put.edited.json"

curl --fail-with-body -sS --config "$READ_CONFIG" \
  "$BASE/$SCHEDULE_ID?include=teams,layers,layers.members,layers.members.user" \
  --output "$WORK_DIR/schedule.response.latest.json"
jq -f "$PUT_FILTER" "$WORK_DIR/schedule.response.latest.json" \
  >"$WORK_DIR/schedule.put.latest.json"
diff -u "$WORK_DIR/schedule.put.original.json" \
  "$WORK_DIR/schedule.put.latest.json"
diff -u \
  <(jq -S 'del(.data.attributes.tags)' \
    "$WORK_DIR/schedule.put.original.json") \
  <(jq -S 'del(.data.attributes.tags)' \
    "$WORK_DIR/schedule.put.edited.json")
jq -e '.data.attributes.tags | type == "array"' \
  "$WORK_DIR/schedule.put.edited.json" >/dev/null

curl --fail-with-body -sS -X PUT --config "$WRITE_CONFIG" \
  -H 'Content-Type: application/json' \
  "$BASE/$SCHEDULE_ID" -d @"$WORK_DIR/schedule.put.edited.json"
curl --fail-with-body -sS --config "$READ_CONFIG" \
  "$BASE/$SCHEDULE_ID?include=teams,layers,layers.members,layers.members.user" \
  --output "$WORK_DIR/schedule.response.verified.json"
jq -f "$PUT_FILTER" "$WORK_DIR/schedule.response.verified.json" \
  >"$WORK_DIR/schedule.put.verified.json"
diff -u \
  <(jq -S '.data.attributes.tags |= map(ascii_downcase) | .data.attributes.tags |= sort' \
    "$WORK_DIR/schedule.put.edited.json") \
  <(jq -S '.data.attributes.tags |= map(ascii_downcase) | .data.attributes.tags |= sort' \
    "$WORK_DIR/schedule.put.verified.json")
```

The GET response is JSON:API: layers and members live in `included`. The `jq`
step converts them to the PUT shape under `data.attributes.layers` and maps
each member to `{ "user": { "id": "..." } }`. Edit only `tags` in
`$WORK_DIR/schedule.put.edited.json`; the untouched response and transformed
PUT body remain beside it until the shell exits. The conversion preserves the
schedule's `name`, `time_zone`, `tags`, and team references; every layer's
complete attributes and `id`; and member order.

Datadog offers no optimistic-concurrency token for this endpoint. Coordinate an
external change freeze with the other schedule administrators before running
the script and keep it active until verification completes. The confirmation
prompt records that coordination; it is not a lock. Another writer can still
change the schedule between the final `GET` and `PUT`, and that full replacement
would overwrite their update. After the editor closes, the procedure immediately
fetches the schedule again and stops if anything changed. It also stops unless
`tags` is still an array and every other field in the edited body exactly
matches the original. After the write, it reads the complete schedule back and
compares the full stored body with the intended body, normalizing only tag case
and order to match Datadog's behavior.

Although the GitHub mapping no longer depends on tags, preserving the complete
schedule payload remains important: a partial `PUT` can still silently remove
rotation data.

Only `scheduleId`, `datadogSite` and `fallbackGithubLogin` stay in the `CONFIG`
object of `scripts/release-sheriff/release-sheriff.ts`. Note `datadogSite` is
`us5.datadoghq.com` — the Comfy org lives on that sub-domain and the default
`api.datadoghq.com` returns 403.

Requires repo secrets `DATADOG_API_KEY` and `DATADOG_APP_KEY` (scope:
`on_call_read`) plus `RELEASE_SHERIFF_DIRECTORY`. The manual tags-only API
procedure additionally requires a local `DATADOG_WRITE_APP_KEY` scoped to
`on_call_write`; request it from a Datadog organization administrator and never
store it as a repo secret.

If the on-call user cannot be mapped — a missing directory entry, a directory
secret that is absent or not valid JSON, missing Datadog credentials, an
unreachable Datadog — the job still assigns `fallbackGithubLogin` so PRs are
never left unowned, but **exits non-zero** so the degradation is visible. A
green run means a real sheriff was resolved from Datadog.

Directory coverage is checked for the **whole rotation**, not just whoever is on
call, and a member without an entry fails the run. Someone added to the layer
without one otherwise works fine until their own shift begins — the breakage
surfaces weeks after the cause, on whoever happens to be sheriff. This is a
configuration check, so it fails even when today's assignment succeeded.

A failed run also posts to **#frontend-releases** with the reason, because a
failing scheduled workflow otherwise only notifies whoever last pushed to
`main` — in practice nobody, which is how the placeholder config survived for
weeks. Needs the `SLACK_BOT_TOKEN` secret; the post is `continue-on-error`, so
Slack being down never masks the underlying result.

It alerts on the **transition** into failure, not on every failing run: the job
runs hourly, so a lasting breakage would otherwise post around the clock until
someone fixed it, and a channel that cries wolf gets muted.

The check walks recent **scheduled** runs and reads the conclusion of the
`Assign release sheriff` **step**, not of the run. A run that died in checkout
failed without ever reaching the sheriff, and treating that as "already
alerted" would swallow the next real failure. Scheduled runs are used because
the `pull_request_target` gate skips most other runs, so they are the ones
dense in runs that decided anything. If the check itself cannot run it fails
open and alerts, since a duplicate beats a silence.

Only scheduled runs **alert**, for the same reason: a run can recognise a
duplicate only within the history it reads, so the runs that post have to be
the runs that get read back. While the two sets differed, every PR-triggered
failure was invisible to every other one — five posts in nine minutes when a
rotation member turned up without a GitHub login. PR-triggered runs still go
red on the PR itself; the alert rides the hourly sweep instead, so a new
breakage is announced within the hour rather than on the spot.

## Publishing

Merged PRs with the `Release` label trigger `release-draft-create.yaml`,
publishing to GitHub Releases (`dist.zip`), PyPI (`comfyui-frontend-package`),
and npm (`@comfyorg/comfyui-frontend-types`).

## Weekly ComfyUI Integration

`release-weekly-comfyui.yaml` runs every Monday — if the next `core/`
branch has unreleased commits, it triggers a patch bump and drafts a PR to
`Comfy-Org/ComfyUI` updating `requirements.txt`.

## Workflows

| Workflow                         | Purpose                                            |
| -------------------------------- | -------------------------------------------------- |
| `release-version-bump.yaml`      | Bump version, create Release PR                    |
| `release-draft-create.yaml`      | Build + publish to GitHub/PyPI/npm                 |
| `release-branch-create.yaml`     | Create `core/` + `cloud/` branches (minor/major)   |
| `release-weekly-comfyui.yaml`    | Weekly auto-patch + ComfyUI requirements PR        |
| `pr-backport.yaml`               | Cherry-pick fixes to stable branches               |
| `cloud-backport-tag.yaml`        | Tag cloud branch merges                            |
| `pr-assign-release-sheriff.yaml` | Assign on-call sheriff to backport/release/bot PRs |
