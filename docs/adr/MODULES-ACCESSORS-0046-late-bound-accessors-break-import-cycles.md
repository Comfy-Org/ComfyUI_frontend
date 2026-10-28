# ADR-MODULES-ACCESSORS-0046: Late-bound accessors break import cycles

Date: 2026-10-22

## Status

Proposed

## Context

`pnpm deps:audit` forbids import cycles, type-only edges included. When a
low module needs a higher module that already imports it, the codebase uses
a late-bound accessor: a leaf module holds a reference, and the higher module
calls a `provide*` setter on it while it is evaluated. Readers call the
accessor later, at run time.

The accessor is correct only if the provider module has been evaluated
before the first read. Nothing checks this. It holds today because every
provider is statically reachable from `main.ts` through runtime imports. The
one exception is `useSessionCookie`. It loads lazily, so `authStore`
registers a thunk that imports it.

An accessor read before registration fails in one of three ways. A getter
guarded by `assert` names the missing provider. An unassigned binding,
exported or module-private, throws `TypeError: … is not a function`, which
does not name it. An optional read, such as `remintUnified?.(…) ?? null` in
`remintRetry`, returns a fallback and reports nothing.

The `LiteGraph` singleton uses the same shape. The barrel constructs the one
`LiteGraphGlobal` and calls `registerLiteGraphInstance`. Modules that the
barrel evaluates before itself finishes read the singleton through
`litegraphInstance`. `useGlobalLitegraph` exposes that same object as
`window.LiteGraph`. `instanceof` checks and custom nodes depend on there being
only one instance.

ADR-TYPES-LITEGRAPH-0044 removed the type-level cycles. It requires runtime
providers to stay statically reachable from `main.ts`. This ADR covers the
runtime accessors.

## Inventory

The cycle column shows the import path from the provider to a reader.
Importing the provider directly from that reader would close the path into a
cycle. The paths come from the dependency-cruiser graph of `src` at the date
above. A dashed arrow (`⇢`) is a type-only edge and a wavy arrow (`⤳`) is a
dynamic `import()`. The table is a snapshot for planning the follow-ups and
will drift as they land; decisions 1–6 are the rules.

