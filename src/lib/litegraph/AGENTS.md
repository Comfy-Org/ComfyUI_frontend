# Litegraph Guidelines

## Barrel Imports for Subgraph Code

Import `LGraph`, `Subgraph`, and `SubgraphNode` from the barrel
`@/lib/litegraph/src/litegraph`, not from their own modules such as
`@/lib/litegraph/src/LGraph`. `Subgraph` extends `LGraph` and `LGraph` creates
`Subgraph` instances, so importing either module directly causes a circular
dependency.

## Rectangle

The `size` and `pos` properties of `Rectangle` share the same array buffer.

## References

- `docs/WIDGET_SERIALIZATION.md`: `widget.serialize` (workflow persistence)
  versus `widget.options.serialize` (API prompt). Different code paths check
  each.
- `src/core/graph/subgraph-dynamic-input-limitations.md`: subgraph dynamic
  input limitations (autogrow, matchtype).
- `src/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers.ts`:
  `createTestSubgraph` and `createTestSubgraphNode` for subgraph tests.
