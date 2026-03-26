#!/usr/bin/env bash
# Deploy QA report to Cloudflare Pages.
# Expected env vars: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, RAW_BRANCH,
#   BEFORE_SHA, AFTER_SHA, TARGET_NUM, TARGET_TYPE, REPO, RUN_ID
# Writes outputs to GITHUB_OUTPUT: badge_status, url
set -euo pipefail

npm install -g wrangler@4.74.0 >/dev/null 2>&1

DEPLOY_DIR=$(mktemp -d)
mkdir -p "$DEPLOY_DIR"

for os in Linux macOS Windows; do
  DIR="qa-artifacts/qa-report-${os}-${RUN_ID}"
  for prefix in qa qa-before; do
    VID="${DIR}/${prefix}-session.mp4"
    if [ -f "$VID" ]; then
      DEST="$DEPLOY_DIR/${prefix}-${os}.mp4"
      cp "$VID" "$DEST"
      echo "Found ${prefix} ${os} video ($(du -h "$VID" | cut -f1))"
    fi
  done
  # Copy multi-pass session videos (qa-session-1, qa-session-2, etc.)
  for numbered in "$DIR"/qa-session-[0-9].mp4; do
    [ -f "$numbered" ] || continue
    NUM=$(basename "$numbered" | sed 's/qa-session-\([0-9]\).mp4/\1/')
    DEST="$DEPLOY_DIR/qa-${os}-pass${NUM}.mp4"
    cp "$numbered" "$DEST"
    echo "Found pass ${NUM} ${os} video ($(du -h "$numbered" | cut -f1))"
  done
  # Generate GIF thumbnail from after video (or first pass)
  THUMB_SRC="$DEPLOY_DIR/qa-${os}.mp4"
  [ ! -f "$THUMB_SRC" ] && THUMB_SRC="$DEPLOY_DIR/qa-${os}-pass1.mp4"
  if [ -f "$THUMB_SRC" ]; then
    ffmpeg -y -ss 10 -i "$THUMB_SRC" -t 8 \
      -vf "fps=8,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=64[p];[s1][p]paletteuse=dither=bayer" \
      -loop 0 "$DEPLOY_DIR/qa-${os}-thumb.gif" 2>/dev/null \
    || echo "GIF generation failed for ${os} (non-fatal)"
  fi
done

# Build video cards and report sections
CARDS=""
# shellcheck disable=SC2034 # accessed via eval
ICONS_Linux="&#x1F427;" ICONS_macOS="&#x1F34E;" ICONS_Windows="&#x1FA9F;"
CARD_COUNT=0
DL_ICON="<svg width=14 height=14 viewBox='0 0 24 24' fill=none stroke=currentColor stroke-width=2><path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'/><polyline points='7 10 12 15 17 10'/><line x1=12 y1=15 x2=12 y2=3'/></svg>"

