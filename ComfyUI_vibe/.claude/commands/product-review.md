# Product Review Agent

Final product review before implementation begins.

## Usage

```
/product-review [path-to-prd]
```

Or run from within a PRD folder to review that PRD.

## Role

As the Product Agent, you will:
1. Review PRD for completeness
2. Validate requirements against goals
3. Check scope and priorities
4. Identify risks and blockers
5. Give final approval or request changes

## Process

### Step 1: Read Full PRD

Review all sections:
- Overview (problem, goals, non-goals)
- User Stories
- Requirements (functional & non-functional)
- Technical Specification
- UX Specification
- UI Specification
- Acceptance Criteria
- Implementation Plan

### Step 2: Validate Against Goals

Check that:
- [ ] Problem statement is clear and valid
- [ ] Solution addresses the problem
- [ ] Scope is appropriate (not too big/small)
- [ ] Non-goals are clearly defined
- [ ] Success metrics are measurable

### Step 3: Review Requirements

For each requirement:
- [ ] Is it necessary for the goal?
- [ ] Is it achievable with current tech?
- [ ] Is it testable?
- [ ] Is priority correctly assigned?

### Step 4: Check Completeness

Ensure all sections are filled:

| Section | Status | Notes |
|---------|--------|-------|
| Overview | ✅/❌ | |
| User Stories | ✅/❌ | |
| Requirements | ✅/❌ | |
| Technical Spec | ✅/❌ | |
| UX Spec | ✅/❌ | |
| UI Spec | ✅/❌ | |
| Acceptance Criteria | ✅/❌ | |
| Implementation Plan | ✅/❌ | |

### Step 5: Identify Risks

Document potential risks:
- Technical risks (complexity, dependencies)
- Resource risks (time, skills)
- User risks (adoption, confusion)
- Business risks (competition, relevance)

### Step 6: Generate Review Summary

Create a review summary with:

```markdown
## Product Review Summary

**PRD:** [Feature Name]
**Reviewer:** Product Agent
**Date:** YYYY-MM-DD
**Status:** Approved / Changes Requested / Blocked

### Overview Assessment

| Criteria | Score | Notes |
|----------|-------|-------|
| Problem Clarity | 1-5 | |
| Solution Fit | 1-5 | |
| Scope Appropriateness | 1-5 | |
| Requirements Quality | 1-5 | |
| Technical Feasibility | 1-5 | |
| **Overall** | X/25 | |

### Strengths
1. [Strength 1]
2. [Strength 2]

### Concerns
1. [Concern 1] - Severity: High/Medium/Low
2. [Concern 2] - Severity: High/Medium/Low

### Required Changes (if any)
1. [ ] [Change 1]
2. [ ] [Change 2]

### Recommendations
1. [Recommendation 1]
2. [Recommendation 2]

### Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| [Risk 1] | High/Med/Low | High/Med/Low | [Strategy] |

### Decision

**Status:** [Approved / Changes Requested / Blocked]

**Rationale:** [Why this decision was made]

**Next Steps:**
1. [Step 1]
2. [Step 2]
```

## Approval Criteria

### Auto-Approve (Score >= 20/25)
- All sections complete
- No high-severity concerns
- Clear acceptance criteria
- Reasonable scope

### Changes Requested (Score 15-19)
- Missing or incomplete sections
- Medium-severity concerns
- Ambiguous requirements
- Scope creep detected

### Blocked (Score < 15)
- Major gaps in PRD
- High-severity concerns
- Technical impossibility
- Misaligned with product goals

## Output

Updates/creates review in PRD folder:

```
PRDs/active/P{X}-{feature-name}/
├── PRD.md
├── tasks.md
├── ux-notes.md (if exists)
├── ui-spec.md (if exists)
└── review.md   # Product review summary
```

## Review Checklist

### Problem & Solution
- [ ] Problem is real and worth solving
- [ ] Solution addresses root cause
- [ ] Scope is well-defined
- [ ] Non-goals prevent scope creep

### User Stories
- [ ] Cover all user types
- [ ] Follow proper format
- [ ] Are testable
- [ ] Have appropriate priorities

### Requirements
- [ ] Necessary and sufficient
- [ ] Technically feasible
- [ ] Testable/verifiable
- [ ] Prioritized correctly

### Technical Spec
- [ ] Follows CLAUDE.md patterns
- [ ] Reuses existing components
- [ ] Dependencies identified
- [ ] No over-engineering

### UX Spec
- [ ] User flows complete
- [ ] States defined
- [ ] Accessibility considered
- [ ] Consistent with app

### UI Spec
- [ ] Components defined
- [ ] Uses design system
- [ ] Responsive behavior
- [ ] No hardcoded values

### Acceptance Criteria
- [ ] Definition of Done clear
- [ ] Test cases comprehensive
- [ ] Quality checks included

## Next Steps

After approval:
1. `/generate-tasks` - Create implementation tasks (if not done)
2. Assign to developer
3. Begin implementation
4. Schedule design review (if needed)
