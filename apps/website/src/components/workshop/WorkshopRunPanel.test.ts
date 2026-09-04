// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useWorkshopCredentials } from '../../config/workshop-credentials-state'
import type { WorkshopDetailModel } from '../../config/workshop-detail'
import WorkshopRunPanel from './WorkshopRunPanel.vue'

interface SessionHandles {
  setUser?: (user: { uid: string } | null) => void
  setSessionToken?: (token: string | undefined) => void
  ensureFresh?: ReturnType<typeof vi.fn>
  remint?: ReturnType<typeof vi.fn>
  flag?: { value: boolean }
}

const sessionHandles = vi.hoisted<SessionHandles>(() => ({}))

vi.mock('../../scripts/posthog', async () => {
  const { ref } = await import('vue')
  const flag = ref(false)
  sessionHandles.flag = flag
  return { useWorkshopAuthFlag: () => flag }
})

vi.mock('../../config/workshop-session-state', async () => {
  const { computed, ref } = await import('vue')
  const user = ref<{ uid: string } | null>(null)
  const session = ref<{ token: string } | undefined>(undefined)
  const ensureFresh = vi.fn(async () => ({ status: 'ok' }))
  const remint = vi.fn(async () => ({ status: 'ok' }))
  sessionHandles.setUser = (next) => {
    user.value = next
  }
  sessionHandles.setSessionToken = (token) => {
    session.value = token === undefined ? undefined : { token }
  }
  sessionHandles.ensureFresh = ensureFresh
  sessionHandles.remint = remint
  return {
    useWorkshopSession: () => ({
      user,
      session,
      signedIn: computed(() => session.value !== undefined),
      ensureFresh,
      remint,
      signOut: vi.fn()
    })
  }
})

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
  sessionHandles.flag!.value = false
  sessionHandles.setUser!(null)
  sessionHandles.setSessionToken!(undefined)
  sessionHandles.ensureFresh!.mockClear()
  sessionHandles.ensureFresh!.mockImplementation(async () => ({
    status: 'ok'
  }))
  sessionHandles.remint!.mockClear()
  sessionHandles.remint!.mockImplementation(async () => ({ status: 'ok' }))
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

  it('sends a signed-out visitor to the sign-in page instead of the key dialog when auth is live', async () => {
    sessionHandles.flag!.value = true
    const assign = vi
      .spyOn(window.location, 'assign')
      .mockImplementation(() => {})
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    renderPanel()
    await userEvent.setup().click(runButton())

    expect(assign).toHaveBeenCalledOnce()
    const target = assign.mock.calls[0]?.[0] as string
    expect(target).toContain('/login/?returnTo=')
    expect(
      fetchMock,
      'no run request may fire while signed out'
    ).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('runs with the token the awaited refresh produced, never the one from before the click', async () => {
    sessionHandles.setUser!({ uid: 'user-1' })
    sessionHandles.setSessionToken!('stale-jwt')
    sessionHandles.ensureFresh!.mockImplementation(async () => {
      sessionHandles.setSessionToken!('fresh-jwt')
      return { status: 'ok' }
    })
    const fetchMock = vi.fn(async () => jsonResponse(200, {}))
    vi.stubGlobal('fetch', fetchMock)

    renderPanel()
    await userEvent.setup().click(runButton())

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(
      (init.headers as Record<string, string>).Authorization,
      'valid-on-read: the run must carry what ensureFresh resolved with'
    ).toBe('Bearer fresh-jwt')
  })

  it('re-mints exactly once on an unauthorized run and replays the same idempotency key', async () => {
    sessionHandles.setUser!({ uid: 'user-1' })
    sessionHandles.setSessionToken!('revoked-jwt')
    sessionHandles.remint!.mockImplementation(async () => {
      sessionHandles.setSessionToken!('reminted-jwt')
      return { status: 'ok' }
    })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          401,
          { error_type: 'unauthorized' },
          { 'X-Comfy-Error-Type': 'unauthorized' }
        )
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { images: [{ url: 'https://storage/out.png' }] })
      )
    vi.stubGlobal('fetch', fetchMock)

    renderPanel()
    await userEvent.setup().click(runButton())

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(sessionHandles.remint).toHaveBeenCalledOnce()
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][]
    const headers = calls.map(
      ([, init]) => init.headers as Record<string, string>
    )
    expect(headers[1]?.Authorization).toBe('Bearer reminted-jwt')
    expect(
      headers[1]?.['Idempotency-Key'],
      'the retry replays the SAME logical run — a new key could bill twice'
    ).toBe(headers[0]?.['Idempotency-Key'])
    await waitFor(() =>
      expect(screen.getByAltText('FLUX 2 Pro').getAttribute('src')).toBe(
        'https://storage/out.png'
      )
    )
  })

  it('never retries an unauthorized run for a pasted key', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        401,
        { error_type: 'unauthorized' },
        { 'X-Comfy-Error-Type': 'unauthorized' }
      )
    )
    vi.stubGlobal('fetch', fetchMock)

    renderPanel()
    enterKey()
    await userEvent.setup().click(runButton())

    await screen.findByRole('alert')
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(sessionHandles.remint).not.toHaveBeenCalled()
  })

  it('surfaces a failed session refresh without firing the run', async () => {
    sessionHandles.setUser!({ uid: 'user-1' })
    sessionHandles.setSessionToken!('expiring-jwt')
    sessionHandles.ensureFresh!.mockImplementation(async () => {
      sessionHandles.setSessionToken!(undefined)
      return { status: 'error', reason: 'http', httpStatus: 503 }
    })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    renderPanel()
    await userEvent.setup().click(runButton())

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(
      'Your session could not be refreshed. Sign in again and retry.'
    )
    expect(fetchMock).not.toHaveBeenCalled()
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
