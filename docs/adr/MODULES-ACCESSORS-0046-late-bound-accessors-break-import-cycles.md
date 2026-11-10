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

The accessors are the `provide*` setters, plus `registerLiteGraphInstance`,
`registerApp`, `registerExtensionDialogService` and `setAssertReporter`, which
follow the same pattern under other names.
The inventory of accessors and the follow-up plan are tracked in
[Linear](https://linear.app/comfyorg/issue/FRONT-3789/adr-hygiene-sweep-and-adrcheck-extensions#comment-499d4637).

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
  read, not at load. Decision 6 makes that failure name the provider.
  `deps:audit` does not check for a missing registration.
