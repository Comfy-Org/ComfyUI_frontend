// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it } from 'vitest'

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
    },
    {
      kind: 'number',
      name: 'steps',
      label: 'Steps',
      required: false,
      integer: true,
      step: 1,
      defaultValue: 20
    }
  ]
}

describe('WorkshopPlayground', () => {
  beforeEach(() => sessionStorage.clear())

  it('restores a stash once and keeps defaults for omitted fields', async () => {
    sessionStorage.setItem(
      `comfy.workshop.form.${model.slug}`,
      JSON.stringify({ prompt: 'Stashed red fox' })
    )

    render(WorkshopPlayground, { props: { model } })

    const prompt = screen.getByRole('textbox', {
      name: /Prompt/
    }) as HTMLTextAreaElement
    await waitFor(() => expect(prompt.value).toBe('Stashed red fox'))
    expect(
      sessionStorage.getItem(`comfy.workshop.form.${model.slug}`),
      'the stash is consumed by the restore'
    ).toBeNull()

    expect(
      screen.getByText(/"steps": 20/),
      'a default not present in the stash must survive the restore merge'
    ).toBeTruthy()
  })

  it('keeps a deliberately cleared number field empty', async () => {
    sessionStorage.setItem(
      `comfy.workshop.form.${model.slug}`,
      JSON.stringify({ steps: null })
    )

    render(WorkshopPlayground, { props: { model } })

    const steps = screen.getByRole('spinbutton', {
      name: /Steps/
    }) as HTMLInputElement
    await waitFor(() => expect(steps.value).toBe(''))
  })

  it('updates every snippet from the current form values', async () => {
    const user = userEvent.setup()
    render(WorkshopPlayground, { props: { model } })

    await user.type(screen.getByRole('textbox', { name: /Prompt/ }), 'Red fox')
    expect(screen.getByText(/"prompt": "Red fox"/)).toBeTruthy()

    const typeScriptTab = screen.getByRole('tab', { name: 'TypeScript' })
    typeScriptTab.focus()
    await user.keyboard('{ArrowRight}')

    const pythonTab = screen.getByRole('tab', { name: 'Python' })
    expect(screen.getByRole('tab', { selected: true })).toBe(pythonTab)
    expect(screen.getByText(/comfy\.models\.run\("bfl\/flux-3"/)).toBeTruthy()
    expect(screen.getByText(/"prompt": "Red fox"/)).toBeTruthy()
  })
})
