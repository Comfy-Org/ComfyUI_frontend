# PRD: [Feature Name]

| Field | Value |
|-------|-------|
| **PRD ID** | PRD-YYYY-MM-NNN |
| **Status** | Draft / In Review / Approved / In Progress / Completed |
| **Priority** | P0 (Critical) / P1 (High) / P2 (Medium) / P3 (Low) |
| **Owner** | [Name/GitHub handle] |
| **Created** | YYYY-MM-DD |
| **Last Updated** | YYYY-MM-DD |
| **GitHub Issue** | #[issue-number] or N/A |
| **Target Version** | v[X.Y.Z] |

---

## 1. Overview

### 1.1 Problem Statement
[Describe the problem this feature solves. What pain point does it address?]

### 1.2 Goal
[Clear, measurable objective. What does success look like?]

### 1.3 Non-Goals
[Explicitly state what this PRD does NOT cover to prevent scope creep]

- Not implementing X
- Not changing Y

---

## 2. User Stories

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| US-01 | [role] | [action] | [benefit] | P0-P3 |
| US-02 | | | | |

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-01 | [Description] | P0-P3 | |
| FR-02 | | | |

### 3.2 Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-01 | Performance | [e.g., "Load time < 200ms"] |
| NFR-02 | Accessibility | [e.g., "WCAG 2.1 AA compliant"] |
| NFR-03 | Browser Support | [e.g., "Chrome, Firefox, Safari latest"] |

---

## 4. Technical Specification

### 4.1 Architecture

[Describe how this fits into the existing architecture]

**Affected Layers:**
- [ ] Components (v1/v2)
- [ ] Composables
- [ ] Stores (Pinia)
- [ ] Services
- [ ] Types
- [ ] Utils

### 4.2 Design Patterns to Follow

Based on CLAUDE.md guidelines:
- [ ] Composition API with `<script setup lang="ts">`
- [ ] No hardcoded values (use `import.meta.env.VITE_*`)
- [ ] TypeScript strict mode (no `any` types)
- [ ] Semantic CSS tokens (no `dark:` variants)
- [ ] DRY principles via composables
- [ ] Zod for API response validation

### 4.3 Component Interface

```typescript
// Example interface definition
interface Props {
  // Define expected props
}

interface Emits {
  // Define events
}
```

### 4.4 Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| [Name] | Internal/External | [Why needed] |

---

## 5. UX Specification

### 5.1 User Flow

[Describe the user journey step by step]

1. User opens...
2. User clicks...
3. System responds...

### 5.2 Wireframes/Mockups

[Link to Figma/design files or embed images]

### 5.3 Interactions

| Trigger | Action | Feedback |
|---------|--------|----------|
| Click button X | Opens modal | Modal animates in |
| | | |

---

## 6. UI Specification

### 6.1 Components Needed

| Component | Type | Location |
|-----------|------|----------|
| [Name] | New/Existing | src/components/v2/... |

### 6.2 Styling Requirements

- Colors: [semantic tokens to use]
- Typography: [font sizes, weights]
- Spacing: [padding, margins]
- Responsive: [breakpoints to consider]

---

## 7. Acceptance Criteria

### 7.1 Definition of Done

- [ ] All user stories implemented
- [ ] Unit tests written and passing
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm build` succeeds
- [ ] Code reviewed and approved
- [ ] No hardcoded values
- [ ] Follows naming conventions

### 7.2 Test Scenarios

| ID | Scenario | Expected Result |
|----|----------|-----------------|
| TC-01 | [Description] | [Outcome] |
| TC-02 | | |

---

## 8. Implementation Plan

### 8.1 Phases

| Phase | Tasks | Assignee |
|-------|-------|----------|
| 1 | [Setup/Foundation] | |
| 2 | [Core Implementation] | |
| 3 | [Testing/Polish] | |

### 8.2 File Changes

| File Path | Action | Description |
|-----------|--------|-------------|
| `src/components/v2/[name].vue` | Create | New component |
| `src/stores/[name]Store.ts` | Modify | Add state |

---

## 9. Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| [Description] | High/Med/Low | High/Med/Low | [Strategy] |

---

## 10. Open Questions

- [ ] [Question 1]
- [ ] [Question 2]

---

## 11. References

- [Link to design mockups]
- [Link to related PRDs]
- [Link to external documentation]

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| YYYY-MM-DD | [Name] | Initial draft |
