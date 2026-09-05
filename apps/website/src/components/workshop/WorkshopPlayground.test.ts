// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

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

  it('copies the selected snippet and confirms the action', async () => {
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue(undefined)
    render(WorkshopPlayground, { props: { model } })

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Copy code' }))

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("comfy.models.run('bfl/flux-3'")
    )
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy()
  })
})
