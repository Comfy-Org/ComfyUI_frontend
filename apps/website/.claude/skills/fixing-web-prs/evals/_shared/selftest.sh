#!/usr/bin/env bash
# Drives every fixing-web-prs eval case's fixture through the sequence the case
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
Q='query($owner:String!,$name:String!,$number:Int!,$endCursor:String){
  repository(owner:$owner,name:$name){ pullRequest(number:$number){
    reviewThreads(first:100,after:$endCursor){
      pageInfo{ hasNextPage endCursor }
      nodes{ id isResolved path
        first: comments(first:1){ nodes{ author{login} createdAt } }
        last: comments(last:1){ nodes{ author{login} createdAt } } } } } } }'
# shellcheck disable=SC2016
REPLY_Q='mutation($threadId:ID!,$body:String!){addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$threadId,body:$body}){comment{id}}}'
# shellcheck disable=SC2016
RESOLVE_Q='mutation($threadId:ID!){resolveReviewThread(input:{threadId:$threadId}){thread{isResolved}}}'
threads_read() { ./bin/gh api graphql --paginate -F owner="$1" -F name="$2" -F number="$3" -f query="${4:-$Q}"; }
# thread <author> <lastCommentBy> <lastCommentAt>: one unresolved thread T1 in GitHub's shape
# thread_node <id> <author> <lastBy> <lastAt> [resolved]
thread_node() { jq -n --arg id "$1" --arg a "$2" --arg b "$3" --arg t "$4" --argjson r "${5:-false}" '{id:$id,isResolved:$r,path:"apps/website/src/pages/pricing.astro",first:{nodes:[{author:{login:$a},createdAt:"2026-09-17T17:00:00Z"}]},last:{nodes:[{author:{login:$b},createdAt:$t}]}}'; }
threads_file() { jq -s '{data:{repository:{pullRequest:{reviewThreads:{pageInfo:{hasNextPage:false,endCursor:null},nodes:.}}}}}' > bin/state/threads.json; }
thread() { thread_node T1 "$1" "$2" "$3" | threads_file; }
read_all_threads() { threads_read example site 4242 | jq -s 'map(.data.repository.pullRequest.reviewThreads.nodes) | add'; }
read_rest() { ./bin/gh pr checks 4242 >/dev/null; ./bin/gh pr checks 4242 --required >/dev/null; threads_read example site 4242 >/dev/null; ./bin/gh api --paginate repos/example/site/issues/4242/comments >/dev/null; }
# The published commands, taken from review-loop.md itself so the self-test
# exercises what the skill prints rather than a copy.
skills_dir="$(cd "$evals/../.." && pwd)"
loop_md="$skills_dir/building-web-prs/review-loop.md"
# fence N of review-loop.md, verbatim
published_fence() { awk -v want="$1" '/^```bash/{n++; next} n==want&&/^```$/{exit} n==want{print}' "$loop_md"; }
# The published thread read, with the placeholder assignment line replaced by real values.
published_threads_read() { local cmd; cmd="$(published_fence 1 | sed "s/^owner=<owner>; name=<repo>; number=<number>$/owner=$1; name=$2; number=$3/")"; env PATH="$PWD/bin:$PATH" bash -c "$cmd"; }
# The published reply: the body goes into a file, never through the shell or sed.
published_reply() { local threadId="$1" body="$2" cmd; printf '%s' "$body" > "$PWD/bin/reply-body.src"; cp "$PWD/bin/reply-body.src" "$PWD/bin/reply-body.txt"
  cmd="$(published_fence 2 | awk 'NF==0{exit} {print}' | sed "s|^threadId=<id>; bodyFile=<path to the file holding your reply>$|threadId=$threadId; bodyFile=$PWD/bin/reply-body.txt|")"
  env PATH="$PWD/bin:$PATH" bash -c "$cmd"; }
