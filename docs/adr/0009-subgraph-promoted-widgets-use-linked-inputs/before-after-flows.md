# Appendix: Before and after flows

This appendix visualizes the ownership and migration flows described in
[ADR 0009](../0009-subgraph-promoted-widgets-use-linked-inputs.md).

## Before: proxy widgets and linked inputs overlap

Historically, promoted widgets could be represented both as serialized
`properties.proxyWidgets` entries and as linked subgraph inputs. Runtime value
reads could collapse back to the interior source widget, while host
`widgets_values` could also carry an exterior value for the same promoted UI.

```mermaid
flowchart TD
  workflow[Workflow JSON] --> proxyWidgets[properties.proxyWidgets]
  workflow --> hostValues[host widgets_values]
  proxyWidgets --> promotionStore[PromotionStore / promotion runtime]
  promotionStore --> sourceWidget[Interior source widget]
  linkedInput[Linked SubgraphInput] --> hostWidget[Host promoted widget]
  sourceWidget --> hostWidget
  hostValues --> hostWidget
  hostWidget --> prompt[Prompt serialization]
  hostWidget -. may copy value back .-> sourceWidget
  sourceWidget -. shared by host instances .-> otherHost[Another host instance]

  classDef legacy fill:#fff3cd,stroke:#a66f00,color:#332200
  classDef ambiguous fill:#f8d7da,stroke:#842029,color:#330000
  classDef canonical fill:#d1e7dd,stroke:#0f5132,color:#052e16

  class proxyWidgets,promotionStore legacy
  class sourceWidget,hostValues ambiguous
  class linkedInput,hostWidget canonical
```

Key problems in the old flow:

- `properties.proxyWidgets` and linked `SubgraphInput` widgets could describe
  the same promotion.
- Interior source widgets supplied both schema metadata and, in some flows,
  persisted host values.
- Multiple host instances of the same subgraph could stomp one another through
  the shared interior widget value.
- Display-only previews were mixed into widget-promotion language even though
  they do not own values or feed prompt serialization.

## After: linked inputs are the promoted-widget boundary

Promoted value widgets are now represented only as standard linked
`SubgraphInput` widgets. The source widget remains the schema/default provider,
but the host `SubgraphNode` owns the promoted value.

```mermaid
flowchart TD
  workflow[Workflow JSON] --> subgraphInterface[Subgraph interface / inputs]
  workflow --> hostValues[host widgets_values]
  subgraphInterface --> subgraphInput[SubgraphInput.name]
  subgraphInput --> hostWidget[Host-scoped widget entity]
  hostValues --> hostWidget
  sourceWidget[Interior source widget] --> schema[Schema, type, options, tooltip, default]
  schema --> hostWidget
  hostWidget --> prompt[Prompt serialization]

  hostIdentity[Host node locator + SubgraphInput.name] --> hostWidget
  sourceWidget -. metadata only .-> diagnostics[Diagnostics / lookup / migration]
  sourceWidget -. no host value ownership .-> schema

  classDef owner fill:#d1e7dd,stroke:#0f5132,color:#052e16
  classDef metadata fill:#cff4fc,stroke:#055160,color:#032830
  classDef persisted fill:#e2e3e5,stroke:#41464b,color:#212529

  class subgraphInterface,subgraphInput,hostWidget,hostIdentity owner
  class sourceWidget,schema,diagnostics metadata
  class workflow,hostValues persisted
```

Canonical ownership after the migration:

- UI/value identity is host-scoped: host node locator plus
  `SubgraphInput.name`.
- `SubgraphInput.name` is stable identity; labels and localized names are
  display-only.
- Host values win during repair, persistence, and prompt serialization.
- Source widgets provide metadata and defaults only.
- Canonical saves omit repaired `properties.proxyWidgets` entries.

## Legacy load migration

Loading a workflow with legacy `proxyWidgets` performs an idempotent repair. The
repair builds a plan before mutating graph state, then re-resolves against the
current graph when node IDs and links are stable.

