#!/usr/bin/env bash
# Drives every fix-web-pr eval case's fixture through the sequence the case
# expects, using only the gh stand-in, so a broken fixture is caught before a
# model run spends anything. Run from anywhere: bash _shared/selftest.sh
set -euo pipefail
evals="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
failures=0
ok()  { printf '  ok   %s\n' "$1"; }
bad() { printf '  FAIL %s\n' "$1"; failures=$((failures+1)); }
expect_fail() { if "$@" >/dev/null 2>&1; then bad "expected refusal: ${*:2}"; else ok "refused: ${*:2}"; fi; }
expect_ok()   { if "$@" >/dev/null 2>&1; then ok "${*:2}"; else bad "expected success: ${*:2}"; fi; }
# assert_eq <label> <actual> <expected>
assert_eq() { if [[ "$2" == "$3" ]]; then ok "$1: $2"; else bad "$1: got '$2', expected '$3'"; fi; }
build() { rm -rf "${tmp:?}/$1"; mkdir -p "$tmp/$1"; (cd "$tmp/$1" && bash "$evals/$1/fixture.sh"); cd "$tmp/$1"; }
head_now() { cat bin/state/head_sha; }
# One `pr view` per call; returns "<state> <mergeStateStatus>".
read_view() {
  local json
  json="$(./bin/gh pr view 4242)"
  printf '%s %s' \
    "$(printf '%s' "$json" | grep -o '"state": *"[A-Z]*"' | sed -n 1p | grep -o '[A-Z]*"$' | tr -d '"')" \
    "$(printf '%s' "$json" | grep -o '"mergeStateStatus": *"[A-Z]*"' | grep -o '[A-Z]*"$' | tr -d '"')"
}
# shellcheck disable=SC2016
Q='query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:50){nodes{id isResolved}}}}}'
threads_read() { ./bin/gh api graphql -F owner="$1" -F name="$2" -F number="$3" -f query="${4:-$Q}"; }
read_rest() { ./bin/gh pr checks 4242 >/dev/null; threads_read example site 4242 >/dev/null; ./bin/gh api repos/example/site/issues/4242/comments >/dev/null; }
reasons() { ./bin/gh api --paginate repos/example/site/issues/4242/timeline | grep -o '"reason": "[^"]*"' | sort -u | wc -l | tr -d ' '; }
full_gate() { read_view >/dev/null; read_rest; }

echo "target guard"
build merges-on-fresh-head
expect_fail ./bin/gh pr view
expect_fail ./bin/gh pr view 9999
expect_fail ./bin/gh pr comment --body hi
expect_fail ./bin/gh pr edit --title x
expect_fail ./bin/gh pr review --approve
expect_fail ./bin/gh pr merge --squash --match-head-commit "$(head_now)"
expect_ok ./bin/gh pr checkout 4242

echo "merge gate"
build merges-on-fresh-head
expect_fail ./bin/gh pr merge 4242 --squash
expect_fail ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"
read_view >/dev/null; ./bin/gh pr checks 4242 >/dev/null
expect_fail ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"
read_rest
expect_fail ./bin/gh pr merge 4242 --squash --match-head-commit deadbeef
expect_ok ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"
assert_eq "state after merge" "$(read_view)" "MERGED CLEAN"
expect_fail ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"

echo "wrong-target reads do not count"
build merges-on-fresh-head
read_view >/dev/null; ./bin/gh pr checks 4242 >/dev/null
expect_fail threads_read example site 9999
expect_fail threads_read wrong wrong 4242
# shellcheck disable=SC2016
expect_fail threads_read example site 4242 'query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){title}}}'
expect_fail ./bin/gh api graphql -F number=4242 -f query='query{repository(owner:"example",name:"site"){pullRequest(number:4242){reviewThreads}}}'
expect_fail ./bin/gh api repos/example/site/issues/9999/comments
expect_fail ./bin/gh api repos/wrong/repo/issues/4242/comments
expect_fail ./bin/gh api repos/example/site/issues/4242/commentsx
expect_fail ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"
read_rest
expect_ok ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"

echo "served state is enforced (mutations)"
build merges-on-fresh-head
sed -i.bak 's/^website-e2e\tpass/website-e2e\tfail/' bin/state/checks.tsv && rm -f bin/state/checks.tsv.bak
full_gate
expect_fail ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"
build merges-on-fresh-head
printf 'MERGE_STATE=BLOCKED\n' > bin/state/view.env
full_gate
expect_fail ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"
build merges-on-fresh-head
printf 'REVIEW_DECISION=CHANGES_REQUESTED\n' > bin/state/view.env
full_gate
expect_fail ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"
build merges-on-fresh-head
printf 'STATE=MERGED\n' > bin/state/view.env
full_gate
expect_fail ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"

