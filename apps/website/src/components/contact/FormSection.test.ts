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

async function fillRequiredFields(
  options: { selectBuildsWorkflows?: boolean } = {}
) {
  const { selectBuildsWorkflows = true } = options
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/first name/i), 'Jane')
  await user.type(screen.getByLabelText(/last name/i), 'Doe')
  await user.type(screen.getByLabelText(/work email/i), 'jane@acme.example')
  await user.click(screen.getByRole('radio', { name: /enterprise/i }))
  await user.click(screen.getByRole('radio', { name: /yes, in production/i }))
  if (selectBuildsWorkflows) {
    await user.click(
      screen.getByRole('checkbox', { name: /one dedicated technical owner/i })
    )
  }
  await user.type(
    screen.getByLabelText(/what are you looking for/i),
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
      (screen.getByLabelText(/first name/i) as HTMLInputElement).value
    ).toBe('')
  })

  it('blocks submission with a localized error when no workflow-builder option is selected', async () => {
    submitMock.mockReset()
    render(FormSection)

    const user = await fillRequiredFields({ selectBuildsWorkflows: false })
    await user.click(screen.getByRole('button', { name: /submit/i }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/who primarily builds workflows/i)
    expect(submitMock).not.toHaveBeenCalled()
  })

  it('joins multiple workflow-builder selections with ";" for HubSpot', async () => {
    submitMock.mockReset()
    submitMock.mockResolvedValue({})
    render(FormSection)

    const user = await fillRequiredFields()
    await user.click(
      screen.getByRole('checkbox', { name: /small group of power users/i })
    )
    await user.click(screen.getByRole('button', { name: /submit/i }))

    expect(submitMock).toHaveBeenCalledTimes(1)
    const args = submitMock.mock.calls[0][0] as {
      fields: { name: string; value: string }[]
    }
    const builds = args.fields.find(
      (f) => f.name === 'who_primarily_builds_workflows'
    )
    expect(builds?.value).toBe(
      'One dedicated technical owner;Small group of power users'
    )
  })

  it('rejects whitespace-only required fields without calling HubSpot', async () => {
    submitMock.mockReset()
    render(FormSection)

    const firstName = screen.getByLabelText(/first name/i) as HTMLInputElement
    const lastName = screen.getByLabelText(/last name/i) as HTMLInputElement
    const emailEl = screen.getByLabelText(/work email/i) as HTMLInputElement
    const lookingFor = screen.getByLabelText(
      /what are you looking for/i
    ) as HTMLTextAreaElement
    firstName.value = '   '
    firstName.dispatchEvent(new Event('input', { bubbles: true }))
    lastName.value = 'Doe'
    lastName.dispatchEvent(new Event('input', { bubbles: true }))
    emailEl.value = 'jane@acme.example'
    emailEl.dispatchEvent(new Event('input', { bubbles: true }))
    lookingFor.value = 'Need seats'
    lookingFor.dispatchEvent(new Event('input', { bubbles: true }))
    const user = userEvent.setup()
    await user.click(screen.getByRole('radio', { name: /enterprise/i }))
    await user.click(screen.getByRole('radio', { name: /yes, in production/i }))
    await user.click(
      screen.getByRole('checkbox', { name: /one dedicated technical owner/i })
    )

    const submitButton = screen.getByRole('button', {
      name: /submit/i
    }) as HTMLButtonElement
    const form = submitButton.form
    if (!form) throw new Error('submit button is not associated with a form')
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/required/i)
    expect(submitMock).not.toHaveBeenCalled()
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
