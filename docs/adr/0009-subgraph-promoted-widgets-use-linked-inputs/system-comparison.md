# Appendix: System comparison

This appendix compares the legacy promoted-widget systems with the canonical
linked-input model chosen by
[ADR 0009](../0009-subgraph-promoted-widgets-use-linked-inputs.md).

| Concern | Legacy `properties.proxyWidgets` promotions | Linked `SubgraphInput` promotions before migration | New canonical linked-input system |
| --- | --- | --- | --- |
| Serialized authority | `properties.proxyWidgets` stores source node/widget tuples as promotion topology. | Subgraph interface/input links can also represent the same exposed widget. | Subgraph interface/input links are the only canonical topology for promoted value widgets. |
| Load-time role | Hydrates promoted widgets directly from legacy tuples. | May already describe the promoted widget, creating overlap with `proxyWidgets`. | Existing linked inputs are accepted as resolved; legacy tuples are consumed by repair or quarantined. |
| Save-time role | Could be re-emitted as promotion state. | Serialized as normal subgraph interface data. | Repaired `proxyWidgets` entries are omitted; standard subgraph inputs plus host `widgets_values` are saved. |
| Value owner | Ambiguous: host `widgets_values` and the interior source widget could both carry the value. | Closer to the desired boundary model, but still coexisted with source/proxy ownership paths. | Host `SubgraphNode` owns value state through host-scoped widget identity. |
| Schema/default provider | Interior source widget provides schema and may also become persistence carrier. | Interior source widget provides source metadata through the link. | Interior source widget provides schema, type, options, tooltip, and defaults only. |
| UI identity | Often persisted by source node/widget identity. | Can use subgraph input identity, but mixed states still exist while proxy identity remains. | Host node locator plus `SubgraphInput.name`. |
| Display label handling | Source widget identity and display concerns can blur. | Uses existing subgraph input naming conventions. | `SubgraphInput.name` is stable identity; `label` / `localized_name` are display-only. |
| Multiple host instances | Risk of host instances stomping one another through shared interior values. | Better host boundary shape, but overlap with proxy/source value paths can reintroduce ambiguity. | Host-instance-owned sparse overlay prevents shared interior widget value stomping. |
| Prompt serialization | May read values through promoted runtime state that can collapse to source widgets. | Can serialize through standard subgraph input widgets when used consistently. | Promoted values serialize only through standard host-owned subgraph-input widgets. |
| Interior mutation on save | Existing `SubgraphNode.serialize()` behavior could copy exterior values into connected interior widgets. | Could still be affected by legacy copy-back behavior. | Copy-back is removed; source widgets are not persistence carriers. |
| Primitive-node promotions | Legacy tuples may point at `PrimitiveNode` outputs. | Not the canonical primitive fanout representation by itself. | Repaired all-or-nothing into one `SubgraphInput` that reconnects validated fanout targets. |
| Invalid or unresolved data | Invalid data could sit in legacy promotion state or fail repair paths. | Missing linked inputs can be ambiguous when proxy data exists. | Invalid raw data logs and is ignored; unrepaired valid value entries go to `proxyWidgetErrorQuarantine`. |
| Display-only previews | Often mixed into `proxyWidgets` despite not being value widgets. | Linked inputs are inappropriate because previews do not own values or prompt inputs. | Separate host-scoped `properties.previewExposures` entries model preview UI only. |
| Preview persistence | Preview selections can depend on source preview/widget-like identity. | No clean distinction from promoted widget inputs. | Preview identity is host node locator plus `previewName`; unresolved previews stay inert and persisted. |
| Nested preview behavior | Deep source identity can leak through host UI state. | Linked value inputs do not model display-only preview composition. | Preview exposures chain across immediate subgraph host boundaries; deep private paths are not persisted. |
| ECS compatibility | Weak: value identity can depend on source widget tuples and mutable interior widgets. | Partial: linked inputs fit boundary modeling, but duplicate authority remains. | Strong: host-scoped widget entity identity maps cleanly to ECS component state. |
| Long-term status | Legacy load-time input only. | Becomes the standard representation once overlap is removed. | Canonical system; `PromotionStore` becomes a temporary derived compatibility/index layer. |

## Practical migration summary

| Legacy shape | New result |
| --- | --- |
| Valid `proxyWidgets` entry already represented by a linked `SubgraphInput` | Entry is consumed; the existing linked input remains canonical. |
| Valid value-widget `proxyWidgets` entry without a linked input | Repair creates or reconnects standard subgraph input/link state. |
| Valid primitive fanout entry | Repair creates one `SubgraphInput`, reconnects all validated targets, and leaves the primitive node inert. |
| Valid value-widget entry that cannot be repaired | Entry is persisted in `properties.proxyWidgetErrorQuarantine` with the host value when available. |
| Preview-shaped legacy entry | Entry is migrated into `properties.previewExposures`, not a linked input. |
| Unresolved preview exposure | Entry remains inert in `previewExposures`; it is not quarantined because it owns no user value. |
| Invalid raw `proxyWidgets` data | Logs `console.error`, does not throw, and is not quarantined. |
