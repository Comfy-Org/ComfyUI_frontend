When dragging the outer group in Vue mode:

1. getAllNestedItems(selected) returns ALL items: outer group + inner groups + nodes
2. moveChildNodesInGroupVueMode loops through all items
3. For outer group G1: calls G1.move(delta, true) then moveGroupChildren(G1, ...)
4. moveGroupChildren calls G2.move(delta) (no skipChildren) - this moves G2 AND G2's children!
5. Then the loop reaches G2: calls G2.move(delta, true) - moves G2 again!
6. Plus moveGroupChildren(G2, ...) processes G2's children again

Inner groups get moved twice, their children get moved multiple times - causing the "strange movement" behavior.
