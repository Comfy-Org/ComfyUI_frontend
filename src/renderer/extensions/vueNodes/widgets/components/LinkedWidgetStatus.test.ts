import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'

import { i18n } from '@/i18n'

import LinkedWidgetStatus from './LinkedWidgetStatus.vue'

const originalLocale = i18n.global.locale.value
const originalFrenchMessages = i18n.global.getLocaleMessage('fr')

afterEach(() => {
  i18n.global.locale.value = originalLocale
  i18n.global.setLocaleMessage('fr', originalFrenchMessages)
})

describe('LinkedWidgetStatus', () => {
  it('exposes the linked state as a named image', () => {
    render(LinkedWidgetStatus, {
      props: {
        display: 'control',
        widget: { name: 'prompt', label: 'Prompt' }
      }
    })

    expect(
      screen.getByRole('img', { name: 'Prompt: Linked input' })
    ).toBeVisible()
  })

  it('allows pointer gestures to bubble to the canvas surface', async () => {
    const onPointerdown = vi.fn()
    const Harness = defineComponent({
      components: { LinkedWidgetStatus },
      setup: () => ({ onPointerdown }),
      template: `
        <div @pointerdown="onPointerdown">
          <LinkedWidgetStatus
            display="control"
            :widget="{ name: 'prompt' }"
          />
        </div>
      `
    })
    render(Harness)
    const user = userEvent.setup()

    await user.pointer({ keys: '[MouseLeft]', target: screen.getByRole('img') })

    expect(onPointerdown).toHaveBeenCalledTimes(1)
  })

  it('updates its accessible name when the locale changes', async () => {
    render(LinkedWidgetStatus, {
      props: {
        display: 'control',
        widget: { name: 'prompt' }
      }
    })
    i18n.global.mergeLocaleMessage('fr', {
      widgets: { linkedInput: 'Entrée liée' }
    })
    i18n.global.locale.value = 'fr'

    await nextTick()

    expect(
      screen.getByRole('img', { name: 'prompt: Entrée liée' })
    ).toBeVisible()
  })
})