```mermaid
flowchart TD
  start[Load workflow] --> parse{Parse properties.proxyWidgets}
  parse -->|invalid raw data| invalid[console.error and ignore]
  parse -->|valid tuples| plan[Build repair plan]
  plan --> classify{Classify entry}

  classify -->|value widget| valueRepair{Already linked SubgraphInput?}
  valueRepair -->|yes| consume[Consume legacy proxy entry]
  valueRepair -->|no| repair[Repair through subgraph input/link systems]
  repair --> repairResult{Repair succeeded?}
  repairResult -->|yes| consume
  repairResult -->|no| quarantine[Persist proxyWidgetErrorQuarantine]

  classify -->|primitive fanout| primitive[Validate all primitive targets]
  primitive --> primitiveResult{All targets reconnectable?}
  primitiveResult -->|yes| primitiveRepair[Create one SubgraphInput and reconnect fanout]
  primitiveRepair --> consume
  primitiveResult -->|no| quarantine

  classify -->|display-only preview| preview[Create / keep previewExposures entry]
  preview --> consume

  consume --> save[Canonical save]
  quarantine --> save
  save --> omit[Omit repaired entries from proxyWidgets]
  save --> keepQuarantine[Persist unrepaired value intent in quarantine]
  save --> keepPreview[Persist previews in previewExposures]

  classDef ok fill:#d1e7dd,stroke:#0f5132,color:#052e16
  classDef warn fill:#fff3cd,stroke:#a66f00,color:#332200
  classDef error fill:#f8d7da,stroke:#842029,color:#330000
  classDef neutral fill:#e2e3e5,stroke:#41464b,color:#212529

  class consume,repair,primitiveRepair,preview,save,omit,keepPreview ok
  class plan,classify,valueRepair,primitive,primitiveResult,repairResult neutral
  class quarantine,keepQuarantine warn
  class invalid error
```

## Preview exposures are separate from value widgets

Display-only previews, such as `$$canvas-image-preview`, are not promoted
widgets. They have host-scoped serialized identity, but they do not create
prompt inputs, do not create `widgets_values`, and do not own user values.

```mermaid
flowchart TD
  hostNode[Host SubgraphNode] --> previewExposures[properties.previewExposures]
  previewExposures --> exposure[PreviewExposure.name]
  exposure --> sourceLocator[sourceNodeId + sourcePreviewName]
  sourceLocator --> runtimePreview[Runtime preview/output state]
  runtimePreview --> hostCanvas[Host canvas / app-mode preview]

  exposure --> uiIdentity[hostNodeLocator + previewName]
  runtimePreview -. UI projection only .-> hostCanvas
  previewExposures -. no prompt input .-> noPrompt[No prompt serialization]
  previewExposures -. no value widget .-> noValue[No widgets_values entry]
  previewExposures -. no graph edge .-> noEdge[No executable graph edge]

  classDef preview fill:#cff4fc,stroke:#055160,color:#032830
  classDef noValue fill:#f8d7da,stroke:#842029,color:#330000
  classDef persisted fill:#e2e3e5,stroke:#41464b,color:#212529

  class previewExposures,exposure,sourceLocator,runtimePreview,hostCanvas,uiIdentity preview
  class noPrompt,noValue,noEdge noValue
  class hostNode persisted
```

For nested subgraphs, preview exposures chain across immediate host boundaries
instead of persisting flattened deep paths.

```mermaid
flowchart LR
  outerHost[Outer SubgraphNode] --> outerExposure[Outer previewExposures entry]
  outerExposure --> innerHost[Immediate inner SubgraphNode]
  innerHost --> innerExposure[Inner previewExposures entry]
  innerExposure --> deepestPreview[Interior preview source]
  deepestPreview --> media[Resolved media]

  outerExposure -. sourcePreviewName names inner preview identity .-> innerExposure
  outerExposure -. does not persist deep private path .-> opaque[Subgraph internals remain opaque]

  classDef boundary fill:#d1e7dd,stroke:#0f5132,color:#052e16
  classDef preview fill:#cff4fc,stroke:#055160,color:#032830
  classDef note fill:#fff3cd,stroke:#a66f00,color:#332200

  class outerHost,innerHost boundary
  class outerExposure,innerExposure,deepestPreview,media preview
  class opaque note
```

## Serialization summary

```mermaid
flowchart TD
  canonical[Canonical serialized SubgraphNode] --> inputs[Subgraph interface / inputs]
  canonical --> values[widgets_values for host-owned values]
  canonical --> previews[properties.previewExposures]
  canonical --> quarantine[properties.proxyWidgetErrorQuarantine]
  canonical -. omits repaired entries .-> noProxy[No canonical proxyWidgets]

  inputs --> valueWidgets[Promoted value widgets]
  values --> valueWidgets
  previews --> previewUi[Display-only preview UI]
  quarantine --> futureTooling[Future recovery tooling]

  valueWidgets --> prompt[Prompt serialization]
  previewUi -. not serialized into prompt .-> prompt
  quarantine -. inert .-> prompt

  classDef canonical fill:#d1e7dd,stroke:#0f5132,color:#052e16
  classDef inert fill:#fff3cd,stroke:#a66f00,color:#332200
  classDef removed fill:#f8d7da,stroke:#842029,color:#330000

  class inputs,values,valueWidgets,prompt,canonical canonical
  class previews,previewUi,quarantine,futureTooling inert
  class noProxy removed
```
