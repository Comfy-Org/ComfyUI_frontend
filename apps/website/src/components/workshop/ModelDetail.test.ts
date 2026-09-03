// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import {
  useMockSession,
  EXISTING_CREDITS
} from '../../composables/useMockSession'
import type { WorkshopModelDetail } from '../../config/workshop'
import ModelDetail from './ModelDetail.vue'

const prompt = {
  kind: 'text',
  name: 'prompt',
  label: 'Prompt',
  multiline: true,
  required: true
} as const

const model: WorkshopModelDetail = {
  slug: 'demo',
  name: 'Demo',
  workflowCount: 1,
  href: '/workshop/models/demo/',
  routerId: 'demo/demo',
  capabilities: [],
  runs: 12_000,
  provider: 'Demo',
  modality: 'image',
  task: 'text-to-image',
  creditsPerRun: 8,
  nodeDisplayName: 'Demo Text to Image',
  fields: [prompt],
  defaults: {},
  examples: [
    {
      name: 'flf',
      title: 'Start and end frame',
      description: '',
      tags: [],
      thumbnailUrl: 'https://example.com/flf.webp',
      node: { id: 'DemoFLF', displayName: 'Demo First-Last-Frame' },
      fields: [
        prompt,
        {
          kind: 'file',
          name: 'end_frame',
          label: 'End frame',
          accept: 'image',
          required: true
        }
      ],
      values: { prompt: 'a capybara' }
    }
  ]
}

function mountDetail(options?: {
  clone?: { credits: number; href: string; author: string }
  details?: () => ReturnType<typeof h>
}) {
  let api!: ReturnType<typeof useMockSession>
  render(
    defineComponent({
      setup() {
        api = useMockSession()
        return () =>
          h(
            ModelDetail,
            { model, clone: options?.clone },
            options?.details ? { details: options.details } : undefined
          )
      }
    })
  )
  return api
}

async function signedInDetail() {
  const api = mountDetail()
  api.signIn('existing')
  await nextTick()
  return api
}

const user = () =>
  userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) })

const credits = (api: ReturnType<typeof useMockSession>) =>
  api.session.value.status === 'signedIn'
    ? api.session.value.account.credits
    : undefined

describe('ModelDetail', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.useFakeTimers()
  })

  it('sends a signed-out visitor to sign in and come back', async () => {
    const api = mountDetail()
    api.signOut()
    await nextTick()
    const button = screen.getByTestId('run-button')
    expect(button.getAttribute('data-gate')).toBe('signedOut')
    expect(button.getAttribute('href')).toMatch(/^\/workshop\/sign-in\?return=/)
  })

  it('shows the estimated credits as a chip on the run button', async () => {
    await signedInDetail()
    const button = screen.getByTestId('run-button')
    expect(button.getAttribute('data-gate')).toBe('ready')
    expect(screen.getByTestId('run-cost').textContent).toContain('8')
    expect(
      screen.queryByText('Final cost depends on your settings.')
    ).toBeNull()
  })

  it('arrives with the first example loaded and editable', async () => {
    await signedInDetail()
    expect(
      (screen.getByTestId('field-prompt') as HTMLTextAreaElement).value
    ).toBe('a capybara')
    expect(screen.getByText('flf-end_frame.webp')).toBeTruthy()
    expect(
      screen.getByTestId('playground-output').getAttribute('data-state')
    ).toBe('example')
  })

  it('validates the form before charging anything', async () => {
    const api = await signedInDetail()
    await user().clear(screen.getByTestId('field-prompt'))
    await user().click(screen.getByTestId('run-button'))
    expect(screen.getByTestId('error-prompt')).toBeTruthy()
    expect(credits(api)).toBe(EXISTING_CREDITS)
  })

  it('runs, then charges the per-run price on completion', async () => {
    const api = await signedInDetail()
    await user().type(screen.getByTestId('field-prompt'), 'a cat')
    await user().click(screen.getByTestId('run-button'))
    expect(screen.getByTestId('run-cancel')).toBeTruthy()

    vi.advanceTimersByTime(2500)
    await nextTick()
    expect(screen.getByTestId('run-credits-used').textContent).toContain('8')
    expect(credits(api)).toBe(EXISTING_CREDITS - 8)
  })

  it('cancels a run without charging', async () => {
    const api = await signedInDetail()
    await user().type(screen.getByTestId('field-prompt'), 'a cat')
    await user().click(screen.getByTestId('run-button'))
    await user().click(screen.getByTestId('run-cancel'))

    vi.advanceTimersByTime(3000)
    await nextTick()
    expect(screen.queryByTestId('run-credits-used')).toBeNull()
    expect(credits(api)).toBe(EXISTING_CREDITS)
  })

  it('sends a short balance to Comfy Platform with the form saved for the return', async () => {
    const api = await signedInDetail()
    api.setCredits(3)
    await nextTick()
    await user().type(screen.getByTestId('field-prompt'), ' in a hat')
    const run = screen.getByTestId('run-button')
    expect(run.getAttribute('data-gate')).toBe('noCredits')
    expect(run.getAttribute('href')).toBe('https://platform.comfy.org')
    expect(screen.getByTestId('gate-note').textContent).toContain('3 credits')
    expect(
      JSON.parse(sessionStorage.getItem('comfy-workshop-form:demo') ?? '{}')
        .prompt
    ).toBe('a capybara in a hat')
  })

  it('shows the latest run and keeps earlier ones from this visit reachable', async () => {
    const api = await signedInDetail()
    await user().click(screen.getByTestId('run-button'))
    vi.advanceTimersByTime(2500)
    await nextTick()
    expect(screen.queryByTestId('earlier-runs')).toBeNull()

    await user().click(screen.getByTestId('run-button'))
    vi.advanceTimersByTime(2500)
    await nextTick()
    expect(screen.getAllByTestId(/^earlier-run-/)).toHaveLength(1)
    expect(credits(api)).toBe(EXISTING_CREDITS - 16)
  })

  it('sends a team member without credits to the owner or their own workspace', async () => {
    const api = await signedInDetail()
    api.setRole('member')
    await nextTick()
    expect(screen.getByTestId('run-button').getAttribute('data-gate')).toBe(
      'memberNoCredits'
    )
    await user().click(screen.getByTestId('switch-personal'))
    expect(credits(api)).toBe(EXISTING_CREDITS)
    expect(screen.getByTestId('run-button').getAttribute('data-gate')).toBe(
      'ready'
    )
  })

  it('shows a Details tab and the clone button when given workflow details', async () => {
    const api = mountDetail({
      clone: { credits: 2900, href: '/x.json', author: '@studioX' },
      details: () => h('p', 'About this workflow')
    })
    api.signIn('existing')
    await nextTick()
    expect(screen.queryByTestId('tab-examples')).toBeNull()
    expect(screen.getByTestId('clone-button').textContent).toContain('2,900')
    expect(screen.getByTestId('clone-button').getAttribute('href')).toBe(
      '/x.json'
    )
    await user().click(screen.getByTestId('tab-details'))
    expect(screen.getByTestId('details-tab').textContent).toContain(
      'About this workflow'
    )
  })

  it('swaps the form to the example template', async () => {
    await signedInDetail()
    await user().click(screen.getByTestId('tab-examples'))
    await user().click(screen.getByTestId('example-open'))

    expect(
      screen.getByTestId('playground-output').getAttribute('data-state')
    ).toBe('example')
    expect(screen.getByText('flf-end_frame.webp')).toBeTruthy()
    expect(
      (screen.getByTestId('field-prompt') as HTMLTextAreaElement).value
    ).toBe('a capybara')
  })
})
