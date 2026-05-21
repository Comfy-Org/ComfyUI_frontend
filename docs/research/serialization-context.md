# Research: Serialization Context Simplification

Date: 2026-05-12

## Question

Can the serialization context be simplified from 4 values to fewer?

Current contexts:

- `'workflow'` — saving workflow to disk
- `'prompt'` — queueing a run (API call)
- `'clone'` — copy/paste operation
- `'subgraph-promote'` — widget becoming subgraph IO

## Use Case Analysis

### Context: 'workflow'

**Purpose**: Full persistence of user's work.

**What extensions need**: Serialize everything the user configured.

**Example**: A widget storing user preferences needs to include all settings.

### Context: 'prompt'

**Purpose**: Sending data to the backend for execution.

**What extensions need**:

- Transform values (dynamic prompts → resolved text)
- Skip preview-only widgets
- Materialize async sources (webcam → frame data)

**Example**:

```ts
widget.on('beforeSerialize', async (e) => {
  if (e.context === 'prompt') {
    e.setSerializedValue(await captureFrame())
  }
})
```

### Context: 'clone'

**Purpose**: Copy/paste should yield independent copy.

**What extensions need**: Reset instance-specific state while keeping user settings.

**Example**: A random seed widget might want a new seed on paste.

### Context: 'subgraph-promote'

**Purpose**: Widget becomes an input/output on a subgraph.

**What extensions need**: Convert internal representation to subgraph IO format.

**Example**: Internal state becomes an exposed parameter.

## Simplification Options

### Option A: Keep All 4 (Current State)

| Pro                                      | Con               |
| ---------------------------------------- | ----------------- |
| Each context has distinct semantics      | 4 cases to handle |
| Type system enforces valid values        | More complex API  |
| Clear intent for each serialization path |                   |

### Option B: Collapse to 2 ('persist' | 'execute')

```ts
context: 'persist' | 'execute'
// 'persist' = workflow, clone, subgraph-promote
// 'execute' = prompt
```

| Pro                                        | Con                             |
| ------------------------------------------ | ------------------------------- |
| Simpler mental model                       | Loses clone/promote distinction |
| Most extensions only care about this split | Can't reset seed on clone       |

### Option C: Remove Context Entirely

Extensions always transform regardless of context. The framework handles differences.

| Pro                          | Con                                            |
| ---------------------------- | ---------------------------------------------- |
| Simplest API                 | Loses control for edge cases                   |
| Framework handles all nuance | Some extensions need context-specific behavior |

## Recommendation

**Keep all 4 contexts.** The use cases are genuinely different:

1. **workflow vs prompt**: Very common distinction. Dynamic prompts only process on prompt; preview widgets skip prompt. This is the most important split.

2. **clone**: Less common, but needed for stateful widgets (random seeds, generated IDs, captured frames).

3. **subgraph-promote**: Specialized, but necessary for the subgraph feature to work correctly.

### Rationale

- Extensions that don't care can ignore the context.
- Extensions that do care have the information they need.
- The 4 values map to 4 distinct operations in the framework.
- Collapsing contexts would remove functionality with no real simplification gain.

### Mitigation for Complexity

- Document common patterns clearly
- Most extensions only need: `if (context === 'prompt')`
- Provide examples in JSDoc

## Note on Deprecation

The `NodeBeforeSerializeEvent` is deprecated (ADR-0010). The `WidgetBeforeSerializeEvent` remains supported and uses the same 4 contexts.

Since node-level serialization is being removed, this research applies to widget-level serialization only.
