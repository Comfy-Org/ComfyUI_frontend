import { fireEvent, render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import { useWorkshopModelBalance } from '@/config/workshop-model-balance'
import { signIn } from '@/lib/workshop/cinematic-studio/reshoot-engine/__fixtures__/reshootFakes'
import { useWorkshopEnabled } from '@/scripts/posthog'

import DarkroomPage from './DarkroomPage.vue'

vi.mock(import('@/config/workshop-session-state'))
vi.mock(import('@/config/workshop-credits'))
vi.mock(import('@/scripts/posthog'))
vi.mock(import('@/config/workshop-model-balance'), () => ({
  useWorkshopModelBalance: vi.fn()
}))
vi.mock(import('@/lib/darkroom/shader'), () => ({
  startLoadingTile: vi.fn(),
  stopLoadingTile: vi.fn()
}))

/** Router answers every image at once; `submitted` keeps what was asked. */
function routeRouter() {
  const submitted: { url: string; body: Record<string, unknown> }[] = []
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input)
    if (url.endsWith('/partner-node-concurrency'))
      return Response.json({ limit: 5, reason: 'default' })
    if (init?.method === 'POST') {
      submitted.push({ url, body: JSON.parse(String(init.body)) })
      const id = String(submitted.length).padStart(12, '0')
      return Response.json(
        { request_id: `00000000-0000-4000-8000-${id}`, status: 'IN_QUEUE' },
        { status: 201 }
      )
    }
    return Response.json({
      candidates: [
        {
          content: {
            parts: [{ inlineData: { mimeType: 'image/png', data: 'AQID' } }]
          },
          finishReason: 'STOP'
        }
      ]
    })
  })
  return submitted
}

async function openSignedIn() {
  signIn()
  render(DarkroomPage)
  await vi.waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Generate' }).hasAttribute('disabled')
    ).toBe(false)
  )
  return screen.getByTestId('darkroom-prompt')
}

async function make(prompt: string) {
  const box = screen.getByTestId('darkroom-prompt')
  await fireEvent.update(box, prompt)
  await userEvent.type(box, '{Enter}')
  await vi.waitFor(() =>
    expect(screen.getAllByTestId('darkroom-tile-done')).toHaveLength(4)
  )
}

let submitted: ReturnType<typeof routeRouter>
beforeEach(() => {
  window.location.hash = ''
  window.localStorage.clear()
  vi.stubGlobal('indexedDB', new IDBFactory())
  vi.stubGlobal('scrollTo', vi.fn())
  vi.stubEnv('PUBLIC_WORKSHOP_ROUTER_RUN', '1')
  vi.mocked(useWorkshopEnabled).mockReturnValue(ref(true))
  vi.mocked(useWorkshopModelBalance).mockReturnValue(
    computed(() => ({ status: 'ok' as const, credits: 500 }))
  )
  submitted = routeRouter()
})

describe('DarkroomPage', () => {
  it('stays closed while Workshop is off', async () => {
    vi.mocked(useWorkshopEnabled).mockReturnValue(ref(false))
    render(DarkroomPage)

    expect(await screen.findByTestId('darkroom-unavailable')).toBeTruthy()
    expect(screen.queryByTestId('darkroom-prompt')).toBeNull()
  })

  it('tells a visitor to sign in, and offers the link', async () => {
    render(DarkroomPage)

    const welcome = await screen.findByTestId('darkroom-welcome')
    expect(welcome.textContent).toContain(
      'Sign in with your Comfy account to start.'
    )
    expect(screen.getByRole('link', { name: /^Sign in/ })).toBeTruthy()
  })

  it('asks for a prompt before generating', async () => {
    const box = await openSignedIn()

    await userEvent.type(box, '{Enter}')

    expect(screen.getByTestId('darkroom-toast').textContent).toContain(
      'Describe the image first.'
    )
    expect(submitted).toEqual([])
  })

  it('fills the prompt from an example', async () => {
    const box = await openSignedIn()

    await userEvent.click(
      await screen.findByRole('button', { name: /^Illustration/ })
    )

    expect(box).toHaveProperty(
      'value',
      'A fox reading a map in a lantern-lit forest, gouache illustration, warm palette'
    )
  })

  it('makes a row with the chosen settings, then loads them back', async () => {
    const box = await openSignedIn()
    await userEvent.click(screen.getByTestId('darkroom-settings-toggle'))
    await userEvent.selectOptions(
      screen.getByLabelText('Model'),
      'vertexai/gemini-3.1-flash-lite-image'
    )
    await userEvent.click(screen.getByRole('button', { name: /^Tall/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))

    await make('A lighthouse')

    expect(submitted).toHaveLength(4)
    expect(submitted[0].url).toContain('/vertexai/gemini-3.1-flash-lite-image/')
    expect(submitted[0].body.generationConfig).toMatchObject({
      imageConfig: { aspectRatio: '9:16', imageSize: '2K' }
    })
    const row = screen.getByTestId('darkroom-job')
    expect(within(row).getByText('Nano Banana 2 Lite')).toBeTruthy()
    expect(screen.queryByTestId('darkroom-welcome')).toBeNull()

    await fireEvent.update(box, '')
    await userEvent.click(
      within(row).getByRole('button', { name: 'Use these settings' })
    )
    expect(box).toHaveProperty('value', 'A lighthouse')
    expect(screen.getByTestId('darkroom-toast').textContent).toContain(
      'Prompt and settings loaded.'
    )
  })

  it('opens a result in the viewer, stars it and steps to the next', async () => {
    await openSignedIn()
    await make('A lighthouse')

    await userEvent.click(screen.getAllByAltText('A lighthouse')[0])
    const viewer = screen.getByTestId('darkroom-lightbox')
    await userEvent.click(within(viewer).getByRole('button', { name: 'Star' }))
    expect(
      await within(viewer).findByRole('button', { name: '★ Starred' })
    ).toBeTruthy()

    await userEvent.keyboard('{ArrowRight}')
    expect(within(viewer).getByRole('button', { name: 'Star' })).toBeTruthy()

    await userEvent.click(within(viewer).getByRole('button', { name: 'Close' }))
    expect(screen.queryByTestId('darkroom-lightbox')).toBeNull()
  })

  it('shows Organize and a moodboard from their addresses', async () => {
    await openSignedIn()
    await make('A lighthouse')

    await userEvent.click(screen.getByTestId('darkroom-tab-organize'))
    await fireEvent(window, new HashChangeEvent('hashchange'))
    expect(
      within(screen.getByTestId('darkroom-organize-grid')).getAllByRole(
        'checkbox'
      )
    ).toHaveLength(4)

    await userEvent.click(screen.getByTestId('darkroom-tab-moodboards'))
    await fireEvent(window, new HashChangeEvent('hashchange'))
    await userEvent.click(screen.getByRole('button', { name: 'New moodboard' }))
    await fireEvent(window, new HashChangeEvent('hashchange'))

    expect(await screen.findByLabelText('Moodboard name')).toHaveProperty(
      'value',
      'New moodboard'
    )
    expect(window.location.hash).toMatch(/^#moodboards\/.+/)
  })

  it('remembers the settings for the next visit', async () => {
    await openSignedIn()
    await userEvent.click(screen.getByTestId('darkroom-settings-toggle'))
    await userEvent.click(screen.getByRole('button', { name: /^Square/ }))

    await vi.waitFor(() =>
      expect(window.localStorage.getItem('comfy.darkroom.settings')).toContain(
        '"shape":"1:1"'
      )
    )
  })
})
