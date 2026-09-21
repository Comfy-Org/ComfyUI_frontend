import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

const DEFINITION_ID = '4d3f5a6e-0b1c-4d2e-9f80-1a2b3c4d5e6f'

/**
 * A blueprint as `useSubgraphStore().getBlueprint()` hands it to
 * `addNodeOnGraph`: one host node typed by a fresh definition wrapping a
 * CLIPTextEncode. `promoteText` exposes the interior text widget on the host.
 */
export function agentHumanAddBlueprint(
  promoteText: boolean
): ComfyWorkflowJSON {
  return {
    last_node_id: 2,
    last_link_id: 0,
    nodes: [
      {
        id: 2,
        type: DEFINITION_ID,
        title: 'prompt blueprint',
        pos: [0, 0],
        size: [300, 120],
        flags: {},
        order: 0,
        mode: 0,
        inputs: [],
        outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: null }],
        properties: { proxyWidgets: promoteText ? [['1', 'text']] : [] },
        widgets_values: promoteText ? ['a pasted prompt'] : []
      }
    ],
    links: [],
    groups: [],
    config: {},
    extra: {},
    version: 0.4,
    definitions: {
      subgraphs: [
        {
          id: DEFINITION_ID,
          version: 1,
          revision: 0,
          state: {
            lastGroupId: 0,
            lastNodeId: 1,
            lastLinkId: 1,
            lastRerouteId: 0
          },
          config: {},
          name: 'prompt blueprint',
          inputNode: { id: -10, bounding: [0, 0, 120, 60] },
          outputNode: { id: -20, bounding: [700, 0, 120, 60] },
          inputs: [],
          outputs: [
            {
              id: '9c8b7a6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
              name: 'CONDITIONING',
              type: 'CONDITIONING',
              linkIds: [1],
              pos: [724, 24]
            }
          ],
          widgets: [],
          nodes: [
            {
              id: 1,
              type: 'CLIPTextEncode',
              pos: [200, 0],
              size: [400, 200],
              flags: {},
              order: 0,
              mode: 0,
              inputs: [
                { name: 'clip', type: 'CLIP', link: null },
                {
                  name: 'text',
                  type: 'STRING',
                  widget: { name: 'text' },
                  link: null
                }
              ],
              outputs: [
                { name: 'CONDITIONING', type: 'CONDITIONING', links: [1] }
              ],
              properties: {},
              widgets_values: ['a pasted prompt']
            }
          ],
          groups: [],
          links: [
            {
              id: 1,
              origin_id: 1,
              origin_slot: 0,
              target_id: -20,
              target_slot: 0,
              type: 'CONDITIONING'
            }
          ],
          extra: {}
        }
      ]
    }
  }
}