published_resolve() { local threadId="$1" cmd; cmd="$(published_fence 2 | awk 'f{print} NF==0{f=1}')"; env PATH="$PWD/bin:$PATH" threadId="$threadId" bash -c "$cmd"; }
md_fences_balanced() { local f n c=0; while IFS= read -r f; do c=$((c+1)); n="$(grep -c '^```' "$f" || true)"; if (( n % 2 )); then bad "unbalanced code fence in $f"; fi; if grep -q '^````' "$f"; then bad "four-backtick fence in $f"; fi; done < <(find "$skills_dir" "$skills_dir/../../AGENTS.md" -name '*.md' -not -path '*/results/*' | sort); ok "markdown fences balanced in $c markdown files under the skill tree"; }
md_fences_balanced
reasons() { ./bin/gh api --paginate repos/example/site/issues/4242/timeline | jq -s 'add | map(.reason) | unique | length'; }
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
./bin/gh pr checks 4242 --required >/dev/null; threads_read example site 4242 >/dev/null; ./bin/gh api --paginate repos/example/site/issues/4242/comments >/dev/null
expect_ok ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"
build merges-on-fresh-head
read_view >/dev/null; ./bin/gh pr checks 4242 --required >/dev/null; threads_read example site 4242 >/dev/null; ./bin/gh api --paginate repos/example/site/issues/4242/comments >/dev/null
expect_fail ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"   # full check list unread
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
# shellcheck disable=SC2016
expect_fail threads_read example site 4242 'query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){title}}} # reviewThreads'
expect_fail ./bin/gh api graphql -F owner=example -F name=site -F number=4242 -f query="$Q"
expect_fail ./bin/gh api graphql -F number=4242 -f query='query{repository(owner:"example",name:"site"){pullRequest(number:4242){reviewThreads}}}'
expect_fail ./bin/gh api repos/example/site/issues/9999/comments
expect_fail ./bin/gh api repos/wrong/repo/issues/4242/comments
expect_fail ./bin/gh api repos/example/site/issues/4242/commentsx
expect_fail ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"
read_rest
expect_ok ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"

echo "an unpaginated comments read is the only missing prerequisite"
build merges-on-fresh-head
read_view >/dev/null; ./bin/gh pr checks 4242 >/dev/null; ./bin/gh pr checks 4242 --required >/dev/null; threads_read example site 4242 >/dev/null
./bin/gh api repos/example/site/issues/4242/comments >/dev/null
expect_fail ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"
./bin/gh api --paginate repos/example/site/issues/4242/comments >/dev/null
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
OLD_REPLY_Q='mutation($t:ID!,$b:String!){addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$t,body:$b}){comment{id}}}'
expect_fail ./bin/gh api graphql -F threadId=T1 -f body="answered" -f query="$OLD_REPLY_Q"
expect_fail ./bin/gh api graphql -F threadId=NOPE -f body="answered" -f query="$REPLY_Q"
nasty_body="$(printf "It's fixed: the stale copy is gone, and \"quotes\" survive\nREPLY\n\$HOME and a back\\slash, a | pipe and an & ampersand\nlast line, no newline")"
expect_ok published_reply T1 "$nasty_body"
if cmp -s bin/reply-body.src bin/state/last-reply-body.txt; then ok "reply body received byte for byte (multiline, apostrophe, quotes, dollar, backslash, delimiters)"; else bad "reply body altered in transit"; fi
if [[ ! -e bin/reply-body.txt ]]; then ok "published reply deleted its body file on success"; else bad "body file left behind on success"; fi
printf 'x' > bin/reply-body.txt; published_reply NOPE "x" >/dev/null 2>&1 || true
if [[ ! -e bin/reply-body.txt ]]; then ok "published reply deleted its body file on failure"; else bad "body file left behind on failure"; fi
printf 'one trailing\n' > bin/reply-body.src; cp bin/reply-body.src bin/reply-body.txt
cmd="$(published_fence 2 | awk 'NF==0{exit} {print}' | sed "s|^threadId=<id>; bodyFile=<path to the file holding your reply>$|threadId=T1; bodyFile=$PWD/bin/reply-body.txt|")"
env PATH="$PWD/bin:$PATH" bash -c "$cmd" >/dev/null
if cmp -s bin/reply-body.src bin/state/last-reply-body.txt; then ok "one trailing newline preserved"; else bad "one trailing newline lost"; fi
printf 'two trailing\n\n' > bin/reply-body.src; cp bin/reply-body.src bin/reply-body.txt
cmd="$(published_fence 2 | awk 'NF==0{exit} {print}' | sed "s|^threadId=<id>; bodyFile=<path to the file holding your reply>$|threadId=T1; bodyFile=$PWD/bin/reply-body.txt|")"
env PATH="$PWD/bin:$PATH" bash -c "$cmd" >/dev/null
if cmp -s bin/reply-body.src bin/state/last-reply-body.txt; then ok "two trailing newlines preserved"; else bad "trailing newlines lost"; fi
printf 'literal' > bin/reply-body.txt
expect_ok ./bin/gh api graphql -F threadId=T1 -f body="@$PWD/bin/reply-body.txt" -f query="$REPLY_Q"
if [[ "$(cat bin/state/last-reply-body.txt)" == "@$PWD/bin/reply-body.txt" ]]; then ok "-f body=@file is taken literally"; else bad "-f body=@file was dereferenced"; fi
expect_fail ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"
if read_all_threads | jq -e '.[0].last.nodes[0].author.login == "dana-comfy"' >/dev/null; then ok "reply recorded as the thread's last comment"; else bad "reply not recorded"; fi
# shellcheck disable=SC2016
SPOOF_Q='mutation($threadId:ID!,$body:String!){__typename} # addPullRequestReviewThreadReply pullRequestReviewThreadId:$threadId body:$body'
expect_fail ./bin/gh api graphql -F threadId=T1 -f body="spoof" -f query="$SPOOF_Q"
full_gate
expect_fail ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"
printf 'REVIEW_AT=2026-09-17T22:00:00Z\n' > bin/state/view.env
full_gate
expect_ok ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"

