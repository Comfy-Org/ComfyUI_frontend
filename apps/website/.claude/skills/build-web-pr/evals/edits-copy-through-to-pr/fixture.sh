#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/../../../fix-web-pr/evals/_shared/scaffold.sh" "$(dirname "$0")/state" no-branch
