# Research: Identity Encapsulation in the Extension API

Date: 2026-05-12

## Question

When do extensions need access to raw entity IDs (`NodeEntityId`, `WidgetEntityId`, `SlotEntityId`)? Should these be exposed or hidden?

## Current State

The v2 extension API exposes entity IDs as read-only properties:

```ts
interface NodeHandle {
  readonly entityId: NodeEntityId
  // ...
}

interface WidgetHandle {
  readonly entityId: WidgetEntityId
  // ...
}

interface SlotInfo {
  readonly entityId: SlotEntityId
  // ...
}
```

All IDs are **branded types** to prevent accidental mixing at compile time.

## Use Cases for Raw Entity IDs

### 1. Per-Instance State Mapping

Extensions maintaining external state per node:

```ts
const nodeCache = new Map<NodeEntityId, CachedData>()

defineNode({
  name: 'my-cache-extension',
  nodeCreated(handle) {
    nodeCache.set(handle.entityId, computeExpensiveData())
    onNodeRemoved(() => nodeCache.delete(handle.entityId))
  }
})
```

### 2. Logging and Debugging

```ts
node.on('executed', (e) => {
  console.log(`[${node.entityId}] Output:`, e.output)
})
```

### 3. Inter-Extension Communication

Extensions that need to coordinate across multiple nodes:

```ts
// Extension A stores data
globalState.set(nodeA.entityId, data)

// Extension B retrieves it
const data = globalState.get(nodeB.entityId)
```

### 4. External System Interop

Extensions integrating with analytics, debugging tools, or external services that need stable node identifiers.

## Analysis

### Arguments FOR Exposing Entity IDs

1. **Legitimate need exists** — The use cases above are real and common.
2. **Branded types prevent misuse** — Can't accidentally use `NodeEntityId` where `WidgetEntityId` is expected.
3. **Read-only access** — Extensions can't mutate the ID or corrupt internal state.
4. **Opaque value** — The format (`node:<graphUuid>:<localId>`) is an implementation detail; extensions should treat it as an opaque string.

### Arguments AGAINST Exposing Entity IDs

1. **Format coupling** — Extensions might parse the ID string and break if format changes.
2. **Internal detail leakage** — Knowing the ID scheme reveals ECS architecture.
3. **Future migration friction** — Changing ID representation requires careful deprecation.

### Mitigations

- **Document as opaque**: JSDoc clearly states IDs are opaque, not to be parsed.
- **Branded types**: TypeScript prevents misuse across entity categories.
- **Phase A format**: Current format includes graph UUID + local ID; this can evolve via semver.

## Recommendation

**Keep exposing entity IDs.** The use cases are legitimate, the branded types provide safety, and the read-only nature limits risk. Document that IDs are opaque strings — extensions should never parse or construct them.

### Guidelines for Extension Authors

1. **Use IDs only for keying** — Maps, Sets, logging, external system references.
2. **Never parse IDs** — The format is an implementation detail subject to change.
3. **Prefer handles over IDs** — When passing references between functions, use the handle object, not the raw ID.
4. **Clean up on removal** — Always use `onNodeRemoved()` to clean up Maps keyed by entityId.

## Future Considerations

If the ID format needs to change significantly, the branded types allow us to:

1. Introduce a new branded type (e.g., `NodeEntityIdV2`)
2. Deprecate the old ID with migration guidance
3. Keep both supported during a transition period
