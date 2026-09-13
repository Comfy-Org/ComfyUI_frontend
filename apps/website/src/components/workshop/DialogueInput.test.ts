// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import DialogueInput from './DialogueInput.vue'

function mountDialogue(disabled = false) {
  const value = ref(JSON.stringify([{ text: 'Hello', voice_id: 'voice-a' }]))
  render(
    defineComponent({
      setup: () => () =>
        h(DialogueInput, {
          name: 'inputs',
          label: 'Dialogue',
          modelValue: value.value,
          disabled,
          'onUpdate:modelValue': (next: string) => {
            value.value = next
          }
        })
    })
  )
  return value
}

describe('DialogueInput', () => {
  it('edits, adds, and removes ordered speaking turns without exposing a JSON editor', async () => {
    const value = mountDialogue()
    const user = userEvent.setup()
    const first = within(screen.getByRole('group', { name: 'Turn 1' }))
    expect(first.getByRole('textbox', { name: 'Text' })).toHaveValue('Hello')
    expect(first.getByRole('textbox', { name: 'Voice ID' })).toHaveValue(
      'voice-a'
    )
    await user.click(screen.getByRole('button', { name: 'Add turn' }))
    const second = within(screen.getByRole('group', { name: 'Turn 2' }))
    await user.type(
      second.getByRole('textbox', { name: 'Text' }),
      'A "quoted" reply'
    )
    await user.type(
      second.getByRole('textbox', { name: 'Voice ID' }),
      'voice-b'
    )
    expect(JSON.parse(value.value)).toEqual([
      { text: 'Hello', voice_id: 'voice-a' },
      { text: 'A "quoted" reply', voice_id: 'voice-b' }
    ])
    await user.click(first.getByRole('button', { name: 'Remove turn' }))
    expect(JSON.parse(value.value)).toEqual([
      { text: 'A "quoted" reply', voice_id: 'voice-b' }
    ])
    expect(screen.queryByRole('group', { name: 'Turn 2' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Remove turn' })).toBeNull()
  })

  it('prevents editing and adding turns while a request is running', async () => {
    const value = mountDialogue(true)
    const before = value.value
    const user = userEvent.setup()
    await user.type(screen.getByRole('textbox', { name: 'Text' }), 'Not added')
    await user.click(screen.getByRole('button', { name: 'Add turn' }))
    expect(value.value).toBe(before)
    expect(screen.getByRole('textbox', { name: 'Voice ID' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add turn' })).toBeDisabled()
  })
})
