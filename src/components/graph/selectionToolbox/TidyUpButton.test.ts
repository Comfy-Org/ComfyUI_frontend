import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'

import TidyUpButton from '@/components/graph/selectionToolbox/TidyUpButton.vue'
import TooltipProvider from '@/components/ui/tooltip/TooltipProvider.vue'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { toNodeId } from '@/types/nodeId'
import { setCanvasSelection } from '@/utils/__tests__/canvasSelectionTestUtils'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        tidyUp: 'Tidy up',
        tidyUpTooltip: 'Tidy up the selection',
        arrangeSpacing: 'Arrangement spacing'
      }
    }
  }
})

const nodeWithId = (id: number) => {
  const node = new LGraphNode(`Node ${id}`)
  node.id = toNodeId(id)
  return node
}

function renderButton() {
  return render(
    defineComponent({
      render: () => h(TooltipProvider, () => h(TidyUpButton))
    }),
    { global: { plugins: [i18n] } }
  )
}

describe('TidyUpButton', () => {
  it('closes the gap bar when the selection changes', async () => {
    const user = userEvent.setup()
    setCanvasSelection([nodeWithId(1), nodeWithId(2)])
    const { unmount } = renderButton()

    await user.click(screen.getByRole('button', { name: 'Tidy up' }))
    expect(await screen.findByRole('slider')).toBeInTheDocument()

    setCanvasSelection([nodeWithId(3), nodeWithId(4)])

    await waitFor(() => expect(screen.queryByRole('slider')).toBeNull())
    unmount()
  })
})
