import { LiteGraphGlobal } from './LiteGraphGlobal'

// To prevent circular dependency in litegraph/itself.ts -> litegraph.ts -> litegraph/itself.ts
// For all src/lib/litegraph/**/*.ts files, We should import litegraph instance from here
// And for imports outside from litegraph, We can import it directly from 'src/lib/litegraph/src/litegraph' for simplicity

export const LiteGraphInternal = new LiteGraphGlobal()
