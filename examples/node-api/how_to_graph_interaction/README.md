# How-To: graph interaction

This pack demonstrates editor behavior without reaching into a canvas or node
instance:

- **Lifecycle Badge** stores pack-owned state outside the node, saves/restores
  it with lifecycle hooks, and exposes host-rendered menu actions and a badge.
- **Image Gate** accepts only image connections through `onBeforeConnect` and
  otherwise acts as a frontend reroute.
- **Drop Text File** accepts a browser `.txt` file and commits its contents to a
  real widget.
- **Graph Builder** adds and connects a local source/target pair in one undo
  step. Its other buttons demonstrate duplicate and same-type replacement.

Open the Lifecycle Badge node's context menu to change its state. Drag a text
file onto Drop Text File. Use Graph Builder and press Undo once to remove the
entire generated pair.
