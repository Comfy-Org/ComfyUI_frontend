import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import EditorPromptBox from './EditorPromptBox.vue'

const props = { label: 'Prompt', modelValue: '' }

describe('EditorPromptBox', () => {
  it('takes what the visitor types under its label', async () => {
    const { emitted } = render(EditorPromptBox, { props })

    await userEvent.type(screen.getByLabelText('Prompt'), 'a')

    expect(emitted('update:modelValue')).toEqual([['a']])
  })

  it('shows the extras row only when it has extras', () => {
    render(EditorPromptBox, {
      props,
      slots: { default: '<button type="button">Add reference</button>' }
    })

    expect(screen.getByRole('button', { name: 'Add reference' })).toBeVisible()
  })
})
