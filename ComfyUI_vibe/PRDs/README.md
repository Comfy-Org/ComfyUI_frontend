# Product Requirements Documents (PRDs)

This folder contains all PRDs for ComfyUI Vibe features.

## Structure

```
PRDs/
├── _templates/          # PRD templates
│   ├── feature-prd.md   # Full feature template
│   ├── enhancement-prd.md
│   └── quick-prd.md     # Lightweight template
├── active/              # Currently being worked on
├── backlog/             # Approved but not started
├── completed/           # Shipped features
└── archived/            # Deprecated/cancelled
```

## How to Create a PRD

### Option 1: Using Claude Commands (Recommended)

```bash
# Full PRD with all sections
/create-prd

# Quick PRD for small features
/quick-prd "Feature Name" --priority P2
```

### Option 2: Manual Creation

1. Copy the appropriate template from `_templates/`
2. Create a folder in `active/` with naming: `P{priority}-{feature-name}/`
3. Rename the template to `PRD.md`
4. Fill in all required sections

## Naming Convention

Feature folders use this pattern:
```
P{0-3}-{feature-name}/
```

Examples:
- `P0-critical-auth-fix/`
- `P1-node-search-panel/`
- `P2-dark-mode-toggle/`
- `P3-keyboard-shortcuts/`

## Priority Levels

| Priority | Meaning | SLA |
|----------|---------|-----|
| P0 | Critical - Blocks release, security issues | Immediate |
| P1 | High - Important feature, must-have | Current sprint |
| P2 | Medium - Nice to have, planned | Next sprint |
| P3 | Low - Future consideration | Backlog |

## Workflow

1. **PRD Created** → `active/`
2. **PRD Approved** → Start implementation
3. **Feature Shipped** → Move to `completed/`
4. **PRD Cancelled** → Move to `archived/`

## Agent Workflow

After PRD creation, use these agents in sequence:

1. `/create-prd` - Create the PRD
2. `/ux-review` - UX Agent reviews user flows
3. `/ui-design` - UI Agent creates component specs
4. `/product-review` - Product Agent final review
5. `/generate-tasks` - Convert PRD to implementation tasks

## PRD Sections Overview

### Required Sections
- Overview (problem statement, goals)
- User Stories
- Requirements (functional & non-functional)
- Acceptance Criteria

### Optional Sections
- Technical Specification
- Implementation Plan
- Risks and Mitigations

## Templates

| Template | Use Case |
|----------|----------|
| `feature-prd.md` | New features requiring full spec |
| `enhancement-prd.md` | Improvements to existing features |
| `quick-prd.md` | Small changes, bug fixes |
