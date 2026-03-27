import type { RoomDefinition } from '@/types'

const GH = 'https://github.com/Comfy-Org/ComfyUI_frontend/blob/main'

export const rooms: Record<string, RoomDefinition> = {
  entry: {
    id: 'entry',
    title: 'The Entry Point',
    layer: 'src/main.ts',
    discoveryDescription:
      `You stand at ${GH}/src/main.ts, the entry point of the ComfyUI frontend. ` +
      'The air hums with the bootstrapping of a Vue 3 application. Pinia stores ' +
      'initialize around you, the router unfurls paths into the distance, and ' +
      'i18n translations whisper in dozens of languages. ' +
      'Three corridors stretch ahead, each leading deeper into the architecture. ' +
      'Somewhere in this codebase, god objects lurk, mutations scatter in the shadows, ' +
      'and a grand migration awaits your decisions.',
    solutionDescription: '',
    prerequisites: [],
    artifacts: [],
    connections: [
      {
        targetRoomId: 'components',
        label: 'Enter the Component Gallery',
        hint: 'Presentation Layer'
      },
      {
        targetRoomId: 'stores',
        label: 'Descend into the Store Vaults',
        hint: 'State Management'
      },
      {
        targetRoomId: 'services',
        label: 'Follow the wires to Services',
        hint: 'Business Logic'
      }
    ]
  },

  components: {
    id: 'components',
    title: 'The Component Gallery',
    layer: 'Presentation',
    discoveryDescription:
      'Vast halls lined with Vue Single File Components. GraphView.vue dominates the center \u2014 ' +
      'the main canvas workspace where nodes are wired together. But a tangled knot blocks ' +
      'the corridor ahead: Subgraph extends LGraph, and LGraph creates Subgraph instances. ' +
      'The circular import forces order-dependent barrel exports and makes testing impossible ' +
      'in isolation.',
    solutionDescription:
      'The circular dependency dissolves when you realize a subgraph is just a node ' +
      'carrying a SubgraphStructure component. Composition replaces inheritance, and the ' +
      'flat World eliminates special cases entirely.',
    prerequisites: [],
    artifacts: [
      { name: 'GraphView.vue', type: 'Component', icon: 'graphview' }
    ],
    connections: [
      {
        targetRoomId: 'litegraph',
        label: 'Inspect the Canvas',
        hint: 'Litegraph Engine'
      },
      {
        targetRoomId: 'sidepanel',
        label: 'Enter the Command Forge',
        hint: 'Commands & Intent'
      },
      {
        targetRoomId: 'entry',
        label: 'Return to the Entry Point',
        hint: 'src/main.ts'
      }
    ],
    challengeId: 'circular-dependency'
  },

  stores: {
    id: 'stores',
    title: 'The Store Vaults',
    layer: 'State',
    discoveryDescription:
      'Sixty Pinia stores line the walls like vault doors, each guarding a domain of reactive state. ' +
      'Deep in the vaults, you find a fragile counter: graph._version++. It appears in 19 locations ' +
      'across 7 files \u2014 LGraph.ts, LGraphNode.ts, LGraphCanvas.ts, BaseWidget.ts, SubgraphInput.ts, ' +
      'SubgraphInputNode.ts, SubgraphOutput.ts. Change tracking depends on this scattered increment. ' +
      'One missed site means silent data loss.',
    solutionDescription:
      'Centralizing all 19 increment sites into a single graph.incrementVersion() method makes ' +
      'change tracking auditable. The VersionSystem gains a single hook point, and Phase 0a ' +
      'of the migration plan is complete.',
    prerequisites: [],
    artifacts: [
      {
        name: 'widgetValueStore.ts',
        type: 'Proto-ECS Store',
        icon: 'widgetvaluestore'
      },
      {
        name: 'layoutStore.ts',
        type: 'Proto-ECS Store',
        icon: 'layoutstore'
      }
    ],
    connections: [
      {
        targetRoomId: 'ecs',
        label: 'Examine the ECS Blueprints',
        hint: 'Entity-Component-System'
      },
      {
        targetRoomId: 'renderer',
        label: 'Visit the Renderer',
        hint: 'Canvas & Layout'
      },
      {
        targetRoomId: 'entry',
        label: 'Return to the Entry Point',
        hint: 'src/main.ts'
      }
    ],
    challengeId: 'scattered-mutations'
  },

  services: {
    id: 'services',
    title: 'The Service Corridors',
    layer: 'Services',
    discoveryDescription:
      'Clean corridors of orchestration logic. litegraphService.ts manages graph creation and ' +
      'serialization. extensionService.ts loads third-party extensions. But a fork in the corridor ' +
      'reveals the core tension: the legacy litegraph engine works \u2014 thousands of users depend on ' +
      'it daily \u2014 yet the architecture docs describe a better future with ECS, branded types, and ' +
      'a World registry. How do you get from here to there without breaking production?',
    solutionDescription:
      'A 5-phase incremental migration plan maps the path forward. Each phase is independently ' +
      'testable and shippable. Old and new coexist during transition. Production never breaks.',
    prerequisites: [],
    artifacts: [
      {
        name: 'litegraphService.ts',
        type: 'Service',
        icon: 'litegraphservice'
      },
      {
        name: 'Extension Migration Guide',
        type: 'Design Pattern',
        icon: 'extension-migration'
      }
    ],
    connections: [
      {
        targetRoomId: 'composables',
        label: 'Follow the Composables',
        hint: 'Reusable Logic Hooks'
      },
      {
        targetRoomId: 'entry',
        label: 'Return to the Entry Point',
        hint: 'src/main.ts'
      }
    ],
    challengeId: 'migration-question'
  },

  litegraph: {
    id: 'litegraph',
    title: 'The Litegraph Engine Room',
    layer: 'Graph Engine',
    discoveryDescription:
      "The beating heart of ComfyUI's visual programming. Massive class files loom: " +
      'LGraphCanvas.ts at ~9,100 lines handles all rendering and interaction, ' +
      'LGraphNode.ts at ~4,300 lines is the god-object node entity, and ' +
      'LGraph.ts at ~3,100 lines contains the graph itself. ' +
      'These god objects are the root of most architectural pain \u2014 circular dependencies, ' +
      'render-time side effects, and scattered mutation sites.',
    solutionDescription:
      'Incremental extraction peels responsibilities into focused modules one at a time. ' +
      'Position extraction lands first (already in LayoutStore), then connectivity. ' +
      'Each extraction is a small, testable PR. The god objects shrink steadily.',
    prerequisites: ['composition'],
    artifacts: [
      {
        name: 'LGraphCanvas.ts',
        type: 'God Object',
        icon: 'lgraphcanvas'
      },
      { name: 'LGraphNode.ts', type: 'God Object', icon: 'lgraphnode' }
    ],
    connections: [
      {
        targetRoomId: 'ecs',
        label: 'Examine the ECS Blueprints',
        hint: 'The planned future'
      },
      {
        targetRoomId: 'components',
        label: 'Return to Components',
        hint: 'Presentation Layer'
      },
      {
        targetRoomId: 'entry',
        label: 'Return to the Entry Point',
        hint: 'src/main.ts'
      }
    ],
    challengeId: 'god-object-dilemma'
  },

  ecs: {
    id: 'ecs',
    title: "The ECS Architect's Chamber",
    layer: 'ECS',
    discoveryDescription:
      'Blueprints cover every surface. The Entity-Component-System architecture is taking shape: ' +
      'six entity kinds \u2014 Node, Link, Widget, Slot, Reroute, Group \u2014 each identified by ' +
      'untyped IDs. NodeId is typed as number | string. Nothing prevents passing a LinkId where ' +
      'a NodeId is expected. Widgets are identified by name + parent node (fragile lookup). ' +
      'Slots are identified by array index (breaks when reordered). The six entity kinds all ' +
      'share the same untyped ID space.',
    solutionDescription:
      'Branded types with cast helpers bring compile-time safety at zero runtime cost. ' +
      'type NodeEntityId = number & { __brand: "NodeEntityId" }. Cast helpers at system ' +
      'boundaries keep ergonomics clean. Phase 1a is complete.',
    prerequisites: ['centralized-mutations'],
    artifacts: [
      {
        name: 'World Registry',
        type: 'ECS Core',
        icon: 'world-registry'
      },
      {
        name: 'Branded Entity IDs',
        type: 'Type Safety',
        icon: 'branded-ids'
      }
    ],
    connections: [
      {
        targetRoomId: 'subgraph',
        label: 'Descend into the Subgraph Depths',
        hint: 'Boundaries & Promotion'
      },
      {
        targetRoomId: 'renderer',
        label: 'Visit the Renderer',
        hint: 'Canvas & Layout'
      },
      {
        targetRoomId: 'entry',
        label: 'Return to the Entry Point',
        hint: 'src/main.ts'
      }
    ],
    challengeId: 'id-crossroads'
  },

  sidepanel: {
    id: 'sidepanel',
    title: 'The Command Forge',
    layer: 'Commands & Intent',
    discoveryDescription:
      'You enter a forge where raw user intent is shaped into structured commands. ' +
      "A heated debate blocks the forge entrance. One faction argues the World's imperative " +
      'API (world.setComponent()) conflicts with the command pattern requirement from ADR 0003. ' +
      'Another faction says commands and the World serve different layers. ' +
      'How should external callers mutate the World?',
    solutionDescription:
      'Commands are serializable intent. Systems are command handlers. The World is the store \u2014 ' +
      "its imperative API is internal, just like Redux's state mutations inside reducers. " +
      'ADR 0003 and ADR 0008 are complementary layers.',
    prerequisites: ['branded-types'],
    artifacts: [
      {
        name: 'CommandExecutor',
        type: 'ECS Core',
        icon: 'command-executor'
      },
      {
        name: 'Command Interface',
        type: 'Design Pattern',
        icon: 'command-interface'
      }
    ],
    connections: [
      {
        targetRoomId: 'components',
        label: 'Return to the Component Gallery',
        hint: 'Presentation Layer'
      },
      {
        targetRoomId: 'stores',
        label: 'Descend into the Store Vaults',
        hint: 'State Management'
      },
      {
        targetRoomId: 'entry',
        label: 'Return to the Entry Point',
        hint: 'src/main.ts'
      }
    ],
    challengeId: 'mutation-gateway'
  },

  subgraph: {
    id: 'subgraph',
    title: 'The Subgraph Depths',
    layer: 'Graph Boundaries',
    discoveryDescription:
      'You descend into nested chambers, each a perfect replica of the one above \u2014 graphs ' +
      'within graphs within graphs. The current code tells a painful story: Subgraph extends LGraph, ' +
      'virtual nodes with magic IDs (SUBGRAPH_INPUT_ID = -10, SUBGRAPH_OUTPUT_ID = -20), and three ' +
      'layers of indirection at every boundary crossing. Widget promotion requires PromotionStore, ' +
      'PromotedWidgetViewManager, and PromotedWidgetView \u2014 a parallel state system duplicating ' +
      'what the type-to-widget mapping already handles.',
    solutionDescription:
      "Under graph unification, promotion becomes an operation on the subgraph's function signature. " +
      'Promote a widget by adding an interface input. The type-to-widget mapping creates the widget ' +
      'automatically. PromotionStore, ViewManager, and PromotedWidgetView are eliminated entirely.',
    prerequisites: ['branded-types', 'composition'],
    artifacts: [
      {
        name: 'SubgraphStructure',
        type: 'ECS Component',
        icon: 'subgraph-structure'
      },
      {
        name: 'Typed Interface Contracts',
        type: 'Design Pattern',
        icon: 'typed-contracts'
      }
    ],
    connections: [
      {
        targetRoomId: 'ecs',
        label: 'Return to the ECS Chamber',
        hint: 'Entity-Component-System'
      },
      {
        targetRoomId: 'litegraph',
        label: 'Visit the Litegraph Engine Room',
        hint: 'Graph Engine'
      },
      {
        targetRoomId: 'entry',
        label: 'Return to the Entry Point',
        hint: 'src/main.ts'
      }
    ],
    challengeId: 'widget-promotion'
  },

  renderer: {
    id: 'renderer',
    title: 'The Renderer Overlook',
    layer: 'Renderer',
    discoveryDescription:
      'From here you can see the entire canvas rendering pipeline. But alarms sound: ' +
      'drawNode() calls _setConcreteSlots() and arrange() during the render pass. ' +
      'The render phase mutates state, making draw order affect layout. ' +
      "Node A's position depends on whether Node B was drawn first. " +
      'This is a critical pipeline flaw.',
    solutionDescription:
      'Separating update and render phases fixes the pipeline: Input \u2192 Update (layout, connectivity) ' +
      '\u2192 Render (read-only). Draw order no longer matters. The ECS system pipeline enforces ' +
      'this separation structurally.',
    prerequisites: ['responsibility-extraction'],
    artifacts: [
      {
        name: 'QuadTree Spatial Index',
        type: 'Data Structure',
        icon: 'quadtree'
      },
      {
        name: 'Y.js CRDT Layout',
        type: 'Collaboration',
        icon: 'yjs-crdt'
      }
    ],
    connections: [
      {
        targetRoomId: 'ecs',
        label: 'Examine the ECS Blueprints',
        hint: 'Entity-Component-System'
      },
      {
        targetRoomId: 'entry',
        label: 'Return to the Entry Point',
        hint: 'src/main.ts'
      }
    ],
    challengeId: 'render-time-mutation'
  },

  composables: {
    id: 'composables',
    title: 'The Composables Workshop',
    layer: 'Composables',
    discoveryDescription:
      'Hooks hang from the walls, each a reusable piece of Vue composition logic. ' +
      'useCoreCommands.ts is the largest at 42KB \u2014 an orchestrator binding keyboard ' +
      'shortcuts to application commands. A request arrives: multiple users want to edit ' +
      'the same workflow simultaneously. The layoutStore already extracts position data ' +
      'from litegraph entities. But how do you synchronize positions across users without conflicts?',
    solutionDescription:
      'Y.js CRDTs back the layout store. Concurrent edits merge automatically without coordination. ' +
      'ADR 0003 is realized. The collaboration future is here.',
    prerequisites: ['incremental-migration'],
    artifacts: [
      {
        name: 'useCoreCommands.ts',
        type: 'Composable',
        icon: 'usecorecommands'
      }
    ],
    connections: [
      {
        targetRoomId: 'stores',
        label: 'Descend into the Store Vaults',
        hint: 'State Management'
      },
      {
        targetRoomId: 'entry',
        label: 'Return to the Entry Point',
        hint: 'src/main.ts'
      }
    ],
    challengeId: 'collaboration-protocol'
  }
}
