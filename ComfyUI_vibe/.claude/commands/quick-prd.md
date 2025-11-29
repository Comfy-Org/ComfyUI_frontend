# Quick PRD

Create a lightweight PRD for smaller features or enhancements.

## Usage

```
/quick-prd "Feature Name" --priority P2
```

Or interactively:
```
/quick-prd
```

## When to Use

Use quick PRD for:
- Small enhancements
- Bug fixes that need documentation
- Minor UI changes
- Features that don't need full technical specification

For complex features, use `/create-prd` instead.

## Process

### Step 1: Gather Basic Info

Ask for:
1. Feature name
2. One-sentence description
3. Priority (P0-P3)
4. 3-5 requirements

### Step 2: Create Quick PRD

1. Create folder: `PRDs/active/P{X}-{feature-name}/`
2. Copy `PRDs/_templates/quick-prd.md`
3. Fill in sections

### Step 3: Generate Content

Fill in:
- Summary (1 paragraph)
- Problem (1-2 sentences)
- Solution (brief description)
- Requirements (3-5 items)
- Acceptance criteria (3-5 checkboxes)
- Implementation notes (affected files)

## Output

Creates:
```
PRDs/active/P{X}-{feature-name}/
└── PRD.md   # Quick PRD (single file)
```

## Template

```markdown
# Quick PRD: [Feature Name]

| Priority | P{X} |
| Status | Draft |
| Owner | [Name] |
| Created | YYYY-MM-DD |

## Summary
[One paragraph]

## Problem
[What problem does this solve?]

## Solution
[Brief description]

## Requirements
1. [Requirement]
2. [Requirement]
3. [Requirement]

## Acceptance Criteria
- [ ] [Criterion]
- [ ] [Criterion]
- [ ] pnpm typecheck passes
- [ ] pnpm lint passes

## Implementation Notes
- Affected files: src/...
- Dependencies: None
```

## Example

**Input:**
```
/quick-prd "Add tooltip to node header" --priority P3
```

**Output:**
```
Created: PRDs/active/P3-add-tooltip-to-node-header/PRD.md

Quick PRD created with:
- Summary: Add informative tooltips to node headers
- 3 requirements
- 4 acceptance criteria
```
