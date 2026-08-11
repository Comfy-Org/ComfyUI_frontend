# Link Registration Migration Notes

`LinkNetwork.addFloatingLink(link)` now returns `LLink | undefined`.

For a new runtime link, pass the unassigned link id and use the returned link:

```ts
const registeredLink = graph.addFloatingLink(link)
if (!registeredLink) return
```

Registration returns the stored link when it succeeds or when the same link
is already present in the floating-link registry. If another runtime link, or
a live link, already owns the id, registration logs an error, leaves the
incoming link detached, and returns `undefined`. It does not silently replace
the live link or assign the incoming link another identity.

Extensions that previously ignored the return value should handle
`undefined` before retaining, rendering, or mutating the incoming link. Do not
preselect a positive link id for a new runtime link; allow the graph to mint
one.

Persisted-id collision repair belongs to workflow import and
deserialization. Extensions importing serialized topology should normalize
conflicting ids at that boundary before using the runtime registration API.