| Setter                             | Provider (calls the setter)                         | Readers                                                                             | Cycle the accessor breaks                                                                                                  | Fate                            |
| ---------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `provideCanvasClass`               | `LGraphCanvas`                                      | `LGraph`, `LGraphNode`, `LGraphGroup`, `SubgraphSlotBase`                           | `LGraphCanvas → LGraphNode`                                                                                                | Keep, barrel-registered         |
| `provideSubgraphGuard`             | `LGraph`                                            | `LGraphNode`, `selectionAdapter`                                                    | `LGraph → LGraphNode`                                                                                                      | Keep, barrel-registered         |
| `provideGraphNodeGuard`            | `LGraphNode`                                        | `collections`                                                                       | `LGraphNode → collections`                                                                                                 | Keep, barrel-registered         |
| `provideNodeInputSlotGuard`        | `NodeInputSlot`                                     | `NodeSlot`                                                                          | `NodeInputSlot → NodeSlot` (subclass imports its base)                                                                     | Keep, barrel-registered         |
| `provideSubgraphInputGuard`        | `SubgraphInputNode`                                 | `NodeInputSlot`, `SubgraphOutput`, `subgraphUtils` (re-export)                      | `SubgraphInputNode → SubgraphIONodeBase ⇢ EmptySubgraphOutput → SubgraphOutput`                                            | Delete after follow-up 5        |
| `provideSubgraphOutputGuard`       | `SubgraphOutputNode`                                | `NodeOutputSlot`, `SubgraphInput`, `subgraphUtils` (re-export)                      | `SubgraphOutputNode → SubgraphIONodeBase ⇢ EmptySubgraphInput → SubgraphInput`                                             | Delete after follow-up 5        |
| `provideChangeTracker`             | `changeTracker`                                     | `workflowStore`, `executionErrorStore`                                              | `changeTracker → workflowStore`                                                                                            | Keep, register in bootstrap     |
| `provideExtensionService`          | `extensionService`                                  | `queueStore`                                                                        | `extensionService → widgetStore → widgets → useComboWidget → assetsStore → queueStore`                                     | Keep, register a listener       |
| `provideLitegraphService`          | `litegraphService` (and its `__mocks__`)            | `promotionUtils`, `dynamicWidgets`, `dynamicGroupWidget`, `subgraphNavigationStore` | `litegraphService → promotionUtils`, `litegraphService → dynamicWidgets`                                                   | Keep, register in bootstrap     |
| `provideWorkflowService`           | `workflowService`                                   | `subgraphNavigationStore`                                                           | `workflowService → subgraphNavigationStore`                                                                                | Keep, register in bootstrap     |
| `providePromoteRecommendedWidgets` | `promotionUtils`                                    | `canvasStore`                                                                       | `promotionUtils → canvasStore`                                                                                             | Keep, register a listener       |
| `provideAuthStore`                 | `authStore`                                         | `useSessionCookie`, `useContinueWithSso`, `workspaceAuthStore`, `apiKeyAuthStore`   | `authStore → workspaceAuthStore`, `authStore → apiKeyAuthStore`                                                            | Keep, register in bootstrap     |
| `provideEnsureSessionCookie`       | `authStore` (thunk that imports `useSessionCookie`) | `workspaceAuthStore`, `teamWorkspaceStore`, `legacyWorkspaceTokenRail`              | `useSessionCookie → cloudWebSessionStore → workspaceAuthStore`                                                             | Keep, register in bootstrap     |
| `provideCurrentUser`               | `useCurrentUser` (and its `__mocks__`)              | `useSessionCookie`, `teamWorkspaceStore`                                            | `useCurrentUser → authStore → teamWorkspaceStore`                                                                          | Keep, register in bootstrap     |
| `provideTeamWorkspaceStore`        | `teamWorkspaceStore`                                | `workspaceAuthStore`                                                                | `teamWorkspaceStore → workspaceAuthStore`                                                                                  | Keep, register in bootstrap     |
| `provideUnifiedRemint`             | `workspaceAuthStore`                                | `remintRetry`                                                                       | `workspaceAuthStore → remintRetry`                                                                                         | Keep, register in bootstrap     |
| `provideBillingSdkStore`           | `billingSdkStore`                                   | `useBillingReadRail`                                                                | `billingSdkStore → useBillingReadRail`                                                                                     | Keep, register in bootstrap     |
| `provideWebSessionRequests`        | `cloudWebSessionStore`, while a web session runs    | `webSessionFetch` and its callers                                                   | `cloudWebSessionStore → webSessionFetch`                                                                                   | Keep as a scoped registration   |
| `provideCheckoutOperationReader`   | `useBillingContext`, per effect scope               | `billingRefresh`, `openHostedBillingTab`                                            | `useBillingContext → billingRefresh`                                                                                       | Keep as a scoped registration   |
| `provideBillingDialogs`            | `useBillingDialogs` (and its `__mocks__`)           | `useSubscriptionPaywall`, `useSubscriptionCheckout`                                 | `useBillingDialogs → useSubscriptionDialog ⤳ SubscriptionRequiredDialogContent → SubscribeButton → useSubscriptionPaywall` | Replace with `provide`/`inject` |
| `provideSubscriptionDialog`        | `useSubscriptionDialog` (and its `__mocks__`)       | `useSubscriptionPaywall`, `InviteMemberUpsellDialogContent`                         | `useSubscriptionDialog → useWorkspaceDialogs ⤳ InviteMemberUpsellDialogContent`                                            | Replace with `provide`/`inject` |

None of these cycles has been removed since its accessor was introduced, so
no accessor can be deleted yet.
`registerLiteGraphInstance`, `registerApp`, `registerExtensionDialogService` and
`setAssertReporter` follow the same pattern under other names. They are
outside this inventory but follow the same rules.

## Decision

