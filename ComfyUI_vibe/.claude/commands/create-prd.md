# Create PRD

Generate a structured Product Requirements Document for a new feature.

## Usage

This command creates a full PRD in the `PRDs/active/` folder.

## Process

### Step 1: Gather Information

Ask the user for:
1. **Feature Name**: What is this feature called?
2. **Problem Statement**: What problem does this solve?
3. **Priority**: P0 (Critical), P1 (High), P2 (Medium), P3 (Low)?
4. **Target Users**: Who will use this feature?

If a GitHub issue number is provided, extract information from the issue.

### Step 2: Analyze Codebase

Before writing the PRD:
1. Search for related existing components in `src/components/v2/`
2. Check if similar functionality exists
3. Identify potential dependencies
4. Review CLAUDE.md for patterns to follow

### Step 3: Create PRD Structure

1. Create folder: `PRDs/active/P{priority}-{feature-name}/`
2. Copy template from `PRDs/_templates/feature-prd.md`
3. Rename to `PRD.md`
4. Fill in all required sections

### Step 4: Generate Content

Fill in the PRD with:
- **Overview**: Problem statement, goals, non-goals
- **User Stories**: At least 2-3 user stories in the format "As a [role], I want [action], so that [benefit]"
- **Requirements**: Functional and non-functional requirements
- **Technical Specification**: Affected layers, patterns to follow
- **Acceptance Criteria**: Definition of done, test scenarios

### Step 5: Create Tasks File

Generate `tasks.md` in the same folder with implementation tasks broken down by phase.

## Output

The command will create:
```
PRDs/active/P{X}-{feature-name}/
├── PRD.md        # Full PRD document
└── tasks.md      # Implementation tasks
```

## Priority Mapping

| Input | PRD Priority | Meaning |
|-------|--------------|---------|
| P0, critical, urgent | P0 | Blocks release, security |
| P1, high, important | P1 | Must-have for sprint |
| P2, medium, enhancement | P2 | Nice to have |
| P3, low, future | P3 | Backlog item |

## Example

**Input:**
```
/create-prd
Feature: Node Search Panel
Problem: Users can't find nodes quickly in large workflows
Priority: P1
```

**Output:**
```
Created: PRDs/active/P1-node-search-panel/
  - PRD.md (full specification)
  - tasks.md (implementation breakdown)
```

## Next Steps

After PRD creation, suggest running:
1. `/ux-review` - UX Agent to review user flows
2. `/ui-design` - UI Agent to create component specs
3. `/product-review` - Product Agent final review
