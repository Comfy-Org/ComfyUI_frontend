import type { ExportedSubgraph } from '@/lib/litegraph/src/types/serialisation'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

const DEFINITION_ID = '4d3f5a6e-0b1c-4d2e-9f80-1a2b3c4d5e6f'

export interface NestedSubgraphDefinitions {
  definitions: { subgraphs: ExportedSubgraph[] }
}

/** Outer definition of the nested blueprint, and the inner one it wraps. */
export const NESTED_OUTER_ID = '7f1e2d3c-4b5a-4968-8778-6a5b4c3d2e1f'
export const NESTED_INNER_ID = '2a3b4c5d-6e7f-4081-9293-a4b5c6d7e8f9'

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

/**
 * The definitions envelope consumed by `pushNestedDefinition`: an outer
 * definition whose own interior node is typed by an inner definition, carried
 * in the outer's `definitions.subgraphs`.
 *
 * This is the shape the follower's document reader drops wholesale when it
 * cannot read a nested `definitions` map - `isSafeDefinition` rejects an
 * id-keyed object where `subgraphs` must be an array, `readDefinition` answers
 * null, and the root node then has no registered type to instantiate, so the
 * canvas degrades it to an error placeholder instead of a subgraph.
 * Regression cover for
 * https://github.com/Comfy-Org/ComfyUI_frontend/pull/18148.
 */
export function agentNestedSubgraphDefinitions(): NestedSubgraphDefinitions {
  return {
    definitions: {
      subgraphs: [
        {
          id: NESTED_OUTER_ID,
          version: 1,
          revision: 0,
          state: {
            lastGroupId: 0,
            lastNodeId: 1,
            lastLinkId: 1,
            lastRerouteId: 0
          },
          config: {},
          name: 'nested blueprint',
          inputNode: { id: -10, bounding: [0, 0, 120, 60] },
          outputNode: { id: -20, bounding: [700, 0, 120, 60] },
          inputs: [],
          outputs: [
            {
              id: 'b1c2d3e4-f5a6-4708-9819-2a3b4c5d6e7f',
              name: 'CONDITIONING',
              type: 'CONDITIONING',
              linkIds: [1],
              pos: [724, 24]
            }
          ],
          widgets: [],
          // The outer's only interior node is an instance of the inner
          // definition, so the inner must be registered for the outer to
          // configure at all.
          nodes: [
            {
              id: 1,
              type: NESTED_INNER_ID,
              title: 'inner prompt',
              pos: [200, 0],
              size: [300, 120],
              flags: {},
              order: 0,
              mode: 0,
              inputs: [],
              outputs: [
                { name: 'CONDITIONING', type: 'CONDITIONING', links: [1] }
              ],
              properties: { proxyWidgets: [] },
              widgets_values: []
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
          extra: {},
          definitions: {
            subgraphs: [
              {
                id: NESTED_INNER_ID,
                version: 1,
                revision: 0,
                state: {
                  lastGroupId: 0,
                  lastNodeId: 1,
                  lastLinkId: 1,
                  lastRerouteId: 0
                },
                config: {},
                name: 'inner prompt',
                inputNode: { id: -10, bounding: [0, 0, 120, 60] },
                outputNode: { id: -20, bounding: [700, 0, 120, 60] },
                inputs: [],
                outputs: [
                  {
                    id: 'c3d4e5f6-a7b8-4910-8a1b-2c3d4e5f6a7b',
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
                    widgets_values: ['a nested pasted prompt']
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
      ]
    }
  }
}
