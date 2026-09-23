import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import PropertyNumberField from './PropertyNumberField.vue'

async function commitValue(value: string) {
  const input = screen.getByLabelText<HTMLInputElement>('X')
  await userEvent.clear(input)
  if (value !== '') await userEvent.type(input, value)
  await userEvent.tab()
  return input
}

function renderField() {
  return render(PropertyNumberField, {
    props: { label: 'X', value: 40, min: 0, max: 100 }
  })
}

describe('PropertyNumberField', () => {
  it('commits a clamped value on change', async () => {
    const { emitted } = renderField()
    await commitValue('250')
    expect(emitted('commit')).toEqual([[100]])
  })

  it('reverts an emptied field instead of committing 0', async () => {
    const { emitted } = renderField()
    const input = await commitValue('')
    await nextTick()
    expect(emitted('commit')).toBeUndefined()
    expect(input.value).toBe('40')
  })
})
