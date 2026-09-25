import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

/**
 * The empty workflow, in its own module so a Node-side caller can import it.
 * `defaultGraph.ts` re-exports this as `blankGraph` and reads
 * `import.meta.env` at module scope, which throws outside a Vite build — a
 * Playwright fixture importing it for the blank graph alone cannot.
 */
export const blankWorkflowGraph: ComfyWorkflowJSON = {
  last_node_id: 0,
  last_link_id: 0,
  nodes: [],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}
