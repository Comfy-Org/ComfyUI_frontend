import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

import NodePreviewCard from './NodePreviewCard.vue'

vi.mock(
  '@/renderer/extensions/vueNodes/components/LGraphNodePreview.vue',
  () => ({
    default: { template: '<div data-testid="node-preview" />' }
  })
)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      nodeHelpPage: {
        inputs: 'Inputs',
        outputs: 'Outputs'
      }
    }
  }
})

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

function renderComponent(nodeDef: ComfyNodeDefImpl = buildNodeDef()) {
  return render(NodePreviewCard, {
    global: {
      plugins: [i18n]
    },
    props: {
      nodeDef
    }
  })
}

describe('NodePreviewCard', () => {
  it('flattens dynamic combo inputs into the inputs list', () => {
    renderComponent()

    expect(screen.getByText('model')).toBeInTheDocument()
    expect(screen.getByText('sync_mode')).toBeInTheDocument()
  })

  it('renders no inputs section when the node has no inputs', () => {
    const nodeDefImpl = new ComfyNodeDefImpl({
      name: 'NoInputsNode',
      display_name: 'No Inputs Node',
      category: 'Test',
      python_module: 'test_module',
      description: '',
      input: { required: {}, optional: {} },
      output: [],
      output_is_list: [],
      output_name: [],
      output_node: false
    })

    renderComponent(nodeDefImpl)

    expect(screen.queryByText('Inputs')).not.toBeInTheDocument()
  })
})
