import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

import NodeHelpContent from './NodeHelpContent.vue'

vi.mock('@/composables/useNodeHelpContent', () => ({
  useNodeHelpContent: () => ({
    renderedHelpHtml: ref(''),
    isLoading: ref(false),
    error: ref('not found')
  })
}))

const globalConfig = { mocks: { $t: (key: string) => key } }

function buildNodeDef(): ComfyNodeDefImpl {
  const nodeDef: ComfyNodeDefV1 = {
    name: 'SyncLipSyncNode',
    display_name: 'sync.so Lip Sync',
    category: 'partner/video/sync.so',
    python_module: 'comfy_api_nodes.nodes_sync_so',
    description: 'Re-sync mouth movement in a video.',
    input: {
      required: {
        video: ['VIDEO', {}],
        model: [
          'COMFY_DYNAMICCOMBO_V3',
          {
            options: [
              {
                key: 'sync-3',
                inputs: {
                  required: {
                    sync_mode: [
                      'COMBO',
                      { options: ['bounce', 'cut_off'], default: 'bounce' }
                    ]
                  },
                  optional: {}
                }
              }
            ]
          }
        ]
      },
      optional: {}
    },
    output: ['VIDEO'],
    output_is_list: [false],
    output_name: ['video'],
    output_node: false
  }

  return new ComfyNodeDefImpl(nodeDef)
}

describe('NodeHelpContent', () => {
  it('flattens dynamic combo inputs into the fallback inputs table', () => {
    render(NodeHelpContent, {
      global: globalConfig,
      props: { node: buildNodeDef() }
    })

    expect(screen.getByText('model')).toBeInTheDocument()
    expect(screen.getByText('sync_mode')).toBeInTheDocument()
  })
})
