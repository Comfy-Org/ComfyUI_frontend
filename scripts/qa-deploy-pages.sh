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
    CARDS="${CARDS}<div class='card reveal' style='--i:${CARD_COUNT}'><div class=card-header><span class=platform><span class=icon>${ICON}</span>${os}</span><span class=links>${REPORT_LINK}</span></div><div class=comparison><div class=comp-panel><div class=comp-label>Before <span class=comp-tag>main</span></div><div class=video-wrap><video controls muted preload=auto><source src=qa-before-${os}.mp4 type=video/mp4></video></div><div class=comp-dl><a class=dl href=qa-before-${os}.mp4 download>${DL_ICON}Before</a></div></div><div class=comp-panel><div class=comp-label>After <span class=comp-tag>PR</span></div><div class=video-wrap><video controls muted preload=auto><source src=qa-${os}.mp4 type=video/mp4></video></div><div class=comp-dl><a class=dl href=qa-${os}.mp4 download>${DL_ICON}After</a></div></div></div>${REPORT_HTML}</div>"
  elif [ -f "$DEPLOY_DIR/qa-${os}.mp4" ]; then
    CARDS="${CARDS}<div class='card reveal' style='--i:${CARD_COUNT}'><div class=video-wrap><video controls muted preload=auto><source src=qa-${os}.mp4 type=video/mp4></video></div><div class=card-body><span class=platform><span class=icon>${ICON}</span>${os}</span><span class=links><a class=dl href=qa-${os}.mp4 download>${DL_ICON}Download</a>${REPORT_LINK}</span></div>${REPORT_HTML}</div>"
  else
    PASS_VIDEOS=""
    for pass_vid in "$DEPLOY_DIR/qa-${os}-pass"[0-9].mp4; do
      [ -f "$pass_vid" ] || continue
      PASS_NUM=$(basename "$pass_vid" | sed "s/qa-${os}-pass\([0-9]\).mp4/\1/")
      PASS_VIDEOS="${PASS_VIDEOS}<div class=comp-panel><div class=comp-label>Pass ${PASS_NUM}</div><div class=video-wrap><video controls muted preload=auto><source src=qa-${os}-pass${PASS_NUM}.mp4 type=video/mp4></video></div><div class=comp-dl><a class=dl href=qa-${os}-pass${PASS_NUM}.mp4 download>${DL_ICON}Pass ${PASS_NUM}</a></div></div>"
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
if [ -n "${PIPELINE_SHA:-}" ]; then
  SHORT_PIPE="${PIPELINE_SHA:0:7}"
  COMMIT_HTML="${COMMIT_HTML:+${COMMIT_HTML} &middot; }<a href=${REPO_URL}/commit/${PIPELINE_SHA} class=sha title='QA pipeline version'>QA @ ${SHORT_PIPE}</a>"
fi
[ -n "$COMMIT_HTML" ] && COMMIT_HTML=" &middot; ${COMMIT_HTML}"

RUN_LINK=""
if [ -n "${RUN_URL:-}" ]; then
  RUN_LINK=" &middot; <a href=\"${RUN_URL}\" class=sha title=\"GitHub Actions run\">CI Job</a>"
fi

# Timing info
DEPLOY_TIME=$(date -u '+%Y-%m-%d %H:%M UTC')
TIMING_HTML=""
if [ -n "${RUN_START_TIME:-}" ]; then
  TIMING_HTML=" &middot; <span class=sha title='Pipeline timing'>${RUN_START_TIME} &rarr; ${DEPLOY_TIME}</span>"
fi

# Generate index.html from template
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE="$SCRIPT_DIR/qa-report-template.html"

