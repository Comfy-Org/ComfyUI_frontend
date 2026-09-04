// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkshopDetailModel } from '../../config/workshop-detail'
import WorkshopRunPanel from './WorkshopRunPanel.vue'

const model: WorkshopDetailModel = {
  id: 'bfl/flux-2-pro',
  slug: 'bfl--flux-2-pro',
  displayName: 'FLUX 2 Pro',
  provider: 'bfl',
  modality: 'image',
  description: 'Generates an image.',
  tags: [],
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

function renderPanel() {
  return render(WorkshopRunPanel, {
    props: { model, values: { prompt: 'a cat' } } as never
  })
}

function jsonResponse(status: number, body: unknown, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  })
}

beforeEach(() => {
  globalThis.localStorage.clear()
})

describe('WorkshopRunPanel', () => {
  it('cannot run until a key is entered', async () => {
    renderPanel()
    const button = screen.getByRole('button', { name: 'Run' })
    expect((button as HTMLButtonElement).disabled).toBe(true)

    await userEvent.setup().type(screen.getByLabelText('Comfy API key'), 'k')
    expect((button as HTMLButtonElement).disabled).toBe(false)
  })

  it('runs the model and shows the image it returned', async () => {
    const fetchMock = vi.fn(async () =>
      Promise.resolve(
        jsonResponse(200, { images: [{ url: 'https://storage/out.png' }] })
      )
    )
    vi.stubGlobal('fetch', fetchMock)

    renderPanel()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Comfy API key'), 'comfyui-abc')
    await user.click(screen.getByRole('button', { name: 'Run' }))

    await waitFor(() =>
      expect(screen.getByAltText('FLUX 2 Pro').getAttribute('src')).toBe(
        'https://storage/out.png'
      )
    )

    // The values in the form are what actually got sent.
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.body).toBe('{"prompt":"a cat"}')
  })

  it('explains a rejected key instead of showing the raw failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Promise.resolve(
          jsonResponse(
            401,
            { detail: 'API key not found.', error_type: 'unauthorized' },
            { 'X-Comfy-Error-Type': 'unauthorized', 'X-Comfy-Request-Id': 'r1' }
          )
        )
      )
    )

    renderPanel()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Comfy API key'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Run' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('That API key was not accepted.')
    // Router's own words are kept underneath, and the id is shown so it can
    // be quoted into a support request.
    expect(alert.textContent).toContain('API key not found.')
    expect(alert.textContent).toContain('r1')
  })

  it('remembers the key across a reload but never puts it in the URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.resolve(jsonResponse(200, {})))
    )

    const { unmount } = renderPanel()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Comfy API key'), 'comfyui-remember')
    await user.click(screen.getByRole('button', { name: 'Run' }))
    await waitFor(() =>
      expect(
        screen.queryByText('Running. This can take a minute or two.')
      ).toBeNull()
    )
    unmount()

    renderPanel()
    await waitFor(() =>
      expect(
        (screen.getByLabelText('Comfy API key') as HTMLInputElement).value
      ).toBe('comfyui-remember')
    )
    expect(window.location.search).toBe('')
  })

  it('shows the response when a model returns no media', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Promise.resolve(jsonResponse(200, { status: 'queued', seed: 42 }))
      )
    )

    renderPanel()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Comfy API key'), 'comfyui-abc')
    await user.click(screen.getByRole('button', { name: 'Run' }))

    expect(
      await screen.findByText(
        'The model returned no media. The full response is below.'
      )
    ).toBeTruthy()
    expect(screen.getByText(/"seed": 42/)).toBeTruthy()
  })
})
