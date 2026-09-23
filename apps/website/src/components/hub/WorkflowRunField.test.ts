import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import type { WorkflowField } from '../../config/workflow-fields'
import type { FileValue } from '../../config/workshop-playground'
import WorkflowRunField from './WorkflowRunField.vue'

function mountField(field: WorkflowField, initial?: string | number) {
  const value = ref<string | number | undefined>(initial)
  const file = ref<FileValue>()
  render(
    defineComponent({
      setup: () => () =>
        h(WorkflowRunField, {
          field,
          name: `${field.node}.${field.input}`,
          modelValue: value.value,
          'onUpdate:modelValue': (next: string | number | undefined) => {
            value.value = next
          },
          file: file.value,
          'onUpdate:file': (next: FileValue | undefined) => {
            file.value = next
          }
        })
    })
  )
  return { value, file }
}

describe('WorkflowRunField', () => {
  // A workflow asks for a picture the same way a model does, through the
  // control that shows what was chosen and lets it be replaced or removed,
  // rather than a bare file input beside it on the same site.
  it('takes a picture through the control a model page uses', async () => {
    const { file } = mountField({
      node: '1',
      input: 'image',
      label: 'Your image',
      kind: 'image'
    })
    const chosen = new File(['x'], 'mine.png', { type: 'image/png' })

    await userEvent
      .setup()
      .upload(
        screen.getByLabelText('Your image', { selector: 'input' }),
        chosen
      )

    expect(file.value).toMatchObject({ name: 'mine.png', file: chosen })
    expect(screen.getByRole('group', { name: 'Your image' })).toBeTruthy()
  })

  // The label is what the reader was asked, so it is the label the control
  // answers to, whatever the node behind it is called.
  it.for([
    { kind: 'video' as const, label: 'Your clip' },
    { kind: 'audio' as const, label: 'Your track' }
  ])('asks for $kind by the words the reader sees', ({ kind, label }) => {
    mountField({ node: '2', input: kind, label, kind })

    expect(screen.getByRole('group', { name: label })).toBeTruthy()
  })

  it('writes what was typed into the answer the graph takes', async () => {
    const { value } = mountField(
      { node: '3', input: 'prompt', label: 'What to make', kind: 'text' },
      'a cat'
    )

    const box = screen.getByLabelText('What to make')
    await userEvent.setup().type(box, '!')

    expect(value.value).toBe('a cat!')
  })

  it('carries a number field its bounds', () => {
    mountField(
      {
        node: '4',
        input: 'steps',
        label: 'Steps',
        kind: 'number',
        min: 1,
        max: 50,
        step: 1
      },
      20
    )

    const box = screen.getByLabelText('Steps')
    expect(box).toHaveProperty('min', '1')
    expect(box).toHaveProperty('max', '50')
  })
})
