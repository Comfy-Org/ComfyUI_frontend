// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import type { WorkshopDetailModel } from '../../config/workshop-detail'
import WorkshopForm from './WorkshopForm.vue'

const model = {
  id: 'bfl/flux-3',
  slug: 'bfl-flux-3',
  displayName: 'Flux 3',
  provider: 'Black Forest Labs',
  modality: 'image',
  description: 'Text to image.',
  tags: ['image'],
  fields: [
    {
      kind: 'text',
      name: 'prompt',
      label: 'Prompt',
      required: true,
      multiline: true,
      valueType: 'string'
    },
    {
      kind: 'select',
      name: 'aspect_ratio',
      label: 'Aspect ratio',
      required: false,
      options: ['1:1', '16:9'],
      defaultValue: '1:1'
    }
  ]
} as unknown as WorkshopDetailModel

function renderForm(modelValue: Record<string, unknown>) {
  const updated = vi.fn()
  render(WorkshopForm, {
    props: { model, modelValue, 'onUpdate:modelValue': updated } as never
  })
  return updated
}

describe('WorkshopForm', () => {
  it('renders one control per field in the model', () => {
    renderForm({})

    expect(screen.getByLabelText(/prompt/i)).toBeTruthy()
    expect(screen.getByLabelText(/aspect ratio/i)).toBeTruthy()
  })

  it('seeds the schema defaults when it is handed an empty value bag', () => {
    // A page renders the form before the visitor has touched anything, so an
    // empty bag has to become the model's defaults rather than stay empty and
    // send a request with no aspect ratio.
    const updated = renderForm({})

    expect(updated).toHaveBeenCalledWith(
      expect.objectContaining({ aspect_ratio: '1:1' })
    )
  })

  it('leaves values alone when it is handed some already', () => {
    // The same form is re-rendered after an edit; re-seeding here would throw
    // away what the visitor typed.
    const updated = renderForm({ prompt: 'a cat', aspect_ratio: '16:9' })

    expect(updated).not.toHaveBeenCalled()
  })

  it('shows the run control as not yet available', () => {
    renderForm({})

    const submit = screen.getByRole('button')
    expect(submit.hasAttribute('disabled')).toBe(true)
  })
})