echo "resolving a thread is bound to its id and invalidates the gate"
build merges-on-fresh-head
thread website-reviewer someone-else 2026-09-17T19:00:00Z
full_gate
expect_fail ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"
expect_fail ./bin/gh api graphql -F threadId=NOPE -f query="$RESOLVE_Q"
expect_ok published_resolve T1
if read_all_threads | jq -e '.[0].isResolved == true' >/dev/null; then ok "thread served as resolved"; else bad "thread not resolved"; fi
expect_fail ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"
full_gate
expect_ok ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"

echo "threads paginate and a page-two thread blocks the merge"
build merges-on-fresh-head
{ thread_node T1 website-reviewer website-reviewer 2026-09-17T17:00:00Z true; thread_node T2 website-reviewer website-reviewer 2026-09-17T17:00:00Z true; thread_node T3 frontend-reviewer frontend-reviewer 2026-09-17T19:00:00Z; } | threads_file
pages="$(threads_read example site 4242 | wc -l | tr -d ' ')"
assert_eq "threads: one document per page" "$pages" "2"
assert_eq "published thread read matches the copy the tests use" "$(published_threads_read example site 4242 | wc -l | tr -d ' ')" "2"
assert_eq "threads: pages compose in order" "$(read_all_threads | jq -c 'map(.id)')" '["T1","T2","T3"]'
assert_eq "threads: page one says there is a next page" "$(threads_read example site 4242 | head -1 | jq -c '.data.repository.pullRequest.reviewThreads.pageInfo.hasNextPage')" "true"
full_gate
expect_fail ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"   # T3 on page two is unanswered
printf 'REVIEW_AT=2026-09-17T20:00:00Z\n' > bin/state/view.env
full_gate
expect_ok ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"

echo "a long thread is judged by its actual last comment"
build merges-on-fresh-head
thread website-reviewer website-reviewer 2026-09-17T19:00:00Z
jq '.data.repository.pullRequest.reviewThreads.nodes[0].last.nodes = [{"author":{"login":"website-reviewer"},"createdAt":"2026-09-17T23:00:00Z"}]' bin/state/threads.json > bin/state/t.tmp && mv bin/state/t.tmp bin/state/threads.json
printf 'REVIEW_AT=2026-09-17T20:00:00Z\n' > bin/state/view.env
full_gate
expect_fail ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"   # comment 101 at 23:00 postdates the approval

