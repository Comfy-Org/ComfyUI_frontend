# World API and Command Layer

How the ECS World's imperative API relates to ADR 0003's command pattern
requirement, and why the two are complementary rather than conflicting.

This document responds to the concern that `world.setComponent()` and
`ConnectivitySystem.connect()` are "imperative mutators" incompatible with
serializable, idempotent commands. The short answer: they are the
**implementation** of commands, not a replacement for them.

## Architectural Layering

```
Caller  →  Command  →  System (handler)  →  World (store)  →  Y.js (sync)
               ↓
         Command Log (undo, replay, sync)
```

- **Commands** describe intent. They are serializable, deterministic, and
  idempotent.
- **Systems** are command handlers. They validate, execute, and emit lifecycle
  events.
- **The World** is the store. It holds component data. It does not know about
  commands.

This is the same relationship Redux has between actions, reducers, and the
store. The store's `dispatch()` is imperative. That does not make Redux
incompatible with serializable actions.

## Proposed World Mutation API

The World exposes a thin imperative surface. Every mutation goes through a
system, and every system call is invoked by a command.

### World Core API

```ts
interface World {
  // Reads (no command needed)
  getComponent<C>(id: EntityId, key: ComponentKey<C>): C | undefined
  hasComponent(id: EntityId, key: ComponentKey<C>): boolean
  queryAll<C extends ComponentKey[]>(...keys: C): QueryResult<C>[]

  // Mutations (called only by systems, inside transactions)
  createEntity<K extends EntityKind>(kind: K): EntityIdFor<K>
  deleteEntity<K extends EntityKind>(kind: K, id: EntityIdFor<K>): void
  setComponent<C>(id: EntityId, key: ComponentKey<C>, data: C): void
  removeComponent(id: EntityId, key: ComponentKey<C>): void

  // Transaction boundary
  transaction<T>(label: string, fn: () => T): T
}
```

These methods are **internal**. External callers never call
`world.setComponent()` directly — they submit commands.

### Command Interface

```ts
interface Command<T = void> {
  readonly type: string
  execute(world: World): T
}
```

A command is a plain object with a `type` discriminator and an `execute`
method that receives the World. The command executor wraps every
`execute()` call in a World transaction.

### Command Executor

```ts
interface CommandExecutor {
  run<T>(command: Command<T>): T
  batch(label: string, commands: Command[]): void
}

function createCommandExecutor(world: World): CommandExecutor {
  return {
    run(command) {
      return world.transaction(command.type, () => command.execute(world))
    },
    batch(label, commands) {
      world.transaction(label, () => {
        for (const cmd of commands) cmd.execute(world)
      })
    }
  }
}
```

Every command execution:

1. Opens a World transaction (maps to one `beforeChange`/`afterChange`
   bracket for undo).
2. Calls the command's `execute()`, which invokes system functions.
3. Commits the transaction. On failure, rolls back — no partial writes, no
   lifecycle events, no version bump.

## From Imperative Calls to Commands

The lifecycle scenarios in
[ecs-lifecycle-scenarios.md](ecs-lifecycle-scenarios.md) show system calls
like `ConnectivitySystem.connect(world, outputSlotId, inputSlotId)`. These
are the **internals** of a command. Here is how each scenario maps:

### Connect Slots

The lifecycle scenario shows:

```ts
// Inside ConnectivitySystem — this is the handler, not the public API
ConnectivitySystem.connect(world, outputSlotId, inputSlotId)
```

The public API is a command:

```ts
const connectSlots: Command = {
  type: 'ConnectSlots',
  outputSlotId,
  inputSlotId,

  execute(world) {
    ConnectivitySystem.connect(world, this.outputSlotId, this.inputSlotId)
  }
}

executor.run(connectSlots)
```

The command object is serializable (`{ type, outputSlotId, inputSlotId }`).
It can be sent over a wire, stored in a log, or replayed.

### Move Node

```ts
const moveNode: Command = {
  type: 'MoveNode',
  nodeId,
  pos: [150, 250],

  execute(world) {
    LayoutSystem.moveNode(world, this.nodeId, this.pos)
  }
}
```

### Remove Node

```ts
const removeNode: Command = {
  type: 'RemoveNode',
  nodeId,

  execute(world) {
    ConnectivitySystem.removeNode(world, this.nodeId)
  }
}
```

### Set Widget Value

```ts
const setWidgetValue: Command = {
  type: 'SetWidgetValue',
  widgetId,
  value,

  execute(world) {
    world.setComponent(this.widgetId, WidgetValue, {
      ...world.getComponent(this.widgetId, WidgetValue)!,
      value: this.value
    })
  }
}
```

### Batch: Paste

Paste is a compound operation — many entities created in one undo step:

