// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import { useMockSession,EXISTING_CREDITS } from '../../composables/useMockSession'
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

function mountDetail() {
  let api!: ReturnType<typeof useMockSession>
  render(
    defineComponent({
      setup() {
        api = useMockSession()
        return () => h(ModelDetail, { model })
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

  it('validates the form before charging anything', async () => {
    const api = await signedInDetail()
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

  it('swaps the form to the example template and back', async () => {
    await signedInDetail()
    await user().click(screen.getByTestId('tab-examples'))
    await user().click(screen.getAllByTestId('example-open')[0])

    expect(screen.getByTestId('active-example').textContent).toContain(
      'Demo First-Last-Frame'
    )
    expect(screen.getByTestId('field-end_frame')).toBeTruthy()
    expect(
      (screen.getByTestId('field-prompt') as HTMLTextAreaElement).value
    ).toBe('a capybara')

    await user().click(screen.getByTestId('active-example-clear'))
    expect(screen.queryByTestId('field-end_frame')).toBeNull()
  })
})