echo "quoted titles render as valid JSON"
build merges-on-fresh-head
printf 'TITLE=feat(website): say "hello" & ship #1\n' > bin/state/view.env
if ./bin/gh pr view 4242 | jq -e '.title == "feat(website): say \"hello\" & ship #1"' >/dev/null; then ok "title with quotes, ampersand and hash survives"; else bad "title corrupted the JSON"; fi

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
expect_fail ./bin/gh pr create --head website/copy-change --title t
expect_ok ./bin/gh pr create --base main --head website/copy-change --title "feat(website): copy"
if grep -q "feat(website): copy" bin/created-pr/commit-messages.txt && grep -qx "apps/website/src/pages/pricing.astro" bin/created-pr/changed-files.txt; then ok "created-pr snapshot from git"; else bad "created-pr snapshot missing"; fi
echo x > extra.ts && git add extra.ts && git commit -q -m "chore: extra"
if grep -qx "extra.ts" bin/created-pr/changed-files.txt && grep -q "chore: extra" bin/created-pr/commit-messages.txt; then ok "post-commit hook refreshed the snapshot without a gh call"; else bad "snapshot stale after a later commit"; fi
hooks_dir="$(git rev-parse --git-path hooks)"
for h in post-commit post-rewrite post-checkout post-merge; do if [[ -x "$hooks_dir/$h" ]]; then ok "hook installed: $h"; else bad "hook missing: $h"; fi; done
git checkout -q main && echo m > moved.ts && git add moved.ts && git commit -q -m "chore: main moved" && git checkout -q website/copy-change
before="$(cat bin/state/head_sha)"
git rebase -q main
if [[ "$(cat bin/state/head_sha)" != "$before" && "$(cat bin/state/head_sha)" == "$(git rev-parse HEAD)" ]]; then ok "post-rewrite hook refreshed the snapshot after a rebase (post-commit does not fire on rebase)"; else bad "snapshot stale after rebase"; fi
rm -rf bin/created-pr
git checkout -q main && git checkout -q website/copy-change
if [[ -f bin/created-pr/commit-messages.txt ]]; then ok "post-checkout hook regenerated the snapshot"; else bad "post-checkout hook did not run"; fi
git checkout -q -b side main && echo s > side.ts && git add side.ts && git commit -q -m "chore: side" && git checkout -q website/copy-change && git merge -q --no-ff -m "chore: merge side" side
if grep -q "chore: merge side" bin/created-pr/commit-messages.txt && grep -qx "side.ts" bin/created-pr/changed-files.txt; then ok "post-merge hook refreshed the snapshot"; else bad "post-merge hook did not run"; fi
v="$(./bin/gh pr view 4242)"; if grep -q '"headRefName": "website/copy-change"' <<<"$v"; then ok "view reports the created branch"; else bad "view does not report the created branch"; fi

echo "every fixture scaffolds"
while IFS= read -r fx; do d="$(dirname "$fx")"; w="$tmp/scaffold-$(basename "$d")"; rm -rf "$w"; mkdir -p "$w"; if (cd "$w" && bash "$fx" >/dev/null 2>&1 && test -x bin/gh && test -f bin/state/pr_number); then ok "scaffolds: $(basename "$(dirname "$d")")/$(basename "$d")"; else bad "scaffold failed: $fx"; fi; done < <(find "$skills_dir" -name fixture.sh -not -path '*/results/*' | sort)

echo "hold-blocks-merge"
build hold-blocks-merge
v="$(./bin/gh pr view 4242)"; if grep -q "DO NOT MERGE" <<<"$v"; then ok "title carries the hold"; else bad "hold title missing"; fi

echo "waits-in-queue-until-merged"
build waits-in-queue-until-merged
full_gate
expect_ok ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"
assert_eq "view 1 after merge" "$(read_view)" "OPEN QUEUED"
assert_eq "view 2 after merge" "$(read_view)" "OPEN QUEUED"
assert_eq "view 3 after merge" "$(read_view)" "MERGED CLEAN"
expect_fail ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"

