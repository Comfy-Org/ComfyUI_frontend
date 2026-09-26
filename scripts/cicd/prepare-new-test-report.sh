#!/bin/bash
set -euo pipefail

report_root="${1:?report root is required}"
links=""

for project in chromium cloud; do
    report_dir="playwright-report-$project"
    if [ -f "$report_root/$report_dir/index.html" ]; then
        links="$links<li><a href=\"./$report_dir/index.html\">View $project report and video</a></li>"
    fi
done

if [ -z "$links" ]; then
    echo "No Playwright HTML reports found under $report_root" >&2
    exit 1
fi

sed "s|<!-- REPORT_LINKS -->|$links|" > "$report_root/index.html" <<'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Playwright videos for new tests</title>
    <style>
      body { font: 16px system-ui, sans-serif; max-width: 48rem; margin: 4rem auto; padding: 0 1rem; }
      li { margin: 1rem 0; }
    </style>
  </head>
  <body>
    <h1>Playwright videos for new tests</h1>
    <p>Choose the project that recorded the new or changed tests.</p>
    <ul><!-- REPORT_LINKS --></ul>
  </body>
</html>
EOF
