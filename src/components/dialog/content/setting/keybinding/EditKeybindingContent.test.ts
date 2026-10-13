import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import type { KeyComboImpl } from '@/platform/keybindings/keyCombo'

import EditKeybindingContent from './EditKeybindingContent.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderRecorder() {
  const onUpdateCombo = vi.fn<(combo: KeyComboImpl) => void>()
  render(EditKeybindingContent, {
    props: {
      dialogState: {
        commandId: 'Test.Command',
        newCombo: null,
        currentCombo: null,
        existingBinding: null
      },
      commandLabel: 'Test command',
      onUpdateCombo,
      existingKeybindingOnCombo: null
    },
    global: { plugins: [i18n] }
  })
  return { input: screen.getByRole('textbox'), onUpdateCombo }
}

function press(input: HTMLElement, init: KeyboardEventInit) {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init
  })
  input.dispatchEvent(event)
  return event
}

describe('EditKeybindingContent', () => {
  it.for([
    { name: 'Tab', init: { key: 'Tab' } },
    { name: 'Shift+Tab', init: { key: 'Tab', shiftKey: true } },
    { name: 'Escape', init: { key: 'Escape' } },
    { name: 'a composing key', init: { key: 'a', isComposing: true } }
  ])('leaves $name to the browser', ({ init }) => {
    const { input, onUpdateCombo } = renderRecorder()

    expect(press(input, init).defaultPrevented).toBe(false)
    expect(onUpdateCombo).not.toHaveBeenCalled()
  })

  it.for([
    {
      name: 'Ctrl+Tab',
      init: { key: 'Tab', ctrlKey: true },
      combo: 'Ctrl + Tab'
    },
    {
      name: 'Meta+Tab',
      init: { key: 'Tab', metaKey: true },
      combo: 'Ctrl + Tab'
    },
    {
      name: 'Shift+Escape',
      init: { key: 'Escape', shiftKey: true },
      combo: 'Shift + Escape'
    },
    { name: 'Ctrl+K', init: { key: 'k', ctrlKey: true }, combo: 'Ctrl + k' }
  ])('records $name', ({ init, combo }) => {
    const { input, onUpdateCombo } = renderRecorder()

    expect(press(input, init).defaultPrevented).toBe(true)
    expect(onUpdateCombo).toHaveBeenCalledOnce()
    expect(onUpdateCombo.mock.calls[0][0].toString()).toBe(combo)
  })

  it('claims a bare modifier without recording it', () => {
    const { input, onUpdateCombo } = renderRecorder()

    expect(
      press(input, { key: 'Control', ctrlKey: true }).defaultPrevented
    ).toBe(true)
    expect(onUpdateCombo).not.toHaveBeenCalled()
  })
})
