import type { ChallengeDefinition } from '@/types'

const GH = 'https://github.com/Comfy-Org/ComfyUI_frontend/blob/main'

export const challenges: Record<string, ChallengeDefinition> = {
  'circular-dependency': {
    id: 'circular-dependency',
    roomId: 'components',
    title: 'The Circular Dependency',
    tier: 1,
    description:
      'A tangled knot blocks the corridor ahead. Subgraph extends LGraph, ' +
      'but LGraph creates and manages Subgraph instances. The circular import ' +
      'forces order-dependent barrel exports and makes testing impossible in isolation. ' +
      'How do you untangle it?',
    recommended: 'A',
    docLink: {
      label: 'Entity Problems: Circular Dependencies',
      url: `${GH}/docs/architecture/entity-problems.md`
    },
    choices: [
      {
        key: 'A',
        label: 'Composition over inheritance',
        hint: 'A subgraph IS a graph \u2014 just a node with a SubgraphStructure component. ECS eliminates class inheritance entirely.',
        icon: 'components-a',
        rating: 'good',
        feedback:
          'The circular dependency dissolves. Under graph unification, a subgraph is just a node carrying a SubgraphStructure component in a flat World. No inheritance, no special cases.',
        tagsGranted: ['composition'],
        insightReward: 1
      },
      {
        key: 'B',
        label: 'Barrel file reordering',
        hint: 'Rearrange exports so the cycle resolves at module load time.',
        icon: 'components-b',
        rating: 'bad',
        feedback:
          'The imports stop crashing... for now. But the underlying coupling remains, and any new file touching both classes risks reviving the cycle.',
        tagsGranted: [],
        insightReward: 0
      },
      {
        key: 'C',
        label: 'Factory injection',
        hint: 'Pass a graph factory function to break the static import cycle.',
        icon: 'components-c',
        rating: 'ok',
        feedback:
          "The factory breaks the import cycle cleanly. It's a pragmatic fix, though the classes remain tightly coupled at runtime.",
        tagsGranted: [],
        insightReward: 0
      }
    ]
  },

  'scattered-mutations': {
    id: 'scattered-mutations',
    roomId: 'stores',
    title: 'The Scattered Mutations',
    tier: 1,
    description:
      'Deep in the vaults, you find a fragile counter: graph._version++. ' +
      'It appears in 19 locations across 7 files \u2014 LGraph.ts (5 sites), ' +
      'LGraphNode.ts (8 sites), LGraphCanvas.ts (2 sites), BaseWidget.ts, SubgraphInput.ts, ' +
      'SubgraphInputNode.ts, SubgraphOutput.ts. ' +
      'Change tracking depends on this scattered increment. One missed site means silent data loss.',
    recommended: 'A',
    docLink: {
      label: 'Migration Plan: Phase 0a',
      url: `${GH}/docs/architecture/ecs-migration-plan.md`
    },
    choices: [
      {
        key: 'A',
        label: 'Centralize into graph.incrementVersion()',
        hint: 'Route all 19 sites through a single method. Phase 0a of the migration plan.',
        icon: 'stores-a',
        rating: 'good',
        feedback:
          'All 19 scattered increments now flow through one method. Change tracking becomes auditable, and the VersionSystem has a single hook point.',
        tagsGranted: ['centralized-mutations'],
        insightReward: 1
      },
      {
        key: 'B',
        label: 'Add a JavaScript Proxy',
        hint: 'Intercept all writes to _version automatically.',
        icon: 'stores-b',
        rating: 'ok',
        feedback:
          'The Proxy catches mutations, but adds runtime overhead and makes debugging opaque. The scattered sites remain in the code.',
        tagsGranted: [],
        insightReward: 0
      },
      {
        key: 'C',
        label: 'Leave it as-is',
        hint: "It works. Don't touch it.",
        icon: 'stores-c',
        rating: 'bad',
        feedback:
          'The team breathes a sigh of relief... until the next silent data loss bug from a missed increment site.',
        tagsGranted: [],
        insightReward: 0
      }
    ]
  },

  'migration-question': {
    id: 'migration-question',
    roomId: 'services',
    title: 'The Migration Question',
    tier: 1,
    description:
      'A fork in the corridor. The legacy litegraph engine works \u2014 thousands of users ' +
      'depend on it daily. But the architecture docs describe a better future: ECS with ' +
      'branded types, pure systems, and a World registry. ' +
      'How do you get from here to there without breaking production?',
    recommended: 'A',
    docLink: {
      label: 'ECS Migration Plan',
      url: `${GH}/docs/architecture/ecs-migration-plan.md`
    },
    choices: [
      {
        key: 'A',
        label: '5-phase incremental plan',
        hint: 'Foundation \u2192 Types \u2192 Bridge \u2192 Systems \u2192 Legacy Removal. Each phase is independently shippable.',
        icon: 'services-a',
        rating: 'good',
        feedback:
          'The team maps out five phases, each independently testable and shippable. Old and new coexist during transition. Production never breaks.',
        tagsGranted: ['incremental-migration'],
        insightReward: 1
      },
      {
        key: 'B',
        label: 'Big bang rewrite',
        hint: 'Freeze features, rewrite everything in parallel, swap when ready.',
        icon: 'services-b',
        rating: 'bad',
        feedback:
          'Feature freeze begins. Weeks pass. The rewrite grows scope. Morale plummets. The old codebase drifts further from the new one.',
        tagsGranted: [],
        insightReward: 0
      },
      {
        key: 'C',
        label: 'Strangler fig pattern',
        hint: 'Build new ECS beside old code, migrate consumers one by one.',
        icon: 'services-c',
        rating: 'ok',
        feedback:
          'A solid pattern. The new system grows organically around the old, though without a phased plan the migration lacks clear milestones.',
        tagsGranted: [],
        insightReward: 0
      }
    ]
  },

  'god-object-dilemma': {
    id: 'god-object-dilemma',
    roomId: 'litegraph',
    title: 'The God Object Dilemma',
    tier: 2,
    description:
      'LGraphCanvas looms before you: ~9,100 lines of rendering, ' +
      'input handling, selection, context menus, undo/redo, and more. LGraphNode ' +
      'adds ~4,300 lines with ~539 method/property definitions mixing rendering, ' +
      'serialization, connectivity, execution, layout, and state management. ' +
      "These god objects are the root of most architectural pain. What's your approach?",
    recommended: 'B',
    docLink: {
      label: 'Entity Problems: God Objects',
      url: `${GH}/docs/architecture/entity-problems.md`
    },
    choices: [
      {
        key: 'A',
        label: 'Rewrite from scratch',
        hint: 'Tear it all down and rebuild with clean architecture from day one.',
        icon: 'litegraph-a',
        rating: 'bad',
        feedback:
          'The rewrite begins heroically... and stalls at month three. The team burns out reimplementing edge cases the god objects handled implicitly.',
        tagsGranted: [],
        insightReward: 0
      },
      {
        key: 'B',
        label: 'Extract incrementally',
        hint: 'Peel responsibilities into focused modules one at a time. Position first, then connectivity, then rendering.',
        icon: 'litegraph-b',
        rating: 'good',
        feedback:
          "Position extraction lands first (it's already in LayoutStore). Then connectivity. Each extraction is a small, testable PR. The god objects shrink steadily.",
        tagsGranted: ['responsibility-extraction'],
        insightReward: 1
      },
      {
        key: 'C',
        label: 'Add a facade layer',
        hint: 'Wrap the god objects with a clean API without changing internals.',
        icon: 'litegraph-c',
        rating: 'ok',
        feedback:
          'The facade provides a nicer API, but the complexity still lives behind it. New features still require diving into the god objects.',
        tagsGranted: [],
        insightReward: 0
      }
    ]
  },

  'id-crossroads': {
    id: 'id-crossroads',
    roomId: 'ecs',
    title: 'The ID Crossroads',
    tier: 2,
    description:
      'The blueprints show a problem: NodeId is typed as number | string. ' +
      'Nothing prevents passing a LinkId where a NodeId is expected. ' +
      'Widgets are identified by name + parent node (fragile lookup). ' +
      'Slots are identified by array index (breaks when reordered). ' +
      'The six entity kinds \u2014 Node, Link, Widget, Slot, Reroute, Group \u2014 all ' +
      'share the same untyped ID space. How do you bring type safety to this ID chaos?',
    recommended: 'A',
    docLink: {
      label: 'ECS Target Architecture: Entity IDs',
      url: `${GH}/docs/architecture/ecs-target-architecture.md`
    },
    choices: [
      {
        key: 'A',
        label: 'Branded types with cast helpers',
        hint: "type NodeEntityId = number & { __brand: 'NodeEntityId' } \u2014 compile-time safety, zero runtime cost.",
        icon: 'ecs-a',
        rating: 'good',
        feedback:
          'The compiler now catches cross-kind ID bugs. Cast helpers at system boundaries (asNodeEntityId()) keep the ergonomics clean. Phase 1a complete.',
        tagsGranted: ['branded-types'],
        insightReward: 1
      },
      {
        key: 'B',
        label: 'String prefixes at runtime',
        hint: '"node:42", "link:7" \u2014 parse and validate at every usage site.',
        icon: 'ecs-b',
        rating: 'ok',
        feedback:
          'Runtime checks catch some bugs, but parsing overhead spreads everywhere. And someone will forget the prefix check in a hot path.',
        tagsGranted: [],
        insightReward: 0
      },
      {
        key: 'C',
        label: 'Keep plain numbers',
        hint: 'Just be careful. Document which IDs are which.',
        icon: 'ecs-c',
        rating: 'bad',
        feedback:
          'The next developer passes a LinkId to a node lookup. The silent failure takes two days to debug in production.',
        tagsGranted: [],
        insightReward: 0
      }
    ]
  },

  'widget-promotion': {
    id: 'widget-promotion',
    roomId: 'subgraph',
    title: 'The Widget Promotion Decision',
    tier: 2,
    description:
      'A user right-clicks a widget inside a subgraph and selects "Promote to parent." ' +
      'Today this requires three layers: PromotionStore, PromotedWidgetViewManager, ' +
      'and PromotedWidgetView \u2014 a parallel state system that duplicates what ' +
      'the type-to-widget mapping already does for normal inputs. ' +
      'Two candidates for the ECS future. The team must decide before Phase 3 solidifies.',
    recommended: 'A',
    docLink: {
      label: 'Subgraph Boundaries: Widget Promotion',
      url: `${GH}/docs/architecture/subgraph-boundaries-and-promotion.md`
    },
    choices: [
      {
        key: 'A',
        label: 'Connections-only: promotion = adding a typed input',
        hint: 'Promote a widget by adding an interface input. The type\u2192widget mapping creates the widget automatically. No new concepts.',
        icon: 'subgraph-a',
        rating: 'good',
        feedback:
          'PromotionStore, ViewManager, and PromotedWidgetView are eliminated entirely. Promotion becomes an operation on the subgraph\u2019s function signature. The existing slot, link, and widget infrastructure handles everything.',
        tagsGranted: ['typed-contracts'],
        insightReward: 1
      },
      {
        key: 'B',
        label: 'Simplified component promotion',
        hint: 'A WidgetPromotion component on widget entities. Removes ViewManager but preserves promotion as a distinct concept.',
        icon: 'subgraph-b',
        rating: 'ok',
        feedback:
          'The ViewManager and proxy reconciliation are gone, but promotion remains a separate concept from connection. Shared subgraph instances face an open question: which source widget is authoritative?',
        tagsGranted: [],
        insightReward: 0
      },
      {
        key: 'C',
        label: 'Keep the current three-layer system',
        hint: 'PromotionStore + ViewManager + PromotedWidgetView. It works today.',
        icon: 'subgraph-c',
        rating: 'bad',
        feedback:
          'The parallel state system persists. Every promoted widget is a shadow copy reconciled by a virtual DOM-like diffing layer. The ECS migration must work around it indefinitely.',
        tagsGranted: [],
        insightReward: 0
      }
    ]
  },

  'render-time-mutation': {
    id: 'render-time-mutation',
    roomId: 'renderer',
    title: 'The Render-Time Mutation',
    tier: 2,
    description:
      'Alarms sound. The render pipeline has a critical flaw: drawNode() calls ' +
      '_setConcreteSlots() and arrange() during the render pass. ' +
      'The render phase mutates state, making draw order affect layout. ' +
      "Node A's position depends on whether Node B was drawn first. " +
      'How do you fix the pipeline?',
    recommended: 'A',
    docLink: {
      label: 'Entity Problems: Render-Time Mutations',
      url: `${GH}/docs/architecture/entity-problems.md`
    },
    choices: [
      {
        key: 'A',
        label: 'Separate update and render phases',
        hint: 'Compute all layout in an update pass, then render as a pure read-only pass. Matches the ECS system pipeline.',
        icon: 'renderer-a',
        rating: 'good',
        feedback:
          'The pipeline becomes: Input \u2192 Update (layout, connectivity) \u2192 Render (read-only). Draw order no longer matters. Bugs vanish.',
        tagsGranted: ['phase-separation'],
        insightReward: 1
      },
      {
        key: 'B',
        label: 'Dirty flags and deferred render',
        hint: 'Mark mutated nodes dirty, skip them, re-render next frame.',
        icon: 'renderer-b',
        rating: 'ok',
        feedback:
          "Dirty flags reduce the worst symptoms, but the render pass still has permission to mutate. It's a band-aid on an architectural wound.",
        tagsGranted: [],
        insightReward: 0
      }
    ]
  },

  'collaboration-protocol': {
    id: 'collaboration-protocol',
    roomId: 'composables',
    title: 'The Collaboration Protocol',
    tier: 3,
    description:
      'A request arrives: multiple users want to edit the same workflow simultaneously. ' +
      'The layoutStore already extracts position data from litegraph entities. ' +
      'But how do you synchronize positions across users without conflicts?',
    recommended: 'A',
    docLink: {
      label: 'Proto-ECS Stores: LayoutStore',
      url: `${GH}/docs/architecture/proto-ecs-stores.md`
    },
    choices: [
      {
        key: 'A',
        label: 'Y.js CRDTs',
        hint: 'Conflict-free replicated data types. Merge without coordination. Already proven at scale.',
        icon: 'composables-a',
        rating: 'good',
        feedback:
          'Y.js CRDT maps back the layout store. Concurrent edits merge automatically. ADR 0003 is realized. The collaboration future is here.',
        tagsGranted: ['crdt-sync'],
        insightReward: 1
      },
      {
        key: 'B',
        label: 'Polling-based sync',
        hint: 'Fetch full state every few seconds, merge manually, hope for the best.',
        icon: 'composables-b',
        rating: 'bad',
        feedback:
          'Polling creates a flickering, laggy experience. Two users move the same node and one edit is silently lost. Support tickets pile up.',
        tagsGranted: [],
        insightReward: 0
      },
      {
        key: 'C',
        label: 'Skip collaboration for now',
        hint: 'Single-user editing only. Focus on other priorities.',
        icon: 'composables-c',
        rating: 'ok',
        feedback:
          'A pragmatic choice. The team focuses elsewhere. But the cloud product team is not happy about the delay.',
        tagsGranted: [],
        insightReward: 0
      }
    ]
  },

  'mutation-gateway': {
    id: 'mutation-gateway',
    roomId: 'sidepanel',
    title: 'The Mutation Gateway',
    tier: 3,
    description:
      "A heated debate blocks the forge entrance. One faction argues the World's imperative " +
      'API (world.setComponent()) conflicts with the command pattern requirement ' +
      'from ADR 0003. Another faction says commands and the World serve different layers. ' +
      'How should external callers mutate the World?',
    recommended: 'A',
    docLink: {
      label: 'World API and Command Layer',
      url: `${GH}/docs/architecture/ecs-world-command-api.md`
    },
    choices: [
      {
        key: 'A',
        label: 'Commands as intent; systems as handlers; World as store',
        hint: 'Caller \u2192 Command \u2192 System \u2192 World \u2192 Y.js. Commands are serializable. The World\u2019s imperative API is internal, called only by systems inside transactions.',
        icon: 'sidepanel-a',
        rating: 'good',
        feedback:
          'The layering clicks. Commands are serializable intent. Systems are command handlers. The World is the store \u2014 its imperative API is internal, just like Redux\u2019s state mutations inside reducers. ADR 0003 and ADR 0008 are complementary layers.',
        tagsGranted: ['command-layer'],
        insightReward: 1
      },
      {
        key: 'B',
        label: 'Make World.setComponent() itself serializable',
        hint: 'Log every World mutation as a serializable operation. The World IS the command system.',
        icon: 'sidepanel-b',
        rating: 'ok',
        feedback:
          'This conflates the store with the command layer. Every internal implementation detail becomes part of the public API. Batch operations like Paste become dozens of logged mutations instead of one intent.',
        tagsGranted: [],
        insightReward: 0
      },
      {
        key: 'C',
        label: 'Skip commands \u2014 let callers mutate directly',
        hint: 'External code calls world.setComponent() directly. Simpler. No ceremony.',
        icon: 'sidepanel-c',
        rating: 'bad',
        feedback:
          'Without a command layer, there is no undo/redo log, no replay, no CRDT sync, and no way to audit what changed. Every caller becomes responsible for transaction management.',
        tagsGranted: [],
        insightReward: 0
      }
    ]
  }
}
