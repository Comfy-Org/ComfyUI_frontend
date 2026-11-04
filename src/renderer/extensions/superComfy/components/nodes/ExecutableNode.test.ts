import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { assert, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'

import en from '@/locales/en/main.json'
import type { AppNode } from '@/renderer/extensions/superComfy/engine/documentSchema'
import {
  appNode,
  port
} from '@/renderer/extensions/superComfy/engine/engineFixtures'
import { useSuperComfyGraphStore } from '@/renderer/extensions/superComfy/stores/superComfyGraphStore'

import ExecutableNode from './ExecutableNode.vue'

vi.mock(import('firebase/auth'))

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

function appWithTwoOutputs(): AppNode {
  const app = appNode('portrait')
  assert(app.contract, 'fixture app has a contract')
  return {
    ...app,
    contract: {
      ...app.contract,
      outputs: [
        { ...port('out:9', 'image', { label: 'Image' }), outputNodeId: '9' },
        { ...port('out:12', 'image', { label: 'Mask' }), outputNodeId: '12' }
      ]
    }
  }
}

function renderAppNode() {
  const store = useSuperComfyGraphStore()
  store.dispatch({ type: 'nodeAdded', node: appWithTwoOutputs() })
  const Host = defineComponent(() => () => {
    const node = store.state.doc.nodes[0]
    return node.kind === 'app'
      ? h(ExecutableNode, { node, selected: false })
      : null
  })
  render(Host, { global: { plugins: [i18n] } })
}

describe('ExecutableNode', () => {
  it('marks the output it shows as pressed and moves the mark when another is picked', async () => {
    renderAppNode()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Show Mask' }))

    expect(
      screen.getByRole('button', { name: 'Show Mask', pressed: true })
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Show Image', pressed: false })
    ).toBeTruthy()
  })
})
