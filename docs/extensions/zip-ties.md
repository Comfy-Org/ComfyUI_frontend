# Workflow wire zip ties

The built-in `Comfy.ZipTie` extension bundles multiple workflow links through a
shared, draggable cable tie. Each link retains its type and endpoints.

1. Drag a selection marquee across two or more wires in empty canvas space.
2. Click **Zip tie selected links** in the selection toolbar. Alternatively,
   right-click empty canvas and choose the same action to place the tie there.
3. Drag the tie's central clasp to move the entire bundle.
4. Right-click the clasp and choose **Release zip tie** to remove its routing
   points while keeping the connections and earlier reroutes.

Press **Escape** during a drag to restore the original position. Creating,
moving, and releasing a tie use the canvas change notifications for undo/redo.
Read-only canvases do not allow these changes.

Ties use native reroutes and store their reroute IDs in `extra.zipTies`, so they
remain editable after saving and reopening a workflow. A frontend without the
extension still renders the saved native reroutes. Copying a subset of nodes or
converting nodes into a subgraph preserves native routing according to the
existing graph operations, but does not recreate the zip-tie clasp metadata.
