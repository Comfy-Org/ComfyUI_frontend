#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/../../../fixing-web-prs/evals/_shared/scaffold.sh" "$(dirname "$0")/state" no-branch
