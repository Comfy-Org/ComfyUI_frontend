// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { cleanup, render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type * as SubmitModule from '../../utils/submitHubspotForm'

import { HubspotSubmissionError } from '../../utils/submitHubspotForm'

afterEach(() => {
  cleanup()
})

vi.mock('../../composables/useHeroAnimation', () => ({
  useHeroAnimation: () => undefined
}))

const submitMock = vi.fn()

vi.mock('../../utils/submitHubspotForm', async () => {
  const actual = await vi.importActual<typeof SubmitModule>(
    '../../utils/submitHubspotForm'
  )
  return {
    ...actual,
    submitHubspotForm: (...args: unknown[]) => submitMock(...args),
    readHubspotTrackingCookie: () => 'test-hutk'
  }
})

import FormSection from './FormSection.vue'

async function fillRequiredFields() {
  const user = userEvent.setup()
  await user.type(screen.getByPlaceholderText('Jane'), 'Jane')
  await user.type(screen.getByPlaceholderText('Smith'), 'Doe')
  await user.type(
    screen.getByPlaceholderText('jane@company.com'),
    'jane@acme.example'
  )
  await user.click(screen.getByText('ENTERPRISE'))
  await user.click(screen.getByText('Yes, in production'))
  await user.click(screen.getByText('One dedicated technical owner'))
  await user.type(
    screen.getByPlaceholderText(
      'Tell us about your team needs, expected usage, or other specific requirements.'
    ),
    'Need 50 seats'
  )
  return user
}

describe('FormSection', () => {
  it('submits the HubSpot payload with mapped field names and objectTypeId', async () => {
    submitMock.mockReset()
    submitMock.mockResolvedValue({})
    render(FormSection)

    const user = await fillRequiredFields()
    await user.click(screen.getByRole('button', { name: /submit/i }))

    expect(submitMock).toHaveBeenCalledTimes(1)
    const args = submitMock.mock.calls[0][0] as {
      config: { portalId: string; formGuid: string }
      fields: { objectTypeId: string; name: string; value: string }[]
      context: { hutk?: string | null }
    }

    expect(args.config.portalId).toBe('244637579')
    expect(args.config.formGuid).toBe('94e05eab-1373-47f7-ab5e-d84f9e6aa262')
    expect(args.context.hutk).toBe('test-hutk')

    const fieldByName = Object.fromEntries(args.fields.map((f) => [f.name, f]))
    expect(fieldByName.firstname).toEqual({
      objectTypeId: '0-1',
      name: 'firstname',
      value: 'Jane'
    })
    expect(fieldByName.email).toEqual({
      objectTypeId: '0-1',
      name: 'email',
      value: 'jane@acme.example'
    })
    expect(fieldByName.are_youyour_team_currently_using_comfy.value).toBe(
      'Yes, in production'
    )
    expect(
      fieldByName
        .to_give_you_ann_idea_of_pricing_upfront__while_comfyui_does_work_with_companies_of_all_sizes__our_mi
        .value
    ).toBe('Yes')
    expect(fieldByName.who_primarily_builds_workflows.value).toBe(
      'One dedicated technical owner'
    )
    expect(fieldByName.comfy_intake_notes.value).toBe('Need 50 seats')
  })

  it('shows the success message and resets the form on success', async () => {
    submitMock.mockReset()
    submitMock.mockResolvedValue({})
    render(FormSection)

    const user = await fillRequiredFields()
    await user.click(screen.getByRole('button', { name: /submit/i }))

    await screen.findByRole('status')
    expect(screen.getByRole('status').textContent).toContain(
      'your message is in'
    )
    expect(
      (screen.getByPlaceholderText('Jane') as HTMLInputElement).value
    ).toBe('')
  })

  it('surfaces HubSpot validation messages on failure', async () => {
    submitMock.mockReset()
    submitMock.mockRejectedValue(
      new HubspotSubmissionError('boom', 400, [
        {
          message: 'Email is required.',
          errorType: 'REQUIRED_FIELD',
          in: 'email'
        }
      ])
    )

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(FormSection)
    const user = await fillRequiredFields()
    await user.click(screen.getByRole('button', { name: /submit/i }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Email is required.')
    consoleSpy.mockRestore()
  })
})
