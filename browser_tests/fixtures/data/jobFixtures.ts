import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

/**
 * Minimal, schema-valid `ComfyWorkflowJSON` suitable for embedding in a
 * `JobDetail` fixture. Use when tests only need to assert "a workflow
 * was loaded" without caring about its contents.
 */
export const MINIMAL_WORKFLOW = {
  last_node_id: 0,
  last_link_id: 0,
  nodes: [],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
} satisfies ComfyWorkflowJSON
