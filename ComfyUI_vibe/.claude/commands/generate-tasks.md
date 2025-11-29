# Generate Tasks

Convert a PRD into actionable implementation tasks.

## Usage

```
/generate-tasks [path-to-prd]
```

Or run from within a PRD folder:
```
/generate-tasks
```

## Process

### Step 1: Read PRD

Parse the PRD file and extract:
- User Stories (US-XX)
- Functional Requirements (FR-XX)
- Technical Specification (file changes)
- Acceptance Criteria

### Step 2: Analyze Dependencies

1. Read the affected components/files mentioned in PRD
2. Identify dependencies between tasks
3. Group tasks by implementation phase

### Step 3: Generate Tasks

Create tasks following this structure:

```markdown
# Implementation Tasks: [Feature Name]

**PRD Reference:** [./PRD.md](./PRD.md)

## Task Status Legend
- [ ] Not started
- [x] Completed
- [~] In progress

---

## Phase 1: Foundation

### Setup Tasks
- [ ] **TASK-001**: Create component file structure
  - Files: `src/components/v2/[feature]/`
  - Dependencies: None
  - Linked PRD: FR-01

---

## Phase 2: Core Implementation

- [ ] **TASK-002**: Implement main component
  - Files: `src/components/v2/[feature]/[Name].vue`
  - Dependencies: TASK-001
  - Linked PRD: US-01, FR-01

---

## Phase 3: Integration & Testing

- [ ] **TASK-003**: Write unit tests
  - Dependencies: TASK-002
  - Linked PRD: TC-01, TC-02

- [ ] **TASK-004**: Run quality checks
  - Commands: `pnpm typecheck && pnpm lint && pnpm build`
  - Dependencies: All previous tasks
```

### Step 4: Estimate Complexity

For each task, add complexity indicator:
- 🟢 Simple (< 1 hour)
- 🟡 Medium (1-4 hours)
- 🔴 Complex (> 4 hours)

## Output

Creates or updates `tasks.md` in the PRD folder:

```
PRDs/active/P{X}-{feature-name}/
├── PRD.md
└── tasks.md   # Generated/updated
```

## Task Naming Convention

```
TASK-{NNN}: {Verb} {Object}
```

Examples:
- TASK-001: Create component file structure
- TASK-002: Implement search input component
- TASK-003: Add keyboard navigation
- TASK-004: Write unit tests

## Example Output

```markdown
# Implementation Tasks: Node Search Panel

**PRD Reference:** [./PRD.md](./PRD.md)

## Progress: 0/8 tasks complete

---

## Phase 1: Foundation (2 tasks)

- [ ] 🟢 **TASK-001**: Create NodeSearch component structure
  - Files: `src/components/v2/canvas/NodeSearch.vue`
  - Dependencies: None
  - Linked PRD: FR-01

- [ ] 🟡 **TASK-002**: Define TypeScript interfaces
  - Files: `src/types/search.ts`
  - Dependencies: None
  - Linked PRD: FR-01, FR-02

---

## Phase 2: Core Implementation (4 tasks)

- [ ] 🟡 **TASK-003**: Implement search input with debounce
  - Files: `src/components/v2/canvas/NodeSearch.vue`
  - Dependencies: TASK-001, TASK-002
  - Linked PRD: US-01

- [ ] 🔴 **TASK-004**: Add fuzzy search algorithm
  - Files: `src/utils/search.ts`
  - Dependencies: TASK-002
  - Linked PRD: FR-03

- [ ] 🟡 **TASK-005**: Implement results list with virtualization
  - Dependencies: TASK-003, TASK-004
  - Linked PRD: FR-04, NFR-01

- [ ] 🟡 **TASK-006**: Add keyboard navigation
  - Dependencies: TASK-005
  - Linked PRD: US-02, FR-05

---

## Phase 3: Polish & Testing (2 tasks)

- [ ] 🟡 **TASK-007**: Write unit tests
  - Dependencies: TASK-003, TASK-004, TASK-006
  - Linked PRD: TC-01, TC-02

- [ ] 🟢 **TASK-008**: Run quality checks
  - Commands: `pnpm typecheck && pnpm lint && pnpm build`
  - Dependencies: All tasks
```

## Next Steps

After generating tasks:
1. Review task breakdown with team
2. Assign tasks to developers
3. Start with Phase 1 tasks
4. Update task status as work progresses