# Write dynamic content to temp files for safe substitution
# Cloudflare Pages _headers file — enable range requests for video seeking
cat > "$DEPLOY_DIR/_headers" <<'HEADERSEOF'
/*.mp4
  Accept-Ranges: bytes
  Cache-Control: public, max-age=86400
HEADERSEOF

# Build purpose description from pr-context.txt
PURPOSE_HTML=""
if [ -f pr-context.txt ]; then
  # Extract title line and first paragraph of description
  PR_TITLE=$(grep -m1 '^Title:' pr-context.txt 2>/dev/null | sed 's/^Title: //' || true)
  if [ "$TARGET_TYPE" = "issue" ]; then
    PURPOSE_LABEL="Issue #${TARGET_NUM}"
    PURPOSE_VERB="reports"
  else
    PURPOSE_LABEL="PR #${TARGET_NUM}"
    PURPOSE_VERB="aims to"
  fi
  # Get first ~300 chars of description body (after "Description:" line)
  PR_DESC=$(sed -n '/^Description:/,/^###/p' pr-context.txt 2>/dev/null | grep -v '^Description:\|^###' | head -5 | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g' | tr '\n' ' ' | head -c 400 || true)
  [ -z "$PR_DESC" ] && PR_DESC=$(sed -n '3,8p' pr-context.txt 2>/dev/null | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g' | tr '\n' ' ' | head -c 400 || true)
  # Build requirements from QA guide JSON
  REQS_HTML=""
  QA_GUIDE=$(ls qa-guides/qa-guide-*.json 2>/dev/null | head -1 || true)
  if [ -f "$QA_GUIDE" ]; then
    PREREQS=$(python3 -c "
import json, sys, html
try:
  g = json.load(open(sys.argv[1]))
  prereqs = g.get('prerequisites', [])
  steps = g.get('steps', [])
  focus = g.get('test_focus', '')
  parts = []
  if focus:
    parts.append('<strong>Test focus:</strong> ' + html.escape(focus))
  if prereqs:
    parts.append('<strong>Prerequisites:</strong> ' + ', '.join(html.escape(p) for p in prereqs))
  if steps:
    parts.append('<strong>Steps:</strong> ' + ' → '.join(html.escape(s.get('description', str(s))) for s in steps[:6]))
    if len(steps) > 6:
      parts[-1] += ' → ...'
  print('<br>'.join(parts))
except: pass
" "$QA_GUIDE" 2>/dev/null)
    [ -n "$PREREQS" ] && REQS_HTML="<div class=purpose-reqs>${PREREQS}</div>"
  fi

  PURPOSE_HTML="<div class=purpose><div class=purpose-label>${PURPOSE_LABEL} ${PURPOSE_VERB}</div><strong>${PR_TITLE}</strong><br>${PR_DESC}${REQS_HTML}</div>"
fi

echo -n "$COMMIT_HTML" > "$DEPLOY_DIR/.commit_html"
echo -n "$CARDS" > "$DEPLOY_DIR/.cards_html"
echo -n "$RUN_LINK" > "$DEPLOY_DIR/.run_link"
# Badge HTML with copy button (placeholder URL filled after deploy)
echo -n '<div class="badge-bar"><img src="badge.svg" alt="QA Badge" class="badge-img"/><button class="copy-badge" title="Copy badge markdown" onclick="copyBadge()"><svg width=14 height=14 viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=2><rect x=9 y=9 width=13 height=13 rx=2/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button></div>' > "$DEPLOY_DIR/.badge_html"
echo -n "${TIMING_HTML:-}" > "$DEPLOY_DIR/.timing_html"
echo -n "$PURPOSE_HTML" > "$DEPLOY_DIR/.purpose_html"
python3 -c "
import sys, pathlib
d = pathlib.Path(sys.argv[1])
t = pathlib.Path(sys.argv[2]).read_text()
t = t.replace('{{COMMIT_HTML}}', (d / '.commit_html').read_text())
t = t.replace('{{CARDS}}', (d / '.cards_html').read_text())
t = t.replace('{{RUN_LINK}}', (d / '.run_link').read_text())
t = t.replace('{{BADGE_HTML}}', (d / '.badge_html').read_text())
t = t.replace('{{TIMING_HTML}}', (d / '.timing_html').read_text())
t = t.replace('{{PURPOSE_HTML}}', (d / '.purpose_html').read_text())
sys.stdout.write(t)
" "$DEPLOY_DIR" "$TEMPLATE" > "$DEPLOY_DIR/index.html"
rm -f "$DEPLOY_DIR/.commit_html" "$DEPLOY_DIR/.cards_html" "$DEPLOY_DIR/.run_link" "$DEPLOY_DIR/.badge_html" "$DEPLOY_DIR/.timing_html" "$DEPLOY_DIR/.purpose_html"

cat > "$DEPLOY_DIR/404.html" <<'ERROREOF'
<!DOCTYPE html><html lang=en><head><meta charset=utf-8><title>404</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel=stylesheet>
<style>:root{--bg:oklch(8% 0.02 265);--fg:oklch(45% 0.01 265);--err:oklch(62% 0.22 25)}*{margin:0;padding:0;box-sizing:border-box}body{background:var(--bg);color:var(--fg);font-family:'Inter',system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}div{text-align:center}h1{color:var(--err);font-size:clamp(3rem,8vw,5rem);font-weight:700;letter-spacing:-.04em;margin-bottom:.5rem}p{font-size:1rem;max-width:32ch;line-height:1.5}</style>
</head><body><div><h1>404</h1><p>File not found. The QA recording may have failed or been cancelled.</p></div></body></html>
ERROREOF

# Copy research log to deploy dir if it exists
for rlog in qa-artifacts/*/research/research-log.json qa-artifacts/*/*/research/research-log.json qa-artifacts/before/*/research/research-log.json; do
  if [ -f "$rlog" ]; then
    cp "$rlog" "$DEPLOY_DIR/research-log.json"
    echo "Found research log: $rlog"
    break
  fi
done

# Copy generated test code to deploy dir
for tfile in qa-artifacts/*/research/reproduce.spec.ts qa-artifacts/*/*/research/reproduce.spec.ts qa-artifacts/before/*/research/reproduce.spec.ts; do
  if [ -f "$tfile" ]; then
    cp "$tfile" "$DEPLOY_DIR/reproduce.spec.ts"
    echo "Found test code: $tfile"
    break
  fi
done

# Generate badge SVGs into deploy dir
# Priority: research-log.json verdict (a11y-verified) > video review verdict (AI interpretation)
REPRO_COUNT=0 INCONC_COUNT=0 NOT_REPRO_COUNT=0 TOTAL_REPORTS=0

# Try research log first (ground truth from a11y assertions)
RESEARCH_VERDICT=""
REPRO_METHOD=""
if [ -f "$DEPLOY_DIR/research-log.json" ]; then
  RESEARCH_VERDICT=$(python3 -c "import json,sys; d=json.load(open(sys.argv[1])); print(d.get('verdict',''))" "$DEPLOY_DIR/research-log.json" 2>/dev/null || true)
  REPRO_METHOD=$(python3 -c "import json,sys; d=json.load(open(sys.argv[1])); print(d.get('reproducedBy','none'))" "$DEPLOY_DIR/research-log.json" 2>/dev/null || true)
  echo "Research verdict (a11y-verified): ${RESEARCH_VERDICT:-none} (by: ${REPRO_METHOD:-none})"
  if [ -n "$RESEARCH_VERDICT" ]; then
    TOTAL_REPORTS=1
    case "$RESEARCH_VERDICT" in
      REPRODUCED) REPRO_COUNT=1 ;;
      NOT_REPRODUCIBLE) NOT_REPRO_COUNT=1 ;;
      INCONCLUSIVE) INCONC_COUNT=1 ;;
    esac
  fi
fi

# Fall back to video review verdicts if no research log
if [ -z "$RESEARCH_VERDICT" ] && [ -d video-reviews ]; then
  for rpt in video-reviews/*-qa-video-report.md; do
    [ -f "$rpt" ] || continue
    TOTAL_REPORTS=$((TOTAL_REPORTS + 1))
    # Try structured JSON verdict first (from ## Verdict section)
    VERDICT_JSON=$(grep -oP '"verdict":\s*"[A-Z_]+' "$rpt" 2>/dev/null | tail -1 | grep -oP '[A-Z_]+$' || true)
    RISK_JSON=$(grep -oP '"risk":\s*"[a-z]+' "$rpt" 2>/dev/null | tail -1 | grep -oP '[a-z]+$' || true)

    if [ -n "$VERDICT_JSON" ]; then
      case "$VERDICT_JSON" in
        REPRODUCED) REPRO_COUNT=$((REPRO_COUNT + 1)) ;;
        NOT_REPRODUCIBLE) NOT_REPRO_COUNT=$((NOT_REPRO_COUNT + 1)) ;;
        INCONCLUSIVE) INCONC_COUNT=$((INCONC_COUNT + 1)) ;;
      esac
    else
      # Fallback: grep Summary section (for older reports without ## Verdict)
      SUMM=$(sed -n '/^## Summary/,/^## /p' "$rpt" 2>/dev/null | head -15)
      if echo "$SUMM" | grep -iq 'INCONCLUSIVE'; then
        INCONC_COUNT=$((INCONC_COUNT + 1))
      elif echo "$SUMM" | grep -iq 'not reproduced\|could not reproduce\|could not be confirmed\|unable to reproduce\|fails\? to reproduce\|fails\? to perform\|was NOT\|NOT visible\|not observed\|fail.* to demonstrate\|does not demonstrate\|steps were not performed\|never.*tested\|never.*accessed\|not.* confirmed'; then
        NOT_REPRO_COUNT=$((NOT_REPRO_COUNT + 1))
      elif echo "$SUMM" | grep -iq 'reproduc\|confirm'; then
        REPRO_COUNT=$((REPRO_COUNT + 1))
      fi
    fi
  done
fi
FAIL_COUNT=$((TOTAL_REPORTS - REPRO_COUNT - NOT_REPRO_COUNT))
[ "$FAIL_COUNT" -lt 0 ] && FAIL_COUNT=0
echo "DEBUG verdict: repro=${REPRO_COUNT} not_repro=${NOT_REPRO_COUNT} inconc=${INCONC_COUNT} fail=${FAIL_COUNT} total=${TOTAL_REPORTS}"
echo "Verdict: ${REPRO_COUNT}✓ ${NOT_REPRO_COUNT}✗ ${FAIL_COUNT}⚠ / ${TOTAL_REPORTS}"

# Badge text:
#   Single pass: "REPRODUCED" / "NOT REPRODUCIBLE" / "INCONCLUSIVE"
#   Multi pass:  "2✓ 0✗ 1⚠ / 3" with color based on dominant result
REPRO_RESULT="" REPRO_COLOR="#9f9f9f"
if [ "$TOTAL_REPORTS" -le 1 ]; then
  # Single report — simple label
  if [ "$REPRO_COUNT" -gt 0 ]; then
    REPRO_RESULT="REPRODUCED" REPRO_COLOR="#2196f3"
  elif [ "$NOT_REPRO_COUNT" -gt 0 ]; then
    REPRO_RESULT="NOT REPRODUCIBLE" REPRO_COLOR="#9f9f9f"
  elif [ "$FAIL_COUNT" -gt 0 ]; then
    REPRO_RESULT="INCONCLUSIVE" REPRO_COLOR="#9f9f9f"
  fi
else
  # Multi pass — show breakdown: X✓ Y✗ Z⚠ / N
  PARTS=""
  [ "$REPRO_COUNT" -gt 0 ] && PARTS="${REPRO_COUNT}✓"
  [ "$NOT_REPRO_COUNT" -gt 0 ] && PARTS="${PARTS:+${PARTS} }${NOT_REPRO_COUNT}✗"
  [ "$FAIL_COUNT" -gt 0 ] && PARTS="${PARTS:+${PARTS} }${FAIL_COUNT}⚠"
  REPRO_RESULT="${PARTS} / ${TOTAL_REPORTS}"
  # Color based on best outcome
  if [ "$REPRO_COUNT" -gt 0 ]; then
    REPRO_COLOR="#2196f3"
  elif [ "$NOT_REPRO_COUNT" -gt 0 ]; then
    REPRO_COLOR="#9f9f9f"
  fi
fi

# Badge label: #NUM QA0327 (with today's date)
QA_DATE=$(date -u '+%m%d')
BADGE_LABEL="QA${QA_DATE}"
[ -n "${TARGET_NUM:-}" ] && BADGE_LABEL="#${TARGET_NUM} QA${QA_DATE}"

# For PRs, also extract fix quality from Overall Risk section
FIX_RESULT="" FIX_COLOR="#4c1"
if [ "$TARGET_TYPE" != "issue" ]; then
  # Try structured JSON risk first
  ALL_RISKS=$(grep -ohP '"risk":\s*"[a-z]+' video-reviews/*.md 2>/dev/null | grep -oP '[a-z]+$' || true)
  if [ -n "$ALL_RISKS" ]; then
    # Use worst risk across all reports
    if echo "$ALL_RISKS" | grep -q 'high'; then
      FIX_RESULT="MAJOR ISSUES" FIX_COLOR="#e05d44"
    elif echo "$ALL_RISKS" | grep -q 'medium'; then
      FIX_RESULT="MINOR ISSUES" FIX_COLOR="#dfb317"
    elif echo "$ALL_RISKS" | grep -q 'low'; then
      FIX_RESULT="APPROVED" FIX_COLOR="#4c1"
    fi
  else
    # Fallback: grep Overall Risk section
    RISK_TEXT=""
    if [ -d video-reviews ]; then
      RISK_TEXT=$(sed -n '/^## Overall Risk/,/^## /p' video-reviews/*.md 2>/dev/null | sed 's/\*//g' | head -20 || true)
    fi
    RISK_FIRST=$(echo "$RISK_TEXT" | grep -oiP '^\s*(high|medium|moderate|low|minimal|critical)' | head -1 | tr '[:upper:]' '[:lower:]' || true)
    if [ -n "$RISK_FIRST" ]; then
      case "$RISK_FIRST" in
        *low*|*minimal*) FIX_RESULT="APPROVED" FIX_COLOR="#4c1" ;;
        *medium*|*moderate*) FIX_RESULT="MINOR ISSUES" FIX_COLOR="#dfb317" ;;
        *high*|*critical*) FIX_RESULT="MAJOR ISSUES" FIX_COLOR="#e05d44" ;;
      esac
    elif echo "$RISK_TEXT" | grep -iq 'no.*risk\|approved\|looks good'; then
      FIX_RESULT="APPROVED" FIX_COLOR="#4c1"
    fi
  fi