for os in Linux macOS Windows; do
  eval "ICON=\$ICONS_${os}"
  OS_LOWER=$(echo "$os" | tr '[:upper:]' '[:lower:]')
  HAS_BEFORE=$([ -f "$DEPLOY_DIR/qa-before-${os}.mp4" ] && echo 1 || echo 0)
  HAS_AFTER=$( { [ -f "$DEPLOY_DIR/qa-${os}.mp4" ] || [ -f "$DEPLOY_DIR/qa-${os}-pass1.mp4" ]; } && echo 1 || echo 0)
  [ "$HAS_AFTER" = "0" ] && continue

  # Collect all reports for this platform (single + multi-pass)
  REPORT_FILES=""
  REPORT_LINK=""
  REPORT_HTML=""
  for rpt in "video-reviews/${OS_LOWER}-qa-video-report.md" "video-reviews/${OS_LOWER}-pass"*-qa-video-report.md; do
    [ -f "$rpt" ] && REPORT_FILES="${REPORT_FILES} ${rpt}"
  done

  if [ -n "$REPORT_FILES" ]; then
    # Concatenate all reports into one combined report file
    COMBINED_MD=""
    for rpt in $REPORT_FILES; do
      cp "$rpt" "$DEPLOY_DIR/$(basename "$rpt")"
      RPT_MD=$(sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g' "$rpt")
      [ -n "$COMBINED_MD" ] && COMBINED_MD="${COMBINED_MD}&#10;&#10;---&#10;&#10;"
      COMBINED_MD="${COMBINED_MD}${RPT_MD}"
    done
    FIRST_REPORT=$(echo "$REPORT_FILES" | awk '{print $1}')
    FIRST_BASENAME=$(basename "$FIRST_REPORT")
    REPORT_LINK="<a class=dl href=${FIRST_BASENAME}><svg width=14 height=14 viewBox='0 0 24 24' fill=none stroke=currentColor stroke-width=2><path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/><polyline points='14 2 14 8 20 8'/><line x1=16 y1=13 x2=8 y2=13/><line x1=16 y1=17 x2=8 y2=17'/></svg>Report</a>"
    REPORT_HTML="<details class=report open><summary><svg width=14 height=14 viewBox='0 0 24 24' fill=none stroke=currentColor stroke-width=2><circle cx=12 cy=12 r=10/><line x1=12 y1=16 x2=12 y2=12/><line x1=12 y1=8 x2=12.01 y2=8'/></svg> AI Comparative Review</summary><div class=report-body data-md>${COMBINED_MD}</div></details>"
  fi

  if [ "$HAS_BEFORE" = "1" ]; then
    CARDS="${CARDS}<div class='card reveal' style='--i:${CARD_COUNT}'><div class=card-header><span class=platform><span class=icon>${ICON}</span>${os}</span><span class=links>${REPORT_LINK}</span></div><div class=comparison><div class=comp-panel><div class=comp-label>Before <span class=comp-tag>main</span></div><div class=video-wrap><video controls muted preload=metadata><source src=qa-before-${os}.mp4 type=video/mp4></video></div><div class=comp-dl><a class=dl href=qa-before-${os}.mp4 download>${DL_ICON}Before</a></div></div><div class=comp-panel><div class=comp-label>After <span class=comp-tag>PR</span></div><div class=video-wrap><video controls muted preload=metadata><source src=qa-${os}.mp4 type=video/mp4></video></div><div class=comp-dl><a class=dl href=qa-${os}.mp4 download>${DL_ICON}After</a></div></div></div>${REPORT_HTML}</div>"
  elif [ -f "$DEPLOY_DIR/qa-${os}.mp4" ]; then
    CARDS="${CARDS}<div class='card reveal' style='--i:${CARD_COUNT}'><div class=video-wrap><video controls muted preload=metadata><source src=qa-${os}.mp4 type=video/mp4></video></div><div class=card-body><span class=platform><span class=icon>${ICON}</span>${os}</span><span class=links><a class=dl href=qa-${os}.mp4 download>${DL_ICON}Download</a>${REPORT_LINK}</span></div>${REPORT_HTML}</div>"
  else
    PASS_VIDEOS=""
    for pass_vid in "$DEPLOY_DIR/qa-${os}-pass"[0-9].mp4; do
      [ -f "$pass_vid" ] || continue
      PASS_NUM=$(basename "$pass_vid" | sed "s/qa-${os}-pass\([0-9]\).mp4/\1/")
      PASS_VIDEOS="${PASS_VIDEOS}<div class=comp-panel><div class=comp-label>Pass ${PASS_NUM}</div><div class=video-wrap><video controls muted preload=metadata><source src=qa-${os}-pass${PASS_NUM}.mp4 type=video/mp4></video></div><div class=comp-dl><a class=dl href=qa-${os}-pass${PASS_NUM}.mp4 download>${DL_ICON}Pass ${PASS_NUM}</a></div></div>"
    done
    CARDS="${CARDS}<div class='card reveal' style='--i:${CARD_COUNT}'><div class=card-header><span class=platform><span class=icon>${ICON}</span>${os}</span><span class=links>${REPORT_LINK}</span></div><div class=comparison>${PASS_VIDEOS}</div>${REPORT_HTML}</div>"
  fi
  CARD_COUNT=$((CARD_COUNT + 1))
done

# Build commit info and target link for the report header
COMMIT_HTML=""
REPO_URL="https://github.com/${REPO}"
if [ -n "${TARGET_NUM:-}" ]; then
  if [ "$TARGET_TYPE" = "issue" ]; then
    COMMIT_HTML="<a href=${REPO_URL}/issues/${TARGET_NUM} class=sha title='Issue'>Issue #${TARGET_NUM}</a>"
  else
    COMMIT_HTML="<a href=${REPO_URL}/pull/${TARGET_NUM} class=sha title='Pull Request'>PR #${TARGET_NUM}</a>"
  fi
fi
if [ -n "${BEFORE_SHA:-}" ]; then
  SHORT_BEFORE="${BEFORE_SHA:0:7}"
  COMMIT_HTML="${COMMIT_HTML:+${COMMIT_HTML} &middot; }<a href=${REPO_URL}/commit/${BEFORE_SHA} class=sha title='main branch'>main @ ${SHORT_BEFORE}</a>"
fi
if [ -n "${AFTER_SHA:-}" ]; then
  SHORT_AFTER="${AFTER_SHA:0:7}"
  AFTER_LABEL="PR"
  [ -n "${TARGET_NUM:-}" ] && AFTER_LABEL="#${TARGET_NUM}"
  COMMIT_HTML="${COMMIT_HTML:+${COMMIT_HTML} &middot; }<a href=${REPO_URL}/commit/${AFTER_SHA} class=sha title='PR head commit'>${AFTER_LABEL} @ ${SHORT_AFTER}</a>"
fi
[ -n "$COMMIT_HTML" ] && COMMIT_HTML=" &middot; ${COMMIT_HTML}"

RUN_LINK=""
if [ -n "${RUN_URL:-}" ]; then
  RUN_LINK=" &middot; <a href=\"${RUN_URL}\" class=sha title=\"GitHub Actions run\">CI Job</a>"
fi

# Generate index.html from template
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE="$SCRIPT_DIR/qa-report-template.html"

# Write dynamic content to temp files for safe substitution
echo -n "$COMMIT_HTML" > "$DEPLOY_DIR/.commit_html"
echo -n "$CARDS" > "$DEPLOY_DIR/.cards_html"
echo -n "$RUN_LINK" > "$DEPLOY_DIR/.run_link"
# Badge HTML with copy button (placeholder URL filled after deploy)
echo -n '<div class="badge-bar"><img src="badge.svg" alt="QA Badge" class="badge-img"/><button class="copy-badge" title="Copy badge markdown" onclick="copyBadge()"><svg width=14 height=14 viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=2><rect x=9 y=9 width=13 height=13 rx=2/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button></div>' > "$DEPLOY_DIR/.badge_html"
python3 -c "
import sys, pathlib
d = pathlib.Path(sys.argv[1])
t = pathlib.Path(sys.argv[2]).read_text()
t = t.replace('{{COMMIT_HTML}}', (d / '.commit_html').read_text())
t = t.replace('{{CARDS}}', (d / '.cards_html').read_text())
t = t.replace('{{RUN_LINK}}', (d / '.run_link').read_text())
t = t.replace('{{BADGE_HTML}}', (d / '.badge_html').read_text())
sys.stdout.write(t)
" "$DEPLOY_DIR" "$TEMPLATE" > "$DEPLOY_DIR/index.html"
rm -f "$DEPLOY_DIR/.commit_html" "$DEPLOY_DIR/.cards_html" "$DEPLOY_DIR/.run_link" "$DEPLOY_DIR/.badge_html"

cat > "$DEPLOY_DIR/404.html" <<'ERROREOF'
<!DOCTYPE html><html lang=en><head><meta charset=utf-8><title>404</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel=stylesheet>
<style>:root{--bg:oklch(8% 0.02 265);--fg:oklch(45% 0.01 265);--err:oklch(62% 0.22 25)}*{margin:0;padding:0;box-sizing:border-box}body{background:var(--bg);color:var(--fg);font-family:'Inter',system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}div{text-align:center}h1{color:var(--err);font-size:clamp(3rem,8vw,5rem);font-weight:700;letter-spacing:-.04em;margin-bottom:.5rem}p{font-size:1rem;max-width:32ch;line-height:1.5}</style>
</head><body><div><h1>404</h1><p>File not found. The QA recording may have failed or been cancelled.</p></div></body></html>
ERROREOF

# Generate badge SVGs into deploy dir
# Verdict detection: check AI review reports for reproduction outcome.
# Patterns are ordered from most specific to least specific.
REPRO_RESULT="" REPRO_COLOR="#9f9f9f"
if grep -riq 'INCONCLUSIVE' video-reviews/ 2>/dev/null; then
  REPRO_RESULT="INCONCLUSIVE" REPRO_COLOR="#9f9f9f"
elif grep -riq 'not reproduced\|could not reproduce\|unable to reproduce' video-reviews/ 2>/dev/null; then
  REPRO_RESULT="NOT REPRODUCIBLE" REPRO_COLOR="#9f9f9f"
elif grep -riq 'partially reproduced' video-reviews/ 2>/dev/null; then
  REPRO_RESULT="PARTIAL" REPRO_COLOR="#dfb317"
# Match "reproduced", "confirmed", "confirms", "reproducible" in body text (not headings)
elif grep -ri 'reproduc\|confirm' video-reviews/ 2>/dev/null | grep -vq '^[^:]*:##'; then
  REPRO_RESULT="REPRODUCED" REPRO_COLOR="#2196f3"
fi

# Badge label includes the target number for identification
BADGE_LABEL="QA"
[ -n "${TARGET_NUM:-}" ] && BADGE_LABEL="#${TARGET_NUM} QA"

if [ "$TARGET_TYPE" = "issue" ]; then
  BADGE_STATUS="${REPRO_RESULT:-FINISHED}"
  /tmp/gen-badge.sh "$BADGE_STATUS" "${REPRO_COLOR}" "$DEPLOY_DIR/badge.svg" "$BADGE_LABEL"
else
  # Extract the Overall Risk section for fix quality verdict.
  # Only look at the "## Overall Risk" section to avoid false matches from
  # severity labels (e.g. `MAJOR`) or negated phrases ("no regressions").
  RISK_TEXT=""
  if [ -d video-reviews ]; then
    RISK_TEXT=$(sed -n '/^## Overall Risk/,/^## /p' video-reviews/*.md 2>/dev/null | head -20)
  fi
  SOLN_RESULT="" SOLN_COLOR="#4c1"
  if echo "$RISK_TEXT" | grep -iq 'high\|critical\|breaking'; then
    SOLN_RESULT="MAJOR ISSUES" SOLN_COLOR="#e05d44"
  elif echo "$RISK_TEXT" | grep -iq 'medium\|moderate'; then
    SOLN_RESULT="MINOR ISSUES" SOLN_COLOR="#dfb317"
  elif echo "$RISK_TEXT" | grep -iq 'low\|minimal\|none\|no.*risk\|approved'; then
    SOLN_RESULT="APPROVED" SOLN_COLOR="#4c1"
  fi
  BADGE_STATUS="${REPRO_RESULT:-UNKNOWN} | Fix: ${SOLN_RESULT:-UNKNOWN}"
  /tmp/gen-badge-dual.sh \
    "${REPRO_RESULT:-UNKNOWN}" "${REPRO_COLOR}" \
    "${SOLN_RESULT:-UNKNOWN}" "${SOLN_COLOR}" \
    "$DEPLOY_DIR/badge.svg" "$BADGE_LABEL"
fi
echo "badge_status=${BADGE_STATUS:-FINISHED}" >> "$GITHUB_OUTPUT"

BRANCH=$(echo "$RAW_BRANCH" | sed 's/[^a-zA-Z0-9-]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//' | cut -c1-28)
URL=$(wrangler pages deploy "$DEPLOY_DIR" \
  --project-name="comfy-qa" \
  --branch="$BRANCH" 2>&1 \
  | grep -oE 'https://[a-zA-Z0-9.-]+\.pages\.dev\S*' | head -1)

echo "url=${URL:-https://${BRANCH}.comfy-qa.pages.dev}" >> "$GITHUB_OUTPUT"
echo "Deployed to: ${URL}"
