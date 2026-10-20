import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import type { StyleValue } from 'vue'
import { nextTick, ref } from 'vue'

import Select from './Select.vue'
import SelectContent from './SelectContent.vue'
import SelectItem from './SelectItem.vue'
import SelectTrigger from './SelectTrigger.vue'

function findContentElement(): HTMLElement | null {
  return document.querySelector('[data-dismissable-layer]')
}

function renderSelect(contentStyle?: StyleValue) {
  const Parent = {
    template: `
      <Select v-model="sel">
        <SelectTrigger size="md">Pick</SelectTrigger>
        <SelectContent :style="contentStyle">
          <SelectItem value="a">Option A</SelectItem>
          <SelectItem value="b">Option B</SelectItem>
        </SelectContent>
      </Select>
    `,
    components: { Select, SelectContent, SelectItem, SelectTrigger },
    setup() {
      return { sel: ref<string>(), contentStyle }
    }
  }

  return render(Parent, {
    container: document.body.appendChild(document.createElement('div'))
  })
}

async function openSelect(triggerEl: HTMLElement) {
  if (!Reflect.has(triggerEl, 'hasPointerCapture')) {
    triggerEl.hasPointerCapture = () => false
    triggerEl.releasePointerCapture = () => {}
  }
  triggerEl.dispatchEvent(
    new PointerEvent('pointerdown', {
      button: 0,
      pointerType: 'mouse',
      bubbles: true
    })
  )
  await nextTick()
}

describe('SelectContent z-index', () => {
  it('opens above a dialog already in the document', async () => {
    render({
      template:
        '<section class="fixed z-overlay" data-testid="existing-overlay" />'
    })
    const dialog = screen.getByTestId('existing-overlay')
    const { unmount } = renderSelect()

    await openSelect(screen.getByRole('combobox'))

    const content = findContentElement()
    expect(content).not.toBeNull()
    expect(dialog.compareDocumentPosition(content!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )

    unmount()
  })

  it('keeps the static z-index class when no dialog is open', async () => {
    const { unmount } = renderSelect()

    await openSelect(screen.getByRole('combobox'))

    const content = findContentElement()
    expect(content).not.toBeNull()
    expect(content!.style.zIndex).toBe('')
    expect(content!.className).toContain('z-overlay')

    unmount()
  })

  it('preserves caller styles above a dialog', async () => {
    render({
      template:
        '<section class="fixed z-overlay" data-testid="existing-overlay" />'
    })
    const dialog = screen.getByTestId('existing-overlay')
    const { unmount } = renderSelect({ maxWidth: '100px' })

    await openSelect(screen.getByRole('combobox'))

    const content = findContentElement()
    expect(content).not.toBeNull()
    expect(content!.style.maxWidth).toBe('100px')
    expect(dialog.compareDocumentPosition(content!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )

    unmount()
  })
})