1. **Litegraph accessors stay registered by their class modules.**
   Registration has to work for every consumer of the barrel, including
   extensions and tests that never run `main.ts`. The registration step is the
   barrel's static import of each class module, which ADR-TYPES-LITEGRAPH-0044
   already requires. `LiteGraph` keeps its identity: the barrel constructs the
   only instance, and `litegraphInstance` and `window.LiteGraph` refer to that
   same object.
2. **App-level accessors move their registration into bootstrap.** Today each
   provider module calls its setter at the top level. That makes registration
   a side effect of loading the module, which is the pattern FE-3560 removes.
   Bootstrap should make one explicit registration call before it mounts the
   app. Then a provider imported in isolation registers nothing, and the
   required order is visible in a single place. Tests do the same registration
   or use the existing `__mocks__`, which already register themselves.
3. **When a reader only notifies its provider, register a listener instead of
   a getter.** `queueStore` invokes an extension hook, and `canvasStore`
   forwards a canvas event. In both cases the provider should subscribe, as
   readers already do with `onBillingRefresh`. The lower module then keeps no
   reference to the higher module's API.
4. **The two dialog accessors become `provide`/`inject`.** Their readers are
   UI composables that run in component setup, and their providers are UI as
   well. The app root provides them; `App.vue` already registers the
   extension dialog service there. `useSubscriptionCheckout` reads its dialog inside
   an async action, so it must inject the dialog during setup and keep the
   result.
5. **Scoped registrations stay.** `provideWebSessionRequests` and
   `provideCheckoutOperationReader` register within a lifecycle and return a
   release function. They are explicit already, and an absent provider is a
   valid state that readers handle.
6. **Every remaining accessor reads through an asserting getter.** An
   accessor read before registration must fail with the name of its provider.
   This covers module-private bindings as well as exported ones.
   `remintRetry` keeps its `null` fallback, so a request without a registered
   remint still surfaces its original 401 in production; the read asserts
   first, so the missing registration is reported instead of silent.

## Alternatives and consequences

- **Replacing store accessors with the store itself.** Importing the store
  module is the cycle. Looking a store up by id through Pinia drops its type,
  and `inject` inside a setup store only works within an app context. So no
  accessor's fate is "replace with a store".
- **Dynamic `import()` in the reader.** Dependency-cruiser counts dynamic
  imports, so the cycle would remain. Both dialog cycles already pass through
  `import()` and still fail `deps:audit` without their accessors.
- **Merging each provider and reader into one module.** This would combine
  unrelated responsibilities only to satisfy the graph. ADR-TYPES-LITEGRAPH-0044
  rejected the same option for the litegraph classes.
- **Consequence of moving registration into bootstrap.** Registration becomes
  a list that bootstrap must keep complete. A missing entry fails at the first
  read, not at load. Decision 6 makes that failure name the provider. A
  reachability check (follow-up 6) catches the omission in CI.

## Follow-ups

1. Change the unassigned bindings, exported and module-private, and the
   optional `remintUnified` read to asserting getters (decision 6).
2. Add the bootstrap registration step and remove the top-level `provide*`
   calls from app-level providers (decision 2). This edits `main.ts`, so it
   waits for the concurrent bootstrap work there to land.
3. Turn `provideExtensionService` and `providePromoteRecommendedWidgets` into
   listeners that the provider registers (decision 3).
4. Move `useBillingDialogs` and `useSubscriptionDialog` to app-level
   `provide`/`inject` (decision 4).
5. Change the type-only imports of `EmptySubgraphInput` and
   `EmptySubgraphOutput` in `SubgraphIONodeBase` to the entity registry. The
   subgraph slot guards' providers then no longer reach their readers. Delete
   both setters and import the guards directly, after checking that the
   barrel's evaluation order still defines `SubgraphIONodeBase` before its
   subclasses.
6. Add a `deps:audit` check that fails when an exported `provide*` setter has
   no call site in a module statically reachable from `main.ts` through
   runtime imports. The call site is the provider module today and the
   bootstrap step after follow-up 2, so the check covers both. It catches a
   deleted or unreachable call site, not a call that never executes; decision
   6 covers that case at the first read.
