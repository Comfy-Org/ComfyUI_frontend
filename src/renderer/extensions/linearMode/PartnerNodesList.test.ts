import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'

import { usePriceBadge } from '@/composables/node/usePriceBadge'
import { createTestRootGraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import PartnerNodesList from '@/renderer/extensions/linearMode/PartnerNodesList.vue'
import { app } from '@/scripts/app'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: { linearMode: { hasCreditCost: 'Has credit cost' } }
  }
})

function renderList(mobile = false) {
  const pinia = createTestingPinia({ stubActions: false })
  setActivePinia(pinia)

  return render(PartnerNodesList, {
    props: { mobile },
    global: { plugins: [pinia, i18n] }
  })
}

describe('PartnerNodesList', () => {
  it('renders badges for nodes in the root graph even when app.graph points at a subgraph', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const { getCreditsBadge } = usePriceBadge()
    const rootGraph = createTestRootGraph()
    const apiNode = new LGraphNode('Api Node')
    apiNode.badges = [getCreditsBadge('$0.05/Run')]
    rootGraph.add(apiNode)

    Reflect.set(app, 'rootGraphInternal', rootGraph)

    renderList()

    expect(screen.getByText('$0.05/Run')).toBeInTheDocument()
    expect(screen.getByText('Api Node')).toBeInTheDocument()
  })
})
