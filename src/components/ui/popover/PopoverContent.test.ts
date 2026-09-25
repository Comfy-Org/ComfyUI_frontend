import { ZIndex } from '@primeuix/utils/zindex'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { PopoverRoot, PopoverTrigger } from 'reka-ui'
import { afterEach, describe, expect, it } from 'vitest'
import { ref } from 'vue'

import PopoverContent from './PopoverContent.vue'

const registered: HTMLElement[] = []

function registerDialog() {
  const element = document.createElement('div')
  ZIndex.set('modal', element, 1700)
  registered.push(element)
  return Number(element.style.zIndex)
}

afterEach(() => {
  let element = registered.pop()
  while (element) {
    ZIndex.clear(element)
    element = registered.pop()
  }
})

describe('PopoverContent', () => {
  it('re-evaluates the modal stack each time it opens', async () => {
    registerDialog()
    const open = ref(false)
    render({
      components: { PopoverContent, PopoverRoot, PopoverTrigger },
      setup: () => ({ open }),
      template: `
        <PopoverRoot v-model:open="open">
          <PopoverTrigger>Toggle</PopoverTrigger>
          <PopoverContent>Content</PopoverContent>
        </PopoverRoot>
      `
    })
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const trigger = screen.getByRole('button', { name: 'Toggle' })

    await user.tab()
    expect(trigger).toHaveFocus()
    open.value = true
    const firstContent = await screen.findByRole('dialog')
    const firstZIndex = Number(firstContent.style.zIndex)
    open.value = false
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    const laterDialogZIndex = registerDialog()
    open.value = true

    const reopenedContent = await screen.findByRole('dialog')
    expect(firstZIndex).toBeLessThan(laterDialogZIndex + 1)
    expect(Number(reopenedContent.style.zIndex)).toBe(laterDialogZIndex + 1)
  })
})
