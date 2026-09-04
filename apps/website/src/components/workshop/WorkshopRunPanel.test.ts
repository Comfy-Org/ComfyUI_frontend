// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useWorkshopCredentials } from '../../config/workshop-credentials-state'
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
  // The credential lives outside the panel now — it comes from the floating
  // key widget, and in the shipped app it will come from a session.
  useWorkshopCredentials().save('')
})

function enterKey(value = 'comfyui-abc') {
  useWorkshopCredentials().save(value)
}

const runButton = () =>
  screen.getByRole('button', { name: /^(Run|Sign up \/ Login to Render)$/ })

describe('WorkshopRunPanel', () => {
  it('asks you to sign in before it will run anything', async () => {
    renderPanel()

    // Not disabled — a dead button tells you nothing. It offers the way in.
    expect(runButton().textContent).toContain('Sign up / Login to Render')
    expect((runButton() as HTMLButtonElement).disabled).toBe(false)

    enterKey()
    await waitFor(() => {
      expect(runButton().textContent).toContain('Run')
    })
  })

  it('runs the model and shows the image it returned', async () => {
    const fetchMock = vi.fn(async () =>
      Promise.resolve(
        jsonResponse(200, { images: [{ url: 'https://storage/out.png' }] })
      )
    )
    vi.stubGlobal('fetch', fetchMock)

    renderPanel()
    enterKey()
    await userEvent.setup().click(runButton())

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
    enterKey()
    await userEvent.setup().click(runButton())

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('That API key was not accepted.')
    // Router's own words are kept underneath, and the id is shown so it can
    // be quoted into a support request.
    expect(alert.textContent).toContain('API key not found.')
    expect(alert.textContent).toContain('r1')
  })

  it('does not put a credential field in the product UI', () => {
    // The key is scaffolding and lives in a floating widget outside the
    // layout; in the shipped app it comes from a session. Persistence is
    // covered in workshop-credentials.test.ts.
    renderPanel()

    // The key only exists inside the closed sign-in dialog, which stands in
    // for a session until comfy.org can start one.
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryAllByRole('textbox')).toEqual([])
  })

  it('shows the response when a model returns no media', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Promise.resolve(jsonResponse(200, { status: 'queued', seed: 42 }))
      )
    )

    renderPanel()
    enterKey()
    await userEvent.setup().click(runButton())

    expect(
      await screen.findByText(
        'The model returned no media. The full response is below.'
      )
    ).toBeTruthy()
    expect(screen.getByText(/"seed": 42/)).toBeTruthy()
  })
})