echo "requeues-after-pop"
build requeues-after-pop
full_gate
old="$(head_now)"
expect_ok ./bin/gh pr merge 4242 --squash --match-head-commit "$old"
assert_eq "view 1" "$(read_view)" "OPEN QUEUED"
assert_eq "view 2" "$(read_view)" "OPEN BLOCKED"
if [[ "$(head_now)" != "$old" ]]; then ok "head moved on removal"; else bad "head did not move"; fi
if ./bin/gh api --paginate repos/example/site/issues/4242/comments | grep -q "removed from the merge queue"; then ok "removal reason in comments"; else bad "no removal comment"; fi
if ./bin/gh api --paginate repos/example/site/issues/4242/timeline | grep -q "removed_from_merge_queue"; then ok "removal event in timeline"; else bad "no timeline event"; fi
expect_fail ./bin/gh pr merge 4242 --squash --match-head-commit "$old"
read_rest
assert_eq "view 3" "$(read_view)" "OPEN CLEAN"
expect_ok ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"
assert_eq "second attempt" "$(read_view)" "MERGED CLEAN"
if grep -q "^merge accepted #4242 at" bin/events.log && tail -1 bin/events.log | grep -q "^view MERGED"; then ok "events log records merges and the MERGED observation"; else bad "events log incomplete"; fi

echo "closed-while-queued-stops"
build closed-while-queued-stops
full_gate
expect_ok ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"
assert_eq "view 1 after merge" "$(read_view)" "OPEN QUEUED"
assert_eq "view 2 after merge" "$(read_view)" "CLOSED UNKNOWN"
if ./bin/gh api --paginate repos/example/site/issues/4242/timeline | jq -e '.[0].event == "closed" and .[0].actor.login == "site-lead"' >/dev/null; then ok "timeline names the closer"; else bad "timeline lacks the close event"; fi
./bin/gh api --paginate repos/example/site/issues/4242/comments >/dev/null
closed_order() { awk '/^merge accepted/{m=1} m&&/^view CLOSED /{c=1} c&&/^read timeline/{t=1} c&&/^read comments/{r=1} END{exit !(m&&c&&t&&r)}' "$1"; }
if closed_order bin/events.log; then ok "events log orders merge, CLOSED view, timeline and comments reads"; else bad "events log order broken"; fi
if awk '/^view CLOSED /{c=1} c&&/^read timeline/{t=1} END{exit !(t)}' <(grep -v '^read timeline' bin/events.log); then bad "falsifier: missing timeline read went unnoticed"; else ok "falsifier: missing timeline read is noticed"; fi
if closed_order <(grep -v '^view CLOSED ' bin/events.log); then bad "falsifier: missing CLOSED view went unnoticed"; else ok "falsifier: missing CLOSED view is noticed"; fi
if closed_order <(sed '/^read comments/d' bin/events.log); then bad "falsifier: missing comments read went unnoticed"; else ok "falsifier: missing comments read is noticed"; fi
full_gate
expect_fail ./bin/gh pr merge 4242 --squash --match-head-commit "$(head_now)"

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
n="$(./bin/gh api --paginate repos/example/site/issues/4242/timeline | jq -s 'add | map(select(.event == "removed_from_merge_queue")) | length')"
assert_eq "distinct removal events" "$n" "3"
ids="$(./bin/gh api --paginate repos/example/site/issues/4242/timeline | jq -s 'add | map(.id) | unique | length')"
assert_eq "distinct event ids" "$ids" "3"
unpaged="$(./bin/gh api repos/example/site/issues/4242/timeline | jq -c '.[]' | grep -c removed_from_merge_queue)"
assert_eq "without --paginate the third removal is missing" "$unpaged" "2"
pages="$(./bin/gh api --paginate repos/example/site/issues/4242/timeline | wc -l | tr -d ' ')"
assert_eq "paginated output is one document per page" "$pages" "2"
composed="$(./bin/gh api --paginate repos/example/site/issues/4242/timeline | jq -s 'add | map(.id)' -c)"
assert_eq "pages compose to the three events in order" "$composed" "[7001,7002,7003]"
assert_eq "one removal reason across the three" "$(reasons)" "1"
assert_eq "accepted merges logged" "$(grep -c '^merge accepted #4242 at' bin/events.log)" "3"
awk '/"id": 7003/{f=1} f && /"reason"/{sub(/timed out on shard 3 of 4/,"failed on a merge conflict"); f=0} {print}' bin/state/phases/3/timeline.json > bin/state/tl.tmp && mv bin/state/tl.tmp bin/state/phases/3/timeline.json
assert_eq "changed-reason falsifier is detected" "$(reasons)" "2"

if [[ $failures -eq 0 ]]; then echo "selftest: all fixtures behave"; else echo "selftest: $failures failure(s)"; exit 1; fi
