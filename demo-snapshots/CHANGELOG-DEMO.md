## v1.30.2 (2025-11-01)

Comparing v1.29.0 → v1.30.2. This changelog documents changes to the public API surface that third-party extensions and custom nodes depend on.

### ✨ Additions

**Type Aliases**

- `WorkflowId`

**Interfaces**

- `ExtensionMetadata`
  - Members: `id`, `name`, `version`, `description`

### 🔄 Modifications

> **Note**: Some modifications may be breaking changes.

**Interfaces**

- `ComfyApi`
  - ✨ Added member: `queuePromptAsync`
  - ✨ Added member: `cancelPrompt`
  - ✨ Added member: `getQueueStatus`
  - ⚠️ **Breaking**: Removed member: `queuePrompt`
- `NodeDef`
  - ✨ Added member: `input`
  - ✨ Added member: `output`
  - ✨ Added member: `output_name`
- `WorkflowMetadata`
  - ✨ Added member: `tags`
  - ✨ Added member: `thumbnail`

**Enums**

- `NodeStatus`
  - ✨ Added enum value: `ERROR`
  - ✨ Added enum value: `COMPLETED`

**Classes**

- `WorkflowManager`
  - ✨ Added member: `cache`
  - ✨ Added method: `deleteWorkflow()`
  - ✨ Added method: `searchWorkflows()`

---

