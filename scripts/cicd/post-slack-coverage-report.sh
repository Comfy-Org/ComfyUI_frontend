#!/usr/bin/env bash
# Posts a prepared coverage report payload to Slack, failing the run when Slack
# does not accept it.
set -euo pipefail

: "${SLACK_PAYLOAD:?SLACK_PAYLOAD is required}"
: "${SLACK_BOT_TOKEN:?SLACK_BOT_TOKEN is required}"

# A repository variable cannot be set from a pull request, so requiring
# COVERAGE_SLACK_CHANNEL_ID would ship this broken. Setting it is what retires
# #p-deprecated-frontend-automated-testing.
CHANNEL="${SLACK_CHANNEL_ID:-}"
if [[ -z "$CHANNEL" ]]; then
  CHANNEL=C0AP09LKRDZ
  echo '::warning::Repository variable COVERAGE_SLACK_CHANNEL_ID is unset; posting to the deprecated #p-deprecated-frontend-automated-testing channel. Set the variable to move these reports.'
fi

BODY=$(jq -c --arg ch "$CHANNEL" '. + {channel: $ch}' <<< "$SLACK_PAYLOAD")

# Deliberately not retried: chat.postMessage carries no idempotency key, and
# Slack can accept a message before the response reaches curl, so a retry posts
# the report twice. A lost report is recoverable — the run is red and can be
# re-run — while a duplicate is not.
if ! RESPONSE=$(curl -sS -X POST \
  --max-time 30 \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "$BODY" \
  https://slack.com/api/chat.postMessage); then
  echo '::error::Could not reach Slack to post the coverage report.'
  exit 1
fi

# Slack answers 200 with ok:false for channel_not_found, not_in_channel and
# invalid_auth, so the status code proves nothing.
if [[ "$(jq -r '.ok' <<< "$RESPONSE" 2>/dev/null)" != true ]]; then
  REASON=$(jq -r '.error // empty' <<< "$RESPONSE" 2>/dev/null) || REASON=''
  # A proxy error page is not JSON, so fall back to the raw body. It carries
  # no token: the token was sent in a header, not in the body.
  [[ -n "$REASON" ]] || REASON=$(printf '%.300s' "$RESPONSE" | tr '\n' ' ')
  echo "::error::Slack rejected the coverage report: ${REASON:-empty response}"
  exit 1
fi