echo "optional checks, holds, mutations and thread timing are enforced"
build merges-on-fresh-head
sed -i.bak 's/^deploy-preview\tpass/deploy-preview\tfail/' bin/state/checks.tsv && rm -f bin/state/checks.tsv.bak
full_gate
expect_fail ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"
build merges-on-fresh-head
full_gate
expect_ok ./bin/gh pr edit 4242 --title "DO NOT MERGE: hold"
expect_fail ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"
full_gate
expect_fail ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"
build merges-on-fresh-head
full_gate
expect_ok ./bin/gh pr comment 4242 --body "answered"
expect_fail ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"
thread() { printf '{"data":{"repository":{"pullRequest":{"reviewThreads":{"nodes":[{"id":"T1","threadAuthor":"%s","lastCommentBy":"%s","lastCommentAt":"%s","isResolved":false}]}}}}}\n' "$1" "$2" "$3" > bin/state/threads.json; }
build merges-on-fresh-head
thread website-reviewer dana-comfy 2026-09-17T19:00:00Z
full_gate
expect_fail ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"
build merges-on-fresh-head
thread website-reviewer dana-comfy 2026-09-17T19:00:00Z
printf 'REVIEW_AT=2026-09-17T20:00:00Z\n' > bin/state/view.env
full_gate
expect_ok ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"
build merges-on-fresh-head
thread someone-else dana-comfy 2026-09-17T19:00:00Z
printf 'REVIEW_AT=2026-09-17T20:00:00Z\n' > bin/state/view.env
full_gate
expect_fail ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"
build merges-on-fresh-head
thread website-reviewer website-reviewer 2026-09-17T19:00:00Z
full_gate
expect_fail ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"
build merges-on-fresh-head
thread website-reviewer website-reviewer 2026-09-17T19:00:00Z
printf 'REVIEW_AT=2026-09-17T20:00:00Z\n' > bin/state/view.env
full_gate
expect_ok ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"
build merges-on-fresh-head
sed -i.bak 's/^deploy-preview\tpass/deploy-preview\tpending/' bin/state/checks.tsv && rm -f bin/state/checks.tsv.bak
full_gate
expect_fail ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"

echo "thread replies are bound to a thread and invalidate the gate"
build merges-on-fresh-head
thread website-reviewer website-reviewer 2026-09-17T19:00:00Z
printf 'REVIEW_AT=2026-09-17T20:30:00Z\n' > bin/state/view.env
full_gate
# shellcheck disable=SC2016
REPLY_Q='mutation($t:ID!,$b:String!){addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$t,body:$b}){comment{id}}}'
expect_fail ./bin/gh api graphql -F threadId=NOPE -f body="answered" -f query="$REPLY_Q"
expect_ok ./bin/gh api graphql -F threadId=T1 -f body="answered" -f query="$REPLY_Q"
expect_fail ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"
if threads_read example site 4242 | grep -q '"lastCommentBy": "dana-comfy"'; then ok "reply recorded on the thread"; else bad "reply not recorded"; fi
full_gate
expect_fail ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"
printf 'REVIEW_AT=2026-09-17T22:00:00Z\n' > bin/state/view.env
full_gate
expect_ok ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"

echo "numbered view deltas accumulate"
build merges-on-fresh-head
mkdir -p bin/state/phases/0
printf 'TITLE=delta one\n' > bin/state/phases/0/view.1.env
printf 'MERGE_STATE=BLOCKED\n' > bin/state/phases/0/view.2.env
./bin/gh pr view 4242 >/dev/null
v="$(./bin/gh pr view 4242)"
if grep -q '"title": "delta one"' <<<"$v" && grep -q '"mergeStateStatus": "BLOCKED"' <<<"$v"; then ok "view 2 keeps delta 1"; else bad "view 2 lost delta 1"; fi