fi

# Always use vertical box badge
/tmp/gen-badge-box.sh "$DEPLOY_DIR/badge.svg" "$BADGE_LABEL" \
  "$REPRO_COUNT" "$NOT_REPRO_COUNT" "$FAIL_COUNT" "$TOTAL_REPORTS" \
  "$FIX_RESULT" "$FIX_COLOR" "$REPRO_METHOD"
BADGE_STATUS="${REPRO_RESULT:-UNKNOWN}${FIX_RESULT:+ | Fix: ${FIX_RESULT}}"
echo "badge_status=${BADGE_STATUS:-FINISHED}" >> "$GITHUB_OUTPUT"

# Remove files exceeding Cloudflare Pages 25MB limit to prevent silent deploy failures
MAX_SIZE=$((25 * 1024 * 1024))
find "$DEPLOY_DIR" -type f -size +${MAX_SIZE}c | while read -r big_file; do
  SIZE_MB=$(( $(stat -c%s "$big_file") / 1024 / 1024 ))
  echo "Removing oversized file: $(basename "$big_file") (${SIZE_MB}MB > 25MB limit)"
  rm "$big_file"
done

BRANCH=$(echo "$RAW_BRANCH" | sed 's/[^a-zA-Z0-9-]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//' | cut -c1-28)

DEPLOY_OUTPUT=$(wrangler pages deploy "$DEPLOY_DIR" \
  --project-name="comfy-qa" \
  --branch="$BRANCH" 2>&1) || true
echo "$DEPLOY_OUTPUT" | tail -5

URL=$(echo "$DEPLOY_OUTPUT" | grep -oE 'https://[a-zA-Z0-9.-]+\.pages\.dev\S*' | head -1 || true)
FALLBACK_URL="https://${BRANCH}.comfy-qa.pages.dev"

echo "url=${URL:-$FALLBACK_URL}" >> "$GITHUB_OUTPUT"
echo "Deployed to: ${URL:-$FALLBACK_URL}"
