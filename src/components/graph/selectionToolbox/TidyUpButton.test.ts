import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import TidyUpButton from '@/components/graph/selectionToolbox/TidyUpButton.vue'
import { useSelectionToolboxLift } from '@/components/graph/selectionToolbox/useSelectionToolboxLift'
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
      render: () =>
        h(TooltipProvider, () =>
          h('div', { 'data-selection-toolbox': '' }, [
            h(TidyUpButton),
            h('button', 'Bypass')
          ])
        )
    }),
    { global: { plugins: [i18n], stubs: { SelectionGapHandles: true } } }
  )
}

const openBar = async () => {
  const user = userEvent.setup()
  setCanvasSelection([nodeWithId(1), nodeWithId(2)])
  await user.click(screen.getByRole('button', { name: 'Tidy up' }))
  await screen.findByRole('slider')
  return user
}

describe('TidyUpButton', () => {
  it.for<{
    change: string
    next: (selected: LGraphNode[]) => LGraphNode[]
    staysOpen: boolean
  }>([
    {
      change: 'other nodes',
      next: () => [nodeWithId(3), nodeWithId(4)],
      staysOpen: false
    },
    {
      change: 'other nodes with the same ids',
      next: () => [nodeWithId(1), nodeWithId(2)],
      staysOpen: false
    },
    {
      change: 'the same nodes in another order',
      next: ([first, second]) => [second, first],
      staysOpen: true
    }
  ])(
    'keeps the gap bar open: $staysOpen, when the selection changes to $change',
    async ({ next, staysOpen }) => {
      const user = userEvent.setup()
      const selected = [nodeWithId(1), nodeWithId(2)]
      setCanvasSelection(selected)
      const { unmount } = renderButton()

      await user.click(screen.getByRole('button', { name: 'Tidy up' }))
      expect(await screen.findByRole('slider')).toBeInTheDocument()

      setCanvasSelection(next(selected))
      await nextTick()

      await waitFor(() =>
        expect(screen.queryByRole('slider') !== null).toBe(staysOpen)
      )
      unmount()
    }
  )

  it('stays open and lifted for a press on another toolbox button', async () => {
    const { unmount } = renderButton()
    const { lift } = useSelectionToolboxLift()
    const user = await openBar()

    await user.click(screen.getByRole('button', { name: 'Bypass' }))
    await nextTick()

    expect(screen.getByRole('slider')).toBeInTheDocument()
    expect(lift.value).toBeGreaterThan(0)

    await user.click(document.body)
    await waitFor(() => expect(screen.queryByRole('slider')).toBeNull())
    expect(lift.value).toBe(0)
    unmount()
  })
})