```ts
const paste: Command = {
  type: 'Paste',
  snapshot,
  offset,

  execute(world) {
    const remap = new Map<EntityId, EntityId>()

    for (const entity of this.snapshot.entities) {
      const newId = world.createEntity(entity.kind)
      remap.set(entity.id, newId)

      for (const [key, data] of entity.components) {
        world.setComponent(newId, key, remapEntityRefs(data, remap))
      }
    }

    // Offset positions
    for (const [, newId] of remap) {
      const pos = world.getComponent(newId, Position)
      if (pos) {
        world.setComponent(newId, Position, {
          ...pos,
          pos: [pos.pos[0] + this.offset[0], pos.pos[1] + this.offset[1]]
        })
      }
    }
  }
}

executor.run(paste) // one transaction, one undo step
```

## Addressing the Six Concerns

The PR review raised six "critical conflicts." Here is how the command layer
resolves each:

### 1. "The World API is imperative, not command-based"

Correct — by design. The World is the store. Commands are the public
mutation API above it. `world.setComponent()` is to commands what
`state[key] = value` is to Redux reducers.

### 2. "Systems are orchestrators, not command producers"

Systems are command **handlers**. A command's `execute()` calls system
functions. Systems do not spontaneously mutate the World — they are invoked
by commands.

### 3. "Auto-incrementing IDs are non-stable in concurrent environments"

For local-only operations, auto-increment is fine. For CRDT sync, entity
creation goes through a CRDT-aware ID generator (Y.js provides this via
`doc.clientID` + logical clock). The command layer can select the ID
strategy:

```ts
// Local-only command
world.createEntity(kind) // auto-increment

// CRDT-aware command (future)
world.createEntityWithId(kind, crdtGeneratedId)
```

This is an ID generation concern, not an ECS architecture concern.

### 4. "No transaction primitive exists"

`world.transaction(label, fn)` is the primitive. It maps to one
`beforeChange`/`afterChange` bracket. The command executor wraps every
`execute()` call in a transaction. See the [migration plan's Phase 3→4
gate](ecs-migration-plan.md#phase-3---4-gate-required) for the acceptance
criteria.

### 5. "No idempotency guarantees"

Idempotency is a property of the command, not the store. Two strategies:

- **Content-addressed IDs**: The command specifies the entity ID rather than
  auto-generating. Replaying the command with the same ID is a no-op if the
  entity already exists.
- **Command deduplication**: The command log tracks applied command IDs.
  Replaying an already-applied command is skipped.

Both are standard CRDT patterns and belong in the command executor, not the
World.

### 6. "No error semantics"

Commands return results. The executor can wrap execution:

```ts
type CommandResult<T> =
  | { status: 'applied'; value: T }
  | { status: 'rejected'; reason: string }
  | { status: 'no-op' }

function run<T>(command: Command<T>): CommandResult<T> {
  try {
    const value = world.transaction(command.type, () => command.execute(world))
    return { status: 'applied', value }
  } catch (e) {
    if (e instanceof RejectionError) {
      return { status: 'rejected', reason: e.message }
    }
    throw e
  }
}
```

Rejection semantics (e.g., `onConnectInput` returning false) throw a
`RejectionError` inside the system, which the transaction rolls back.

## Why Two ADRs

ADR 0003 defines the command pattern and CRDT sync layer.
ADR 0008 defines the entity data model.

They are **complementary architectural layers**, not competing proposals:

| Concern                   | Owns It  |
| ------------------------- | -------- |
| Entity taxonomy and IDs   | ADR 0008 |
| Component decomposition   | ADR 0008 |
| World (store)             | ADR 0008 |
| Command interface         | ADR 0003 |
| Undo/redo via command log | ADR 0003 |
| CRDT sync                 | ADR 0003 |
| Serialization format      | ADR 0008 |
| Replay and idempotency    | ADR 0003 |

Merging them into a single mega-ADR would conflate the data model with the
mutation strategy. Keeping them separate allows each to evolve independently
— the World can change its internal representation without affecting the
command API, and the command layer can adopt new sync strategies without
restructuring the entity model.

## Relationship to Lifecycle Scenarios

The [lifecycle scenarios](ecs-lifecycle-scenarios.md) show system-level
calls (`ConnectivitySystem.connect()`, `ClipboardSystem.paste()`, etc.).
These are the **inside** of a command — what the command handler does when
the command is executed.

The scenarios deliberately omit the command layer to focus on how systems
interact with the World. Adding command wrappers is mechanical: every
system call shown in the scenarios becomes the body of a command's
`execute()` method.

## When This Gets Built

The command layer is not part of the initial ECS migration phases (0–3).
During Phases 0–3, the bridge layer provides mutation entry points that
will later become command handlers. The command layer is introduced in
Phase 4 when write paths migrate from legacy to ECS:

- **Phase 4a**: Position write commands replace direct `node.pos =` assignment
- **Phase 4b**: Connectivity commands replace `node.connect()` /
  `node.disconnect()`
- **Phase 4c**: Widget value commands replace direct store writes

Each Phase 4 step introduces commands for one concern, with the system
function as the handler and the World transaction as the atomicity
boundary.
