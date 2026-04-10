---
name: coverage-test-picker
description: 'Reads coverage reports, identifies high-value untested code, randomly picks candidate(s), and generates task files with full context for agents to write tests. Use when asked to: pick a test, coverage test, what should I test next, coverage-guided test, random test from coverage, find untested code, suggest a test to write.'
---

# Coverage-Guided Test Picker

Reads unit and E2E coverage reports, ranks files by coverage gaps weighted by churn, randomly picks candidate(s) from the top 20, and generates self-contained task markdown files that other agents can execute to write tests.

## Phase 0: Locate Coverage Data

Coverage data comes from two sources. Try them in this order — stop as soon as you have at least one LCOV file.

### Strategy 1: Local Coverage Files (fastest)

```bash
UNIT_LCOV="coverage/lcov.info"          # From: pnpm test:coverage
E2E_LCOV="coverage/playwright/coverage.lcov"  # From: pnpm test:browser:coverage

[ -f "$UNIT_LCOV" ] && echo "✅ Unit LCOV found" || echo "❌ No unit LCOV"
[ -f "$E2E_LCOV" ] && echo "✅ E2E LCOV found" || echo "❌ No E2E LCOV"
```

### Strategy 2: Download from CI (preferred when local files missing)

**Important**: Use workflow **display names** (not filenames) with `gh run list`:

```bash
# Unit coverage — artifact name: "unit-coverage"
RUN_ID=$(gh run list --workflow="CI: Tests Unit" --branch=main --status=success \
  --limit=1 --json databaseId -q '.[0].databaseId')
if [ -n "$RUN_ID" ]; then
  gh run download "$RUN_ID" --name unit-coverage --dir temp/coverage/ 2>/dev/null
fi

# E2E coverage — artifact name: "e2e-coverage"
RUN_ID=$(gh run list --workflow="CI: E2E Coverage" --branch=main --status=success \
  --limit=1 --json databaseId -q '.[0].databaseId')
if [ -n "$RUN_ID" ]; then
  gh run download "$RUN_ID" --name e2e-coverage --dir temp/coverage/ 2>/dev/null
fi
```

If download fails (artifact not found), check what artifact names the workflow actually uploads:

```bash
gh run view "$RUN_ID" --json jobs -q '.jobs[].steps[].name' | grep -i upload
gh api "repos/{owner}/{repo}/actions/runs/$RUN_ID/artifacts" --jq '.artifacts[].name'
```

