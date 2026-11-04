import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'

import en from '@/locales/en/main.json'
import { ioNode } from '@/renderer/extensions/superComfy/engine/engineFixtures'
import { textItem } from '@/renderer/extensions/superComfy/engine/items'
import { useSuperComfyGraphStore } from '@/renderer/extensions/superComfy/stores/superComfyGraphStore'

import TextItemList from './TextItemList.vue'

vi.mock(import('firebase/auth'))

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

function renderTextNode() {
  const store = useSuperComfyGraphStore()
  store.dispatch({ type: 'nodeAdded', node: ioNode('notes', 'text') })
  const Host = defineComponent(() => () => {
    const node = store.state.doc.nodes[0]
    return node.kind === 'io' ? h(TextItemList, { node }) : null
  })
  render(Host, { global: { plugins: [i18n] } })
  return store
}

describe('TextItemList', () => {
  it('types into each new item right after it is added', async () => {
    const store = renderTextNode()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Add text' }))
    await user.keyboard('a red fox')
    await user.click(screen.getByRole('button', { name: 'Add text' }))
    await user.keyboard('a blue whale')

    expect(store.state.doc.nodes[0]).toMatchObject({
      items: [textItem('a red fox'), textItem('a blue whale')]
    })
  })
})