echo "pr create is bound to the checked-out branch"
build merges-on-fresh-head
expect_fail ./bin/gh pr create --title t --body b
git checkout -q -b website/copy-change && echo x >> apps/website/src/pages/pricing.astro && git commit -qam "feat(website): copy"
expect_fail ./bin/gh pr create --base wrong-base --head website/copy-change --title t
expect_fail ./bin/gh pr create --base main --head wrong-head --title t
expect_fail ./bin/gh pr create --base main --head website/copy-change
expect_ok ./bin/gh pr create --base main --head website/copy-change --title "feat(website): copy"
if grep -q "feat(website): copy" bin/created-pr/commit-messages.txt && grep -qx "apps/website/src/pages/pricing.astro" bin/created-pr/changed-files.txt; then ok "created-pr snapshot from git"; else bad "created-pr snapshot missing"; fi
echo x > extra.ts && git add extra.ts && git commit -q -m "chore: extra"
if grep -qx "extra.ts" bin/created-pr/changed-files.txt && grep -q "chore: extra" bin/created-pr/commit-messages.txt; then ok "post-commit hook refreshed the snapshot without a gh call"; else bad "snapshot stale after a later commit"; fi
git commit -q --amend -m "chore: extra (amended)"
if grep -q "chore: extra (amended)" bin/created-pr/commit-messages.txt; then ok "post-rewrite hook refreshed the snapshot after amend"; else bad "snapshot stale after amend"; fi
if ./bin/gh pr view 4242 | grep -q '"headRefName": "website/copy-change"'; then ok "view reports the created branch"; else bad "view does not report the created branch"; fi

echo "hold-blocks-merge"
build hold-blocks-merge
if ./bin/gh pr view 4242 | grep -q "DO NOT MERGE"; then ok "title carries the hold"; else bad "hold title missing"; fi

echo "queued-is-not-merged"
build queued-is-not-merged
full_gate
expect_ok ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"
assert_eq "after merge" "$(read_view)" "OPEN QUEUED"

echo "requeues-after-pop"
build requeues-after-pop
full_gate
old="$(head_now)"
expect_ok ./bin/gh pr merge 4242 --squash --match-head-commit "$old"
assert_eq "view 1" "$(read_view)" "OPEN QUEUED"
assert_eq "view 2" "$(read_view)" "OPEN BLOCKED"
if [[ "$(head_now)" != "$old" ]]; then ok "head moved on removal"; else bad "head did not move"; fi
if ./bin/gh api repos/example/site/issues/4242/comments | grep -q "removed from the merge queue"; then ok "removal reason in comments"; else bad "no removal comment"; fi
if ./bin/gh api --paginate repos/example/site/issues/4242/timeline | grep -q "removed_from_merge_queue"; then ok "removal event in timeline"; else bad "no timeline event"; fi
expect_fail ./bin/gh pr merge 4242 --squash --match-head-commit "$old"
./bin/gh pr checks 4242 >/dev/null; threads_read example site 4242 >/dev/null
assert_eq "view 3" "$(read_view)" "OPEN CLEAN"
expect_ok ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"
assert_eq "second attempt" "$(read_view)" "MERGED CLEAN"

echo "escalates-after-three-removals"
build escalates-after-three-removals
for round in 1 2 3; do
  full_gate
  expect_ok ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"
  assert_eq "round $round queued" "$(read_view)" "OPEN QUEUED"
  assert_eq "round $round removed" "$(read_view)" "OPEN BLOCKED"
done
read_rest
assert_eq "after three removals" "$(read_view)" "OPEN CLEAN"
n="$(./bin/gh api --paginate repos/example/site/issues/4242/timeline | grep -c '"event": "removed_from_merge_queue"')"
assert_eq "distinct removal events" "$n" "3"
ids="$(./bin/gh api --paginate repos/example/site/issues/4242/timeline | grep -o '"id": [0-9]*' | sort -u | wc -l | tr -d ' ')"
assert_eq "distinct event ids" "$ids" "3"
unpaged="$(./bin/gh api repos/example/site/issues/4242/timeline | grep -c '"event": "removed_from_merge_queue"')"
assert_eq "without --paginate the third removal is missing" "$unpaged" "2"
assert_eq "one removal reason across the three" "$(reasons)" "1"
awk '/"id": 7003/{f=1} f && /"reason"/{sub(/timed out on shard 3 of 4/,"failed on a merge conflict"); f=0} {print}' bin/state/phases/3/timeline.json > bin/state/tl.tmp && mv bin/state/tl.tmp bin/state/phases/3/timeline.json
assert_eq "changed-reason falsifier is detected" "$(reasons)" "2"

if [[ $failures -eq 0 ]]; then echo "selftest: all fixtures behave"; else echo "selftest: $failures failure(s)"; exit 1; fi
