# Link Registration Migration Notes

`LinkNetwork.addFloatingLink(link)` now returns `LLink | undefined`.

For a new runtime link, pass the unassigned link id and use the returned link:

```ts
const registeredLink = graph.addFloatingLink(link)
if (!registeredLink) return
```

Registration returns the stored link when it succeeds or when the same link is
already present in the topology store. If another runtime link already owns the
id, registration logs an error, leaves the incoming link detached, and returns
`undefined`. It does not silently replace the live link or assign the incoming
link another identity. `graph.floatingLinks` remains the filtered compatibility
view for one-ended links.

`graph.links` and `graph.floatingLinks` are owner-filtered, store-backed
compatibility views rather than independent native `Map` storage. Their normal
`Map` read methods use a cached membership snapshot; acquire a new iterator
after topology membership changes instead of retaining an existing iterator.
Both views require an active Pinia and no longer represent a missing store as
an empty graph.

Like native `Map.set()`, `view.set(id, link)` returns the view, not a registration
result. Registration can reject an ID or target collision while preserving the
incumbent, so extensions that insert through a view should confirm success with
`get()` or `has()`. Prefer graph connection and floating-link APIs when they
cover the operation because those APIs coordinate the surrounding lifecycle.
Do not invoke `Map.prototype` methods directly against either view or depend on
native `Map` internal storage.

Input replacement commits the new link before old-link disconnect callbacks,
so callback queries see the replacement rather than an empty input. Normal
connection callbacks follow.

Extensions that previously ignored the return value should handle
`undefined` before retaining, rendering, or mutating the incoming link. Do not
preselect a positive link id for a new runtime link; allow the graph to mint
one.

Persisted-id collision repair belongs to workflow import and
deserialization. Extensions importing serialized topology should normalize
conflicting ids at that boundary before using the runtime registration API.

Constructing a root `LGraph`, or configuring one from serialized data, requires
an active Pinia because graph topology is store-backed throughout its lifecycle.
