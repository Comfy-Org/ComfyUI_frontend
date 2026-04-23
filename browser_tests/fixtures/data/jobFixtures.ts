import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

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
