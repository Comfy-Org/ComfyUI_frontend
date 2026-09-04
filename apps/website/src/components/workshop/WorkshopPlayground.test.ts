// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { WorkshopDetailModel } from '../../config/workshop-detail'
import WorkshopPlayground from './WorkshopPlayground.vue'

const model: WorkshopDetailModel = {
  id: 'bfl/flux-3',
  slug: 'bfl--flux-3',
  displayName: 'Flux 3',
  provider: 'bfl',
  modality: 'image',
  description: 'Generates an image.',
  tags: ['text-to-image'],
  fields: [
    {
      kind: 'text',
      name: 'prompt',
      label: 'Prompt',
      required: true,
      multiline: true,
      valueType: 'string'
    }
  ]
}

describe('WorkshopPlayground', () => {
  it('updates every snippet from the current form values', async () => {
    const user = userEvent.setup()
    render(WorkshopPlayground, { props: { model } })

    // The prompt arrives pre-filled with a sample, so replace it rather than
    // typing on the end of it.
    const prompt = screen.getByRole('textbox', { name: /Prompt/ })
    await user.clear(prompt)
    await user.type(prompt, 'Red fox')

    // The snippet lives behind the API tab now: the result gets the column
    // beside the form, matching the platform playground.
    await user.click(screen.getByRole('tab', { name: 'API' }))
    expect(screen.getByText(/"prompt": "Red fox"/)).toBeTruthy()

    await user.click(screen.getByRole('tab', { name: 'Python' }))
    expect(screen.getByText(/comfy\.models\.run\("bfl\/flux-3"/)).toBeTruthy()
    expect(screen.getByText(/"prompt": "Red fox"/)).toBeTruthy()
  })
})
