# How-To: frontend nodes

This pack defines four nodes that remain in the saved workflow but resolve out
of the backend prompt:

- **Constant Text** returns a widget value as a literal.
- **Reroute** forwards its input.
- **Broadcast Text** supplies its value to unconnected `STRING` inputs in the
  same group.
- **First Connected** adds another input whenever its final input is connected,
  then forwards the first connected value.

Try `Constant Text -> Reroute -> Preview as Text`. To try the broadcaster, put
it and a node with an unconnected string input inside the same group.

The relevant APIs are `defs.define`, pure `resolve`/`supply` callbacks, and
`node.inputs.add()` from a connection lifecycle event.
