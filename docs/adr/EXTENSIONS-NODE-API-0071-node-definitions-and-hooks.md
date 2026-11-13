# ADR-EXTENSIONS-NODE-API-0071: Node definitions and the hooks a pack adds to them

Date: 2026-11-12

## Status

Proposed

## Context

[ADR-EXTENSIONS-NODE-API-0070](EXTENSIONS-NODE-API-0070-versioned-node-api-with-document-scoped-handles.md)
gives packs one versioned object, `comfy`, and handles to the nodes of the open
document. Packs also need to work with node types: read a type's definition,
add a type of their own, and add behaviour to a type, the work they do today
with the `beforeRegisterNodeDef` hook by patching the class the host generates
for each type. `comfy.defs` is that part of the API. In the census of the old
contract it is the most used member: `Comfy.defs` is reached by 112 of 125
stored packs and `DefRegistry.extend` by 109.

Two facts shape it. The host registers node types more than once: at startup,
again for every definition when node definitions are reloaded, and again when
late custom nodes turn on
([ADR-EXTENSION-LOADING-0048](EXTENSION-LOADING-0048-late-custom-nodes-turn-on-after-the-editor-opens.md)).
And a pack's module may run before or after the types it extends are
registered, so `extend` cannot depend on the order.

## Decision

### Where the API hears of node types

1. The API registers one extension with the host's extension service, named
   `Comfy.NodeApi.v4.NodeTypes`, when the store publishes the API, before any
   extension module loads. It is registered once however often the API is
   published. Its `beforeRegisterNodeDef` hook records each type the host
   registers and applies the matching extensions to it; its
   `refreshComboInNodes` hook tells `onRefreshed` listeners. The host's hooks
   are used as they are: no host function changes what it does.
2. The API keeps its own index of node types: each type its hook heard of and
   each type a pack defined, in the order each first registered, with a
   reference to the host's definition (no copy). A type registered again
   replaces its entry in place. `get`, `has`, `all` and `extend` read this one
   index, so a type that `extend` would apply to is exactly a type `has`
   reports.

### `extend`

3. `extend(selector, apply)` calls `apply` with a builder for each type the
   selector picks: at once for the types already in the index, and later for
   each type as it registers. A type registered again is extended again, with
   its new definition, as the legacy hook is.
4. A selector is a type name, a list of names, a `RegExp` tested against the
   name, `{ category }` with a name or a `RegExp`, or a function given the
   definition. Each form is used by stored packs. A pattern is copied without
   its `g` and `y` flags, so it answers the same for every type. A function is
   asked through the listener isolation of ADR-EXTENSIONS-NODE-API-0070 decision 14: one that
   throws is reported and does not pick the type, and only `true` picks it.
   The definition is built only when a function selector or an `apply` needs
   it, once per registration.
5. Anything else is refused with a `TypeError` before anything is registered:
   a value of another kind, an object with fields other than `category`, a
   category that is neither text nor a pattern, a list holding a non-name, or
   an `apply` that is not a function.
6. An `apply` that throws is reported and the others still run. An extension
   made, or a type defined, inside an `apply` is applied once to each type.
7. The disposer stops later applications of that extension only, and is safe
   to call twice.

### Reading definitions

8. `get(type)` gives a new frozen copy of the definition each time: type,
   title, category, description, inputs, outputs, hidden inputs and whether
   it is an output node. Inputs are the required ones then the optional ones,
   in the order the server declared them. An input's `options` and the hidden
   inputs are copied as JSON and frozen, so nothing a pack does to them
   reaches the host. A combo input carries its `values`, from either combo
   spelling the server uses. The title and description are the ones the
   editor shows, in the user's language, and a type with no display name is
   titled by its name, as the host titles its nodes. `localizedName` is the
   input label the editor shows.
9. `has(type)` and `all()` read the same index; `all()` lists the types in the
   order each first registered. A type name that is not text is refused.

### `define`

10. `define(definition)` registers a node type the pack owns, through
    `LiteGraph.registerNodeType`, as packs register frontend types today. The
    class is the API's own subclass of `LGraphNode`: it adds the declared
    inputs and outputs, and takes the title, category and description. With
    `execution: 'frontend'` its nodes are virtual, so the prompt builder
    leaves them out. The type joins the index, and every extension that picks
    it applies.
11. A definition is checked whole before anything is registered: a plain
    object of the documented fields only, a type name that is non-empty, is
    not a property of `Object.prototype`, and is not registered yet, text for
    the title, category and description, slots of exactly a text `name` and a
    text `type`, and `'backend'` or `'frontend'`. An empty slot name is
    allowed because a stored pack declares one.
12. The disposer unregisters the type and removes it from the index, only if
    the type is still the one this call registered. A type the host has
    registered under the same name since is left alone.

### Refresh

13. `refresh()` asks the host to reload the node definitions and resolves to
    the host's answer: `false` when the host did not apply them. A failure of
    the reload itself rejects, as the host's reload does.
14. `onRefreshed(listener)` is told after every reload, whoever asked for it,
    through the listener primitive of ADR-EXTENSIONS-NODE-API-0070, which gains `notify()` for
    delivery that keeps its listeners.

## Alternatives considered

- Call the API from `litegraphService.registerNodeDef`, as the earlier
  attempt did. That changes a host function to serve the API, when the
  extension hook it already calls gives the same information.
- Read definitions from the node-definition store. It is updated only after
  the types are registered and only when the Vue app is ready, so a pack
  extending at registration time would see a type `get` does not know; and it
  lists frontend-only types with inputs and outputs it does not know, for
  which a definition with none would be wrong. The API's index holds only
  references, so it costs one entry per type.
- Index extensions by type name so registration does not test every
  extension. Registration tests each extension once per type, which is a
  string comparison for most selectors; nobody has measured a cost that an
  index would remove.
- Make `refresh()` reject when the host did not apply the reload, as review
  finding B-19 asks. The repository's error-handling guidance asks for a
  command's outcome as a `boolean` rather than a throw, and its lint rule
  refuses `throw new Error`. Resolving `false` makes the failure observable,
  which is what B-19 is about; the open question is recorded for the owner.

## Consequences

- A user can disable `Comfy.NodeApi.v4.NodeTypes` in the extension list, as
  any core extension; packs then hear of no new types.
- A type a legacy pack registers directly with LiteGraph is not in the index:
  `has` is false for it and `extend` does not apply to it. The core frontend
  types (`Reroute`, `Note`, `PrimitiveNode`) are such types. No stored pack
  extends one.
- Extensions apply to a type in the order they were made, so the hooks of a
  type run in that order however the pack modules loaded.
- Host changes: `useComfyApiStore().publish()` registers the extension.

## What this feature replaces or duplicates, and why

- **The type index** sits beside `LiteGraph.registered_node_types` and the
  node-definition store. The first has no definitions and includes types that
  were never defined; the second is updated later than the hook. See
  "Alternatives considered".
- **Copying a definition** uses the JSON copy and deep freeze that handles
  already use for property values, moved from `nodeHandle.ts` to
  `nodeApi/shared/savedCopy.ts` so both use one. Input types and combo values
  come from `getInputSpecType` and `getComboSpecComboOptions` in
  `@comfyorg/object-info-parser`, and the shown names from the host's own
  `resolveNodeDefText` and `resolveNodeDefSlotText`.
- **Calling a pack callback** goes through `callListener`, the error isolation
  the listener primitive already had, now exported so every callback the API
  calls is reported the same way.