**Note**: Coverage artifacts may not exist yet if the coverage PR (#10977) hasn't merged. In that case, use Strategy 3.

### Strategy 3: Generate Locally (slowest — 3-10 minutes)

```bash
# Unit coverage — typically 2-5 minutes
pnpm test:coverage
# Output: coverage/lcov.info

# E2E coverage — typically 10-50 minutes, only do if you specifically need E2E data
COLLECT_COVERAGE=true pnpm test:browser:local
```

**Do NOT run E2E coverage locally unless specifically asked** — it takes a very long time. Unit coverage alone is sufficient for most picks.

### If No Coverage Data Available

Tell the user: "No coverage data found locally or in CI. Run `pnpm test:coverage` to generate unit coverage (~3 min), or wait for CI coverage artifacts to be available."

**Stop here** — do not guess or proceed without real LCOV data.

## Phase 1: Parse & Rank

### 1a. Parse LCOV

For each LCOV file found, extract per-file stats:

```bash
# Parse LCOV into: missed_lines coverage_pct total_lines filepath
grep -E '^(SF:|LF:|LH:)' "$LCOV_FILE" | paste - - - | \
  awk -F'[:\t]' '{file=$2; lf=$4; lh=$6; missed=lf-lh; pct=(lf>0?lh/lf*100:100); print missed, pct, lf, file}' | \
  sort -rn > /tmp/coverage_raw.txt
```

### 1b. Filter Out Noise

```bash
grep -v -E '(\.d\.ts|/locales/|/assets/|\.test\.ts|\.spec\.ts|\.stories\.ts|/lib/litegraph/)' \
  /tmp/coverage_raw.txt | \
  awk '$1 > 0 && $3 > 0' > /tmp/coverage_filtered.txt
```

This removes:

- Files at 100% coverage (missed=0) or 0 lines (empty/generated)
- Type declarations, locales, assets, test files, stories
- `src/lib/litegraph/**` (has its own test suite, excluded from vitest config)

### 1c. Weight by Git Churn

```bash
git log --since="90 days ago" --name-only --pretty=format: -- 'src/**' | \
  grep -v '^$' | sort | uniq -c | sort -rn > /tmp/churn.txt
```

Compute composite score = `missed_lines × (1 + log2(churn_count + 1))`:

```bash
awk '
NR==FNR { gsub(/^[ \t]+/, ""); churn[$2] = $1; next }
{
  missed=$1; pct=$2; lf=$3; file=$4
  c = (file in churn) ? churn[file] : 0
  score = missed * (1 + log(c + 1)/log(2))
  printf "%.1f\t%d\t%.1f%%\t%d\t%s\n", score, missed, pct, c, file
}' /tmp/churn.txt /tmp/coverage_filtered.txt | sort -t$'\t' -k1 -rn | head -20 > /tmp/top20.txt
```

### 1d. Classify Candidates

For each candidate in the top 20, determine test type by path:

- **Unit test**: paths containing `composables/`, `stores/`, `utils/`, `services/`, `schemas/`, `scripts/` (non-Vue pure logic)
- **E2E test**: paths containing `components/`, `views/`, or files ending in `.vue`
- **Either**: ambiguous — note both in the task file

### 1e. Display Top 20

Print the ranked table for the user:

```
# | Score  | Missed | Cov%   | Churn | File                              | Type
1 | 4852.5 | 890    | 12.3%  | 42    | src/scripts/app.ts                | either
2 | 3140.4 | 612    | 5.1%   | 28    | src/extensions/core/groupNode.ts  | unit
...
```

## Phase 2: Random Pick

Pick N candidates randomly from the top 20 (default N=1, user can request more):

```bash
# Default: pick 1. If user says "pick 5", set N=5
N=${PICK_COUNT:-1}
shuf -i 1-20 -n "$N" | while read idx; do
  sed -n "${idx}p" /tmp/top20.txt
done
```

Show which file(s) were picked with their rank, score, missed lines, churn, and coverage %.

## Phase 3: Generate Task File

For **each** picked candidate, create `temp/plans/test-task-<filename>.md`.

### 3a. Discover Related Skills (dynamic — never hardcode)

Search both repo and global skill directories for test-relevant skills:

```bash
# Repo skills — search frontmatter description lines
for f in $(find .claude/skills/ -name "SKILL.md" 2>/dev/null); do
  head -5 "$f" | grep -qi \
    -e "test" -e "playwright" -e "e2e" -e "browser" -e "vitest" \
    -e "unit test" -e "component" -e "flak" -e "coverage" -e "tdd" \
    -e "quality" -e "spec" && echo "$f"
done

# Global skills — same search
for f in $(find ~/.claude/skills/ -name "SKILL.md" 2>/dev/null); do
  head -5 "$f" | grep -qi \
    -e "test" -e "playwright" -e "e2e" -e "browser" -e "vitest" \
    -e "unit test" -e "component" -e "flak" -e "coverage" -e "tdd" \
    -e "quality" -e "spec" && echo "$f"
done
```

For each match, extract `name:` from frontmatter. Filter to only skills relevant to the picked test type (e.g., skip playwright skills for a unit test pick). Format as `use-skill: <name>` in the task file.

### 3b. Discover Related Documentation

```bash
# All markdown in browser_tests/ (for e2e picks)
find browser_tests/ -name "*.md" -type f

# Testing docs (always)
ls docs/testing/*.md

# Guidance docs (by type)
# e2e: docs/guidance/playwright.md
# unit: docs/guidance/vitest.md
```

For each doc found, include the path and a one-line description (read the first heading or first line).

### 3c. Determine Test Placement

**Unit tests** — colocated next to source:

```bash
SOURCE="src/composables/useImageCrop.ts"
TEST_FILE="${SOURCE%.ts}.test.ts"  # src/composables/useImageCrop.test.ts
[ -f "$TEST_FILE" ] && echo "ADD to existing: $TEST_FILE" || echo "CREATE new: $TEST_FILE"
```

**E2E tests** — find the best-fit existing spec file:

```bash
# Search for spec files with similar names or in related directories
FEATURE_NAME="imageCrop"  # derived from source file
find browser_tests/tests/ -name "*.spec.ts" | xargs grep -li "$FEATURE_NAME" 2>/dev/null
# Also check directory names for feature area match
ls browser_tests/tests/
```

If no existing file matches, suggest the most appropriate subdirectory and explain why.

### 3d. Audit Available Helpers & Patterns

**For E2E tests** — list every file with its key exports:

```bash
for f in browser_tests/fixtures/*.ts \
         browser_tests/fixtures/components/*.ts \
         browser_tests/fixtures/helpers/*.ts \
         browser_tests/fixtures/utils/*.ts \
         browser_tests/helpers/*.ts \
         browser_tests/utils/*.ts \
         browser_tests/types/*.ts; do
  [ -f "$f" ] || continue
  EXPORTS=$(grep -E '^export (class|function|const|interface|type|enum)' "$f" | \
    sed 's/export //' | cut -d'(' -f1 | cut -d'=' -f1 | cut -d'<' -f1 | \
    tr '\n' ', ' | sed 's/, $//')
  echo "- \`$f\`: $EXPORTS"
done
```

**For unit tests** — check for shared test utilities and note patterns from docs:

```bash
# Find any shared test helpers
find src/ -name "*test*util*" -o -name "*test*helper*" -o -name "__test*" 2>/dev/null | \
  grep -v node_modules | grep -v '.test.ts'

# Key patterns to reference
echo "See: docs/testing/unit-testing.md (mocking patterns, composable testing)"
echo "See: docs/testing/store-testing.md (if testing a Pinia store)"
echo "See: docs/testing/component-testing.md (if testing a Vue component)"
```

### 3e. Read the Source File

Before writing the task file, **read the actual source file** to extract:

- Key exported functions/classes/composables
- Dependencies that will need mocking (imports from `@/stores/`, `@/scripts/api`, external libs)
- Complexity indicators (LOC, number of functions, branching)

Include a "Key Dependencies to Mock" section in the task file.

### 3f. Assemble the Task File

The task file MUST contain ALL of these sections:

```markdown
# Test Task: <filename>

## Target File

- **Source**: `<full path>`
- **Current coverage**: <X>% lines, <Y> missed lines
- **Churn**: <N> commits in last 90 days
- **Composite score**: <S> (rank #<R> of 20)
- **Test type**: unit | e2e | either

## Coverage Gaps

<Specific uncovered functions/regions from reading the source file and LCOV data>

## Key Dependencies to Mock

<List imports from the source file that need mocking, with suggested mock approach>

## Skills to Load

<Dynamically discovered use-skill: directives, filtered by test type>

## Reference Documentation

<All relevant .md files with one-line description of each>

## Test Placement

- **Target test file**: `<path>`
- **Rationale**: <why this file — existing file to extend, or new colocated file>
- **Existing tests in same area**: <list nearby test files for reference>

## Project Guidelines

- Colocated tests: `*.test.ts` next to source (unit), `browser_tests/tests/*.spec.ts` (e2e)
- Frameworks: Vitest + @testing-library/vue (unit), Playwright (e2e)
- Run: `pnpm test:unit -- src/path/to/file.test.ts` (unit)
- Run: `pnpm test:browser:local -- --grep "feature name"` (e2e)
- Lint: `pnpm typecheck && pnpm lint`
- Tags (e2e only): @smoke, @slow, @screenshot, @canvas, @node, @widget, @mobile, @2x
- No `waitForTimeout` in e2e — use retrying assertions
- No change-detector tests — test behavior, not implementation
- Prefer `expect.poll()` over `expect().toPass()` for single assertions

## Available Helpers & Patterns

<Full audited list: file path, exported symbols, one-line summary>

## Anti-Patterns to Avoid

- Don't test mocks — ensure tests fail when real code breaks
- Don't mock what you don't own
- Don't create new utility files if existing helpers cover the need
- Don't add a new spec file if an existing one covers this feature area
- Don't write redundant tests — see https://tidyfirst.substack.com/p/composable-tests
```

## Phase 4: Spawn Work Environment

### Detect Available Tools

```bash
# Check tmux (must be inside a tmux session AND tmux installed)
TMUX_OK=false
if [ -n "$TMUX" ] && command -v tmux &>/dev/null; then
  TMUX_OK=true
fi

# Check worktree-utils (may need sourcing first)
WT_OK=false
if command -v wt-new &>/dev/null; then
  WT_OK=true
elif [ -f "$HOME/git-worktree-utils/worktree.sh" ]; then
  source "$HOME/git-worktree-utils/worktree.sh"
  command -v wt-new &>/dev/null && WT_OK=true
elif [ -f "/usr/local/share/git-worktree-utils/worktree.sh" ]; then
  source "/usr/local/share/git-worktree-utils/worktree.sh"
  command -v wt-new &>/dev/null && WT_OK=true
fi
```

### If worktree-utils available

For **each** picked candidate:

```bash
BRANCH="test/coverage-$(basename "$SOURCE_FILE" .ts)"

# 1. Create worktree
wt-new ComfyUI_frontend "$BRANCH"

# 2. Determine worktree path (wt-new uses __ for / in branch names)
WT_PATH="$WORKTREE_BASE/ComfyUI_frontend/${BRANCH//\//__}"

# 3. Create target directory and MOVE (not copy!) the task file
mkdir -p "$WT_PATH/temp/plans"
mv "temp/plans/test-task-$(basename "$SOURCE_FILE" .ts).md" "$WT_PATH/temp/plans/"
```

### If tmux available

After creating all worktrees, spawn a tmux window for each:

```bash
tmux new-window -c "$WT_PATH" -n "test-$(basename "$SOURCE_FILE" .ts)"
```

Tell user: "Task file(s) ready in new tmux window(s). Start an agent in each to execute."

### If tools are missing

Print what's missing and how to install:

```
⚠️  Missing: wt-new (git-worktree-utils)
   Install: brew install git-worktree-utils && git-worktree-utils-setup
   What: Manages bare-repo + worktree layout for parallel feature branches

⚠️  Missing: tmux
   Install: brew install tmux (or apt install tmux)
   What: Terminal multiplexer for running parallel agent sessions

Manual steps:
  1. git worktree add worktrees/test-<name> -b test/coverage-<name>
  2. mkdir -p worktrees/test-<name>/temp/plans
  3. mv temp/plans/test-task-<name>.md worktrees/test-<name>/temp/plans/
  4. cd worktrees/test-<name> && <start your agent with the task file>
```

## Anti-Patterns

- ❌ **Hardcoding skill names** — Always discover dynamically from `.claude/skills/` directories
- ❌ **Picking the #1 ranked file** — Random selection from top 20 ensures breadth over time
- ❌ **Generating the test itself** — This skill generates the _task file_; a separate agent writes the test
- ❌ **Ignoring existing test files** — Always check for existing coverage before suggesting new files
- ❌ **Running without coverage data** — Don't guess; require actual LCOV data
- ❌ **Using `cp` instead of `mv`** — Task files must be moved into the worktree, not copied, to avoid stale duplicates in the source repo
- ❌ **Running E2E coverage locally unprompted** — Takes 10-50 min; prefer CI artifacts or unit coverage only
