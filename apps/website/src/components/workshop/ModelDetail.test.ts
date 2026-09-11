// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, ref } from 'vue'

import type {
  AccountCredential,
  SessionFailure
} from '@comfyorg/account/session'

import type { WorkshopModelDetail } from '../../config/models-catalogue'
import { runWorkshopRouter } from '../../config/workshop-router'
import { WorkshopRouterError } from '../../config/workshop-router-errors'
import { workshopContract } from '../../config/workshop-contract-catalog'
import { getRouterWorkshopModelDetail } from '../../config/workshop-router-content'
import { refreshWorkshopCredits } from '../../config/workshop-credits'
import type { useWorkshopCredits } from '../../config/workshop-credits'
import { WORKSHOP_CLOUD_BASE_URL } from '../../config/workshop-env'
import ModelDetail from './ModelDetail.vue'

const auth = vi.hoisted(() => ({
  session: { value: undefined as AccountCredential | undefined },
  settled: { value: true },
  enabled: { value: true },
  flagSettled: { value: true },
  ensureFresh: vi.fn()
}))

const credits = vi.hoisted(() => {
  function initialBalance(): ReturnType<
    typeof useWorkshopCredits
  >['balance']['value'] {
    return { status: 'unknown' }
  }
  return { balance: { value: initialBalance() } }
})

vi.mock(import('../../config/workshop-session-state'), () => ({
  useWorkshopSession: () => ({
    user: computed(() => null),
    session: computed(() => auth.session.value),
    sessionFailure: computed<SessionFailure | undefined>(() => undefined),
    settled: computed(() => auth.settled.value),
    signedIn: computed(() => auth.session.value !== undefined),
    ensureFresh: auth.ensureFresh,
    remint: auth.ensureFresh,
    signOut: vi.fn().mockResolvedValue(undefined)
  })
}))

vi.mock(import('../../scripts/posthog'), async (importOriginal) => ({
  ...(await importOriginal()),
  useWorkshopAuthFlag: () => computed(() => auth.enabled.value),
  useWorkshopAuthFlagSettled: () => computed(() => auth.flagSettled.value)
}))

vi.mock(import('../../config/workshop-router'), async (importOriginal) => ({
  ...(await importOriginal()),
  runWorkshopRouter: vi.fn()
}))

vi.mock(import('../../config/workshop-credits'), async (importOriginal) => ({
  ...(await importOriginal()),
  refreshWorkshopCredits: vi.fn().mockResolvedValue(undefined),
  useWorkshopCredits: () => ({
    balance: computed(() => credits.balance.value),
    session: computed(() => auth.session.value)
  })
}))

const credential: AccountCredential = {
  token: 'workspace-jwt',
  expiresAt: Date.now() + 60_000,
  uid: 'user-1',
  workspace: { id: 'workspace-1', name: 'Personal', type: 'personal' },
  role: 'owner',
  permissions: []
}

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
  href: '/models/demo/',
  routerId: 'demo/demo',
  capabilities: [],
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

const runnable: WorkshopModelDetail = {
  ...model,
  routerId: 'bfl/flux-2-pro',
  slug: 'bfl--flux-2-pro',
  execution: workshopContract('bfl/flux-2-pro'),
  fields: [
    prompt,
    { kind: 'number', name: 'seed', label: 'Seed', step: 1, advanced: true }
  ],
  examples: []
}

const uncuratedRunnable: WorkshopModelDetail = {
  ...runnable,
  execution: runnable.execution
    ? { ...runnable.execution, inputs: undefined }
    : undefined
}

const routerResult = {
  outputs: [
    {
      kind: 'image' as const,
      url: 'https://assets.example/result.jpg',
      fileName: 'result.jpg'
    }
  ],
  requestId: 'request-123'
}

function mountDetail(options?: {
  clone?: { href: string }
  details?: () => ReturnType<typeof h>
  model?: WorkshopModelDetail
}) {
  return render(
    defineComponent({
      setup() {
        return () =>
          h(
            ModelDetail,
            { model: options?.model ?? model, clone: options?.clone },
            options?.details ? { details: options.details } : undefined
          )
      }
    })
  )
}

async function signedInDetail() {
  auth.session.value = credential
  mountDetail()
  await nextTick()
}

const user = () =>
  userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) })

describe('ModelDetail', () => {
  beforeEach(() => {
    auth.session = ref<AccountCredential>()
    auth.settled = ref(true)
    auth.enabled = ref(true)
    auth.flagSettled = ref(true)
    credits.balance = ref<
      ReturnType<typeof useWorkshopCredits>['balance']['value']
    >({ status: 'unknown' })
    localStorage.clear()
    sessionStorage.clear()
    vi.useFakeTimers()
    vi.stubEnv('PUBLIC_WORKSHOP_ROUTER_RUN', '1')
    vi.mocked(runWorkshopRouter).mockReset()
    vi.mocked(refreshWorkshopCredits).mockClear()
    auth.ensureFresh
      .mockReset()
      .mockResolvedValue({ status: 'ok', session: credential })
  })

  it.for([
    {
      slug: 'vertexai--gemini-3-pro-image--edit-images',
      label: 'Images',
      count: 2
    },
    { slug: 'bfl--flux-2-max--generate-images', label: 'Image', count: 3 }
  ])(
    'fills every source-image slot on first open: $slug',
    ({ slug, label, count }) => {
      const details = getRouterWorkshopModelDetail(slug)
      if (!details) throw new Error('Missing model')
      mountDetail({ model: details })
      const slot = within(screen.getByRole('group', { name: label }))
      expect(slot.getAllByRole('img')).toHaveLength(count)
      for (const image of slot.getAllByRole('img'))
        expect(image.getAttribute('src')).toMatch(/^https:\/\//)
      expect(runWorkshopRouter).not.toHaveBeenCalled()
    }
  )

  it.for([
    {
      slug: 'bfl--flux-video-upscale--edit-videos',
      file: 'color_spin_flower.mp4'
    },
    { slug: 'bria--green-screen-video--edit-videos', file: 'investigator.mp4' },
    {
      slug: 'bria--replace-video-background--edit-videos',
      file: 'stained_window_vintage_woman.mp4'
    },
    {
      slug: 'runway--aleph2-video-to-video--edit-videos',
      file: 'sunset_city_skateboarder.mp4'
    },
    { slug: 'wavespeed--flashvsr--edit-videos', file: 'lighter.mp4' }
  ])(
    'fills the source-video slot without selecting an example: $slug',
    ({ slug, file }) => {
      const details = getRouterWorkshopModelDetail(slug)
      if (!details) throw new Error('Missing model')
      mountDetail({ model: details })
      const form = within(screen.getByTestId('playground-form'))
      const player = form.getByLabelText(file, { selector: 'video' })
      expect(player.getAttribute('src')).toContain(`/input/${file}`)
      expect(
        form
          .getAllByRole('group')
          .some(
            (group) =>
              within(group).queryByLabelText(file, { selector: 'video' }) ===
              player
          )
      ).toBe(true)
      expect(player.hasAttribute('controls')).toBe(true)
      expect(runWorkshopRouter).not.toHaveBeenCalled()
      if (slug === 'bria--replace-video-background--edit-videos')
        expect(
          form
            .getByRole('img', { name: 'gothic_hall_light_rays.png' })
            .getAttribute('src')
        ).toContain('/input/gothic_hall_light_rays.png')
    }
  )

  it('reuses uploaded URLs and the retry key after a failed paid request', async () => {
    auth.session.value = credential
    const uploads = vi.fn<typeof fetch>(async (_, init) =>
      init?.method === 'POST'
        ? Response.json({
            upload_url: 'https://storage.example/upload',
            download_url: 'https://storage.example/image.png'
          })
        : new Response(null, { status: 200 })
    )
    vi.stubGlobal('fetch', uploads)
    vi.mocked(runWorkshopRouter).mockRejectedValue(
      new WorkshopRouterError('provider')
    )
    const model = getRouterWorkshopModelDetail('wavespeed--seedvr2')
    if (!model) throw new Error('Missing Wavespeed model')
    mountDetail({ model })
    await nextTick()
    const file = new File(['image'], 'image.png', { type: 'image/png' })
    await user().upload(
      screen.getByLabelText('Image to upscale', {
        selector: 'input[type="file"]'
      }),
      file
    )
    expect(uploads).not.toHaveBeenCalled()
    await user().click(screen.getByTestId('run-button'))
    await vi.waitFor(() =>
      expect(
        screen.getByTestId('playground-output').getAttribute('data-state')
      ).toBe('failed')
    )
    await user().click(screen.getByTestId('run-button'))
    await vi.waitFor(() => expect(runWorkshopRouter).toHaveBeenCalledTimes(2))
    const [first, second] = vi.mocked(runWorkshopRouter).mock.calls
    expect(first[0].body).toMatchObject({
      image: 'https://storage.example/image.png'
    })
    expect(second[0].body).toEqual(first[0].body)
    expect(second[0].idempotencyKey).toBe(first[0].idempotencyKey)
    expect(uploads).toHaveBeenCalledTimes(2)
  })

  it('shows an upload error and never calls paid generation if storage fails', async () => {
    auth.session.value = credential
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'))
    )
    const model = getRouterWorkshopModelDetail('wavespeed--seedvr2')
    if (!model) throw new Error('Missing Wavespeed model')
    mountDetail({ model })
    await nextTick()
    await user().upload(
      screen.getByLabelText('Image to upscale', {
        selector: 'input[type="file"]'
      }),
      new File(['image'], 'image.png', { type: 'image/png' })
    )
    await user().click(screen.getByTestId('run-button'))
    await vi.waitFor(() =>
      expect(screen.getByTestId('error-image').textContent).toContain(
        'Upload failed'
      )
    )
    expect(runWorkshopRouter).not.toHaveBeenCalled()
  })

  it('aborts pending storage uploads on sign-out and ignores a late upload completion', async () => {
    auth.session.value = credential
    const pending = Promise.withResolvers<Response>()
    let uploadSignal: AbortSignal | null | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (_, init) => {
        uploadSignal = init?.signal
        return pending.promise
      })
    )
    const model = getRouterWorkshopModelDetail('wavespeed--seedvr2')
    if (!model) throw new Error('Missing Wavespeed model')
    mountDetail({ model })
    await nextTick()
    await user().upload(
      screen.getByLabelText('Image to upscale', {
        selector: 'input[type="file"]'
      }),
      new File(['image'], 'image.png', { type: 'image/png' })
    )
    await user().click(screen.getByTestId('run-button'))
    await vi.waitFor(() => expect(uploadSignal).toBeDefined())
    auth.session.value = undefined
    await nextTick()
    expect(uploadSignal?.aborted).toBe(true)
    pending.resolve(
      Response.json({
        upload_url: 'https://storage.example/upload',
        download_url: 'https://storage.example/image.png'
      })
    )
    await vi.waitFor(() => expect(refreshWorkshopCredits).toHaveBeenCalled())
    expect(runWorkshopRouter).not.toHaveBeenCalled()
    expect(
      screen.getByTestId('playground-output').getAttribute('data-state')
    ).toBe('cancelled')
  })

  it.for([
    {
      signedIn: false,
      reason: 'missing-input-schema',
      explanation: /input schema is not available/
    },
    {
      signedIn: true,
      reason: 'missing-input-schema',
      explanation: /input schema is not available/
    }
  ] as const)(
    'explains $reason with signedIn=$signedIn without offering a paid run',
    async ({ signedIn, reason, explanation }) => {
      if (signedIn) auth.session.value = credential
      mountDetail({ model: { ...model, incompleteReason: reason } })
      expect(screen.getByText('Incomplete')).toBeTruthy()
      expect(screen.getByText(explanation)).toBeTruthy()
      expect(screen.queryByRole('link', { name: 'Sign in to run' })).toBeNull()
      const button = screen.getByRole('button', {
        name: 'Run not yet supported'
      })
      expect(button.matches(':disabled')).toBe(true)
      await user().click(button)
      expect(runWorkshopRouter).not.toHaveBeenCalled()
      expect(auth.ensureFresh).not.toHaveBeenCalled()
      expect(screen.queryByRole('button', { name: 'Native JSON' })).toBeNull()
    }
  )

  it('runs the real Router adapter with edited Advanced values and a fresh workspace session', async () => {
    auth.session.value = credential
    auth.ensureFresh.mockResolvedValue({
      status: 'ok',
      session: { ...credential, token: 'fresh-workspace-jwt' }
    })
    vi.mocked(runWorkshopRouter).mockResolvedValue(routerResult)
    mountDetail({ model: runnable })
    await user().type(screen.getByTestId('field-prompt'), 'A red teapot')
    await user().click(screen.getByText('Advanced settings'))
    await user().type(screen.getByTestId('field-seed'), '123456')
    await user().click(screen.getByText('Advanced settings'))
    await user().click(screen.getByTestId('run-button'))
    await vi.waitFor(() =>
      expect(
        screen.getByTestId('playground-output').getAttribute('data-state')
      ).toBe('succeeded')
    )
    expect(vi.mocked(runWorkshopRouter).mock.calls[0][0]).toMatchObject({
      contract: { id: 'bfl/flux-2-pro' },
      token: 'fresh-workspace-jwt',
      body: { prompt: 'A red teapot', seed: 123456 }
    })
    expect(auth.ensureFresh).toHaveBeenCalled()
    expect(screen.getByTestId('router-request-id').textContent).toContain(
      'request-123'
    )
    expect(refreshWorkshopCredits).toHaveBeenCalledWith({ force: true })
  })

  it('offers the real credits page after insufficient balance without losing the prompt', async () => {
    auth.session.value = credential
    vi.mocked(runWorkshopRouter).mockRejectedValue(
      new WorkshopRouterError('noCredits')
    )
    mountDetail({ model: runnable })
    await user().type(screen.getByTestId('field-prompt'), 'A red teapot')
    await user().click(screen.getByTestId('run-button'))
    await vi.waitFor(() =>
      expect(screen.getByRole('link', { name: 'Buy credits' })).toBeDefined()
    )
    const link = screen.getByRole('link', { name: 'Buy credits' })
    expect(link.getAttribute('href')).toBe(
      new URL('/?settings=plan-credits', WORKSHOP_CLOUD_BASE_URL).href
    )
    expect(link.getAttribute('target')).toBe('_blank')
    expect(screen.getByTestId('field-prompt')).toHaveProperty(
      'value',
      'A red teapot'
    )
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    expect(runWorkshopRouter).toHaveBeenCalledTimes(1)
  })

  it('offers billing immediately at zero credits and enables Run when the balance refreshes', async () => {
    auth.session.value = credential
    credits.balance.value = { status: 'ok', credits: 0 }
    mountDetail({ model: runnable })
    const visitor = user()
    await visitor.type(
      screen.getByRole('textbox', { name: /Prompt/ }),
      'A red teapot'
    )

    const buy = screen.getByRole('link', { name: 'Buy credits' })
    expect(buy.getAttribute('href')).toBe(
      `${WORKSHOP_CLOUD_BASE_URL}/?settings=plan-credits`
    )
    expect(buy.getAttribute('target')).toBe('_blank')
    expect(screen.queryByRole('button', { name: 'Run' })).toBeNull()
    expect(runWorkshopRouter).not.toHaveBeenCalled()

    credits.balance.value = { status: 'ok', credits: 100 }
    await nextTick()
    expect(screen.getByRole('button', { name: 'Run' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Buy credits' })).toBeNull()
    expect(screen.getByRole('textbox', { name: /Prompt/ })).toHaveProperty(
      'value',
      'A red teapot'
    )
  })

  it.for(['unknown', 'error'] as const)(
    'does not mistake an %s balance for zero credits',
    async (status) => {
      auth.session.value = credential
      credits.balance.value = { status }
      mountDetail({ model: runnable })
      await nextTick()
      expect(screen.getByRole('button', { name: 'Run' })).toBeTruthy()
      expect(screen.queryByRole('link', { name: 'Buy credits' })).toBeNull()
    }
  )

  it('offers a personal-workspace switch instead of billing to a member with no credits', async () => {
    auth.session.value = {
      ...credential,
      role: 'member',
      workspace: { id: 'team-1', name: 'Studio', type: 'team' }
    }
    credits.balance.value = { status: 'ok', credits: 0 }
    auth.ensureFresh.mockImplementation(async () => {
      auth.session.value = credential
      return { status: 'ok', session: credential }
    })
    vi.mocked(refreshWorkshopCredits).mockImplementation(async () => {
      credits.balance.value = { status: 'ok', credits: 100 }
    })
    mountDetail({ model: runnable })
    const visitor = user()
    await visitor.type(
      screen.getByRole('textbox', { name: /Prompt/ }),
      'Keep me'
    )
    expect(screen.getByText(/Studio has no credits left/)).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Buy credits' })).toBeNull()
    await visitor.click(
      screen.getByRole('button', { name: 'Switch to personal workspace' })
    )
    expect(screen.getByRole('button', { name: 'Run' })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: /Prompt/ })).toHaveProperty(
      'value',
      'Keep me'
    )
    expect(runWorkshopRouter).not.toHaveBeenCalled()
  })

  it('does not offer an owner-only purchase after a member receives an insufficient-credit response', async () => {
    auth.session.value = { ...credential, role: 'member' }
    auth.ensureFresh.mockResolvedValue({
      status: 'ok',
      session: auth.session.value
    })
    vi.mocked(runWorkshopRouter).mockRejectedValue(
      new WorkshopRouterError('noCredits')
    )
    mountDetail({ model: runnable })
    const visitor = user()
    await visitor.type(
      screen.getByRole('textbox', { name: /Prompt/ }),
      'Keep me'
    )
    await visitor.click(screen.getByRole('button', { name: 'Run' }))
    expect(
      await screen.findByRole('button', {
        name: 'Switch to personal workspace'
      })
    ).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Buy credits' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('does not suggest buying credits to enable an unavailable model', () => {
    auth.session.value = credential
    credits.balance.value = { status: 'ok', credits: 0 }
    mountDetail()
    expect(screen.getByTestId('run-button').hasAttribute('disabled')).toBe(true)
    expect(screen.queryByRole('link', { name: 'Buy credits' })).toBeNull()
  })

  it('keeps cancellation available if the balance becomes zero during a run', async () => {
    auth.session.value = credential
    credits.balance.value = { status: 'ok', credits: 100 }
    const pending = Promise.withResolvers<typeof routerResult>()
    vi.mocked(runWorkshopRouter).mockReturnValue(pending.promise)
    mountDetail({ model: runnable })
    const visitor = user()
    await visitor.type(
      screen.getByRole('textbox', { name: /Prompt/ }),
      'A teapot'
    )
    await visitor.click(screen.getByRole('button', { name: 'Run' }))
    await vi.waitFor(() => expect(runWorkshopRouter).toHaveBeenCalledTimes(1))

    credits.balance.value = { status: 'ok', credits: 0 }
    await nextTick()
    expect(screen.getByTestId('run-button').textContent).toContain('Cancel')
    await visitor.click(screen.getByTestId('run-button'))
    expect(
      screen.getByTestId('playground-output').getAttribute('data-state')
    ).toBe('cancelled')
    expect(screen.getByRole('link', { name: 'Buy credits' })).toBeTruthy()
    pending.resolve(routerResult)
    await vi.waitFor(() => expect(refreshWorkshopCredits).toHaveBeenCalled())
  })

  it('retries an unchanged failed request with its original key, but a deliberate new run gets a new key', async () => {
    auth.session.value = credential
    vi.mocked(runWorkshopRouter)
      .mockRejectedValueOnce(new WorkshopRouterError('provider'))
      .mockResolvedValue(routerResult)
    mountDetail({ model: runnable })
    await user().type(screen.getByTestId('field-prompt'), 'A teapot')
    await user().click(screen.getByTestId('run-button'))
    await vi.waitFor(() =>
      expect(
        screen.getByTestId('playground-output').getAttribute('data-state')
      ).toBe('failed')
    )
    await user().click(screen.getByTestId('run-button'))
    await vi.waitFor(() =>
      expect(
        screen.getByTestId('playground-output').getAttribute('data-state')
      ).toBe('succeeded')
    )
    const first = vi.mocked(runWorkshopRouter).mock.calls[0][0].idempotencyKey
    expect(vi.mocked(runWorkshopRouter).mock.calls[1][0].idempotencyKey).toBe(
      first
    )
    await user().click(screen.getByTestId('run-button'))
    await vi.waitFor(() => expect(runWorkshopRouter).toHaveBeenCalledTimes(3))
    expect(
      vi.mocked(runWorkshopRouter).mock.calls[2][0].idempotencyKey
    ).not.toBe(first)
  })

  it('does not submit with a missing required field', async () => {
    auth.session.value = credential
    mountDetail({ model: runnable })
    await nextTick()
    await user().click(screen.getByTestId('run-button'))
    expect(runWorkshopRouter).not.toHaveBeenCalled()
    expect(
      screen.getByTestId('playground-output').getAttribute('data-state')
    ).toBe('failed')
  })

  it('keeps curated models in the minimal form even when an old JSON-mode draft exists', async () => {
    sessionStorage.setItem(`comfy-workshop-form:${runnable.slug}:mode`, 'json')
    mountDetail({ model: runnable })
    await nextTick()
    expect(screen.getByRole('textbox', { name: 'Prompt' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Native JSON' })).toBeNull()
    expect(screen.queryByTestId('field-request_body')).toBeNull()
  })

  it('runs validated native JSON on an uncurated model, preserves the field draft, and restores the mode after sign-in', async () => {
    auth.session.value = credential
    vi.mocked(runWorkshopRouter).mockResolvedValue(routerResult)
    const { unmount } = mountDetail({ model: uncuratedRunnable })
    await user().type(screen.getByTestId('field-prompt'), 'Field draft')
    await user().click(screen.getByRole('button', { name: 'Native JSON' }))
    const body = { prompt: 'Native request', seed: 0, prompt_upsampling: false }
    await fireEvent.update(
      screen.getByTestId('field-request_body'),
      JSON.stringify(body)
    )
    await user().click(screen.getByTestId('run-button'))
    await vi.waitFor(() => expect(runWorkshopRouter).toHaveBeenCalledOnce())
    expect(vi.mocked(runWorkshopRouter).mock.calls[0][0].body).toEqual(body)
    await vi.waitFor(() =>
      expect(
        screen.getByTestId('playground-output').getAttribute('data-state')
      ).toBe('succeeded')
    )
    await user().click(screen.getByRole('button', { name: 'Native JSON' }))
    expect(screen.getByTestId<HTMLTextAreaElement>('field-prompt').value).toBe(
      'Field draft'
    )
    await user().click(screen.getByRole('button', { name: 'Native JSON' }))
    unmount()
    mountDetail({ model: uncuratedRunnable })
    await nextTick()
    expect(
      screen
        .getByRole('button', { name: 'Native JSON' })
        .getAttribute('aria-pressed')
    ).toBe('true')
    expect(
      JSON.parse(
        screen.getByTestId<HTMLTextAreaElement>('field-request_body').value
      )
    ).toEqual(body)
  })

  it('rejects invalid native JSON before authentication refresh or a paid request', async () => {
    auth.session.value = credential
    mountDetail({ model: uncuratedRunnable })
    await user().click(screen.getByRole('button', { name: 'Native JSON' }))
    await fireEvent.update(
      screen.getByTestId('field-request_body'),
      JSON.stringify({ prompt: 'Test', seed: 'invalid' })
    )
    await user().click(screen.getByTestId('run-button'))
    expect(runWorkshopRouter).not.toHaveBeenCalled()
    expect(
      screen.getByTestId('playground-output').getAttribute('data-state')
    ).toBe('failed')
  })

  it('uses a new key when the request body changes after a failure', async () => {
    auth.session.value = credential
    vi.mocked(runWorkshopRouter).mockRejectedValue(
      new WorkshopRouterError('provider')
    )
    mountDetail({ model: runnable })
    await user().type(screen.getByTestId('field-prompt'), 'A teapot')
    await user().click(screen.getByTestId('run-button'))
    await vi.waitFor(() =>
      expect(
        screen.getByTestId('playground-output').getAttribute('data-state')
      ).toBe('failed')
    )
    await user().type(screen.getByTestId('field-prompt'), ' in a garden')
    await user().click(screen.getByTestId('run-button'))
    await vi.waitFor(() => expect(runWorkshopRouter).toHaveBeenCalledTimes(2))
    const [first, second] = vi.mocked(runWorkshopRouter).mock.calls
    expect(second[0].body.prompt).toBe('A teapot in a garden')
    expect(second[0].idempotencyKey).not.toBe(first[0].idempotencyKey)
  })

  it('cancels the wait without publishing a late result or starting another request', async () => {
    auth.session.value = credential
    const late = Promise.withResolvers<typeof routerResult>()
    vi.mocked(runWorkshopRouter).mockReturnValue(late.promise)
    mountDetail({ model: runnable })
    await user().type(screen.getByTestId('field-prompt'), 'A teapot')
    await user().click(screen.getByTestId('run-button'))
    await vi.waitFor(() => expect(runWorkshopRouter).toHaveBeenCalledTimes(1))
    await user().click(screen.getByTestId('run-button'))
    expect(vi.mocked(runWorkshopRouter).mock.calls[0][0].signal.aborted).toBe(
      true
    )
    late.resolve(routerResult)
    await vi.waitFor(() => expect(refreshWorkshopCredits).toHaveBeenCalled())
    expect(
      screen.getByTestId('playground-output').getAttribute('data-state')
    ).toBe('cancelled')
    expect(screen.queryByTestId('router-request-id')).toBeNull()
    expect(runWorkshopRouter).toHaveBeenCalledTimes(1)
  })

  it('does not publish a result after sign-out', async () => {
    auth.session.value = credential
    const late = Promise.withResolvers<typeof routerResult>()
    vi.mocked(runWorkshopRouter).mockReturnValue(late.promise)
    mountDetail({ model: runnable })
    await user().type(screen.getByTestId('field-prompt'), 'A teapot')
    await user().click(screen.getByTestId('run-button'))
    await vi.waitFor(() => expect(runWorkshopRouter).toHaveBeenCalledTimes(1))
    auth.session.value = undefined
    await nextTick()
    late.resolve(routerResult)
    await vi.waitFor(() => expect(refreshWorkshopCredits).toHaveBeenCalled())
    expect(screen.getByTestId('run-button').getAttribute('data-gate')).toBe(
      'signedOut'
    )
    expect(
      screen.getByTestId('playground-output').getAttribute('data-state')
    ).toBe('cancelled')
    expect(screen.queryByTestId('router-request-id')).toBeNull()
  })

  it('refuses a refreshed credential for a different workspace', async () => {
    auth.session.value = credential
    auth.ensureFresh.mockResolvedValue({
      status: 'ok',
      session: {
        ...credential,
        workspace: { ...credential.workspace, id: 'workspace-other' }
      }
    })
    mountDetail({ model: runnable })
    await user().type(screen.getByTestId('field-prompt'), 'A teapot')
    await user().click(screen.getByTestId('run-button'))
    await vi.waitFor(() =>
      expect(
        screen.getByTestId('playground-output').getAttribute('data-state')
      ).toBe('failed')
    )
    expect(runWorkshopRouter).not.toHaveBeenCalled()
  })

  it('keeps execution disabled when the run opt-in is absent', () => {
    vi.stubEnv('PUBLIC_WORKSHOP_ROUTER_RUN', undefined)
    auth.session.value = credential
    mountDetail({ model: runnable })
    expect(
      screen.getByRole('button', {
        name: 'Router execution is not enabled for this model yet.'
      })
    ).toHaveProperty('disabled', true)
    expect(runWorkshopRouter).not.toHaveBeenCalled()
  })

  it('sends a signed-out visitor to sign in and come back', async () => {
    history.replaceState(null, '', '/models/demo/?tab=api')
    mountDetail({ model: runnable })
    await nextTick()
    const button = screen.getByTestId('run-button')
    expect(button.getAttribute('data-gate')).toBe('signedOut')
    expect(button.getAttribute('href')).toBe(
      '/login/?returnTo=%2Fmodels%2Fdemo%2F%3Ftab%3Dapi'
    )
  })

  it.for<WorkshopModelDetail['fields'][number]>([
    {
      kind: 'file',
      name: 'image',
      label: 'Image',
      accept: 'image',
      required: true
    },
    {
      kind: 'text',
      name: 'image',
      label: 'Image',
      multiline: false,
      required: true,
      presentation: {
        label: 'Image',
        help: '',
        hidden: false,
        advanced: false,
        control: 'text-box',
        urlUpload: 'image'
      }
    }
  ])(
    'requires sign-in before selecting a local $kind upload while retaining the example and text draft',
    async (field) => {
      const mediaModel: WorkshopModelDetail = {
        ...runnable,
        fields: [prompt, field],
        defaults: { image: 'https://example.com/example.png' }
      }
      const visitor = user()
      const { unmount } = mountDetail({ model: mediaModel })
      await nextTick()
      const file = new File(['pixels'], 'local.png', { type: 'image/png' })
      const input = screen.getByLabelText('Image', {
        selector: 'input[type="file"]'
      })
      expect(input).toHaveProperty('disabled', true)
      expect(screen.getByRole('img', { name: 'example.png' })).toBeTruthy()
      expect(screen.getByText(/Sign in before uploading files/)).toBeTruthy()
      await visitor.type(
        screen.getByRole('textbox', { name: /Prompt/ }),
        'My image idea'
      )
      await visitor.upload(input, file)
      expect(
        screen.queryByRole('button', { name: 'Replace local.png' })
      ).toBeNull()
      unmount()

      auth.session.value = credential
      mountDetail({ model: mediaModel })
      await nextTick()
      expect(screen.getByRole('textbox', { name: /Prompt/ })).toHaveProperty(
        'value',
        'My image idea'
      )
      expect(screen.getByRole('img', { name: 'example.png' })).toBeTruthy()
      const signedInInput = screen.getByLabelText('Image', {
        selector: 'input[type="file"]'
      })
      expect(signedInInput).toHaveProperty('disabled', false)
      await visitor.upload(signedInInput, file)
      expect(
        screen.getByRole('button', { name: 'Replace local.png' })
      ).toBeTruthy()
      expect(screen.queryByText(/Sign in before uploading files/)).toBeNull()
      expect(runWorkshopRouter).not.toHaveBeenCalled()
    }
  )

  it.for(['run', 'auth', 'model'] as const)(
    'does not solicit sign-in when %s is unavailable',
    async (disabled) => {
      if (disabled === 'run')
        vi.stubEnv('PUBLIC_WORKSHOP_ROUTER_RUN', undefined)
      if (disabled === 'auth') auth.enabled.value = false
      mountDetail({ model: disabled === 'model' ? model : runnable })
      await nextTick()
      expect(screen.queryByRole('link', { name: 'Sign in to run' })).toBeNull()
      expect(
        screen.getByRole('button', {
          name: 'Router execution is not enabled for this model yet.'
        })
      ).toHaveProperty('disabled', true)
    }
  )

  it.for(['session', 'flag'] as const)(
    'waits for %s initialization before offering sign-in',
    async (pending) => {
      const readiness = pending === 'session' ? auth.settled : auth.flagSettled
      readiness.value = false
      mountDetail({ model: runnable })
      expect(
        screen
          .getByRole('button', { name: 'Checking your session…' })
          .hasAttribute('disabled')
      ).toBe(true)
      expect(screen.queryByRole('link', { name: 'Sign in to run' })).toBeNull()
      auth.session.value = credential
      readiness.value = true
      await nextTick()
      expect(
        screen.getByRole('button', { name: 'Run' }).hasAttribute('disabled')
      ).toBe(false)
    }
  )

  it('keeps media and raw JSON in one run, then retains both in request history', async () => {
    auth.session.value = credential
    vi.mocked(runWorkshopRouter).mockResolvedValue({
      ...routerResult,
      outputs: [
        ...routerResult.outputs,
        {
          kind: 'text',
          url: 'blob:response',
          fileName: 'response.json',
          text: '{"id":"one"}'
        }
      ]
    })
    mountDetail({ model: runnable })
    const visitor = user()
    await visitor.type(
      screen.getByRole('textbox', { name: /Prompt/ }),
      'A mountain'
    )
    await visitor.click(screen.getByRole('button', { name: 'Run' }))
    expect(screen.queryByTestId('earlier-runs')).toBeNull()
    await visitor.click(screen.getByRole('button', { name: 'response.json' }))
    expect(screen.getByText('{"id":"one"}')).toBeTruthy()

    vi.mocked(runWorkshopRouter).mockResolvedValue({
      ...routerResult,
      outputs: [
        {
          kind: 'image',
          url: 'https://assets.example/two.jpg',
          fileName: 'two.jpg'
        }
      ]
    })
    await visitor.click(screen.getByRole('button', { name: 'Run' }))
    expect(
      within(screen.getByTestId('earlier-runs')).getAllByRole('button')
    ).toHaveLength(2)
    await visitor.click(screen.getByTestId('earlier-run-0'))
    await visitor.click(screen.getByRole('button', { name: 'response.json' }))
    expect(screen.getByText('{"id":"one"}')).toBeTruthy()
  })

  it('evicts old blob outputs and attachments when the retained byte budget is reached', async () => {
    auth.session.value = credential
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    vi.mocked(runWorkshopRouter)
      .mockResolvedValueOnce({
        requestId: 'first',
        outputs: [
          {
            kind: 'image',
            url: 'blob:first',
            urls: ['blob:first-extra'],
            fileName: 'first.png',
            byteLength: 30 * 1024 * 1024
          },
          {
            kind: 'text',
            url: 'blob:first-metadata',
            fileName: 'first.json',
            byteLength: 40 * 1024 * 1024
          }
        ]
      })
      .mockResolvedValueOnce({
        requestId: 'second',
        outputs: [
          {
            kind: 'image',
            url: 'blob:second',
            fileName: 'second.png',
            byteLength: 1024
          }
        ]
      })
    const { unmount } = mountDetail({ model: runnable })
    const visitor = user()
    await visitor.type(
      screen.getByRole('textbox', { name: /Prompt/ }),
      'A mountain'
    )
    await visitor.click(screen.getByRole('button', { name: 'Run' }))
    expect(revoke).not.toHaveBeenCalled()
    await visitor.click(screen.getByRole('button', { name: 'Run' }))
    expect(screen.queryByTestId('earlier-runs')).toBeNull()
    for (const url of ['blob:first', 'blob:first-extra', 'blob:first-metadata'])
      expect(revoke).toHaveBeenCalledWith(url)
    expect(revoke).not.toHaveBeenCalledWith('blob:second')
    unmount()
    expect(revoke).toHaveBeenCalledWith('blob:second')
  })

  it('does not simulate a paid run after real authentication', async () => {
    await signedInDetail()
    const button = screen.getByTestId('run-button')
    expect(button.getAttribute('data-gate')).toBe('unavailable')
    expect(button.hasAttribute('disabled')).toBe(true)
    expect(button.textContent).toContain(
      'Router execution is not enabled for this model yet'
    )
  })

  it('arrives with the first example loaded and editable', async () => {
    await signedInDetail()
    expect(screen.getByTestId<HTMLTextAreaElement>('field-prompt').value).toBe(
      'a capybara'
    )
    expect(screen.getByTestId('field-end_frame')).toBeTruthy()
    expect(screen.queryByText('flf-end_frame.webp')).toBeNull()
    expect(
      screen.getByTestId('playground-output').getAttribute('data-state')
    ).toBe('example')
  })

  it.for(['My saved prompt', ''])(
    'preserves a saved prompt or deliberate clear instead of restoring the starter: %s',
    async (saved) => {
      const native = getRouterWorkshopModelDetail('bfl--flux-2-pro')
      if (!native) throw new Error('Missing model')
      expect(native.defaults.prompt).toEqual(expect.any(String))
      sessionStorage.setItem(
        `comfy-workshop-form:${native.slug}`,
        JSON.stringify({ prompt: saved })
      )
      mountDetail({ model: native })
      await nextTick()
      const input = screen.getByRole<HTMLTextAreaElement>('textbox', {
        name: 'Prompt'
      })
      expect(input.value).toBe(saved)
      await fireEvent.update(input, 'A new draft')
      await user().click(screen.getByTestId('tab-api'))
      await user().click(screen.getByTestId('tab-playground'))
      expect(
        screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Prompt' })
          .value
      ).toBe('A new draft')
      expect(runWorkshopRouter).not.toHaveBeenCalled()
    }
  )

  it('shows a Details tab and the clone button when given workflow details', async () => {
    auth.session.value = credential
    mountDetail({
      clone: { href: '/x.json' },
      details: () => h('p', 'About this workflow')
    })
    await nextTick()
    expect(screen.queryByTestId('examples-section')).toBeNull()
    expect(screen.getByTestId('clone-button').getAttribute('href')).toBe(
      '/x.json'
    )
    await user().click(screen.getByTestId('tab-details'))
    expect(screen.getByTestId('details-tab').textContent).toContain(
      'About this workflow'
    )
  })

  it('draws the model picker rather than nothing when it is the only field', async () => {
    const picker = {
      kind: 'select',
      name: 'model',
      label: 'Model',
      options: ['Omni Flash 1.1', 'Omni Flash'],
      default: 'Omni Flash 1.1'
    } as const
    auth.session.value = credential
    mountDetail({
      model: { ...model, fields: [picker], defaults: {}, examples: [] }
    })
    await nextTick()

    expect(screen.getByTestId('field-model')).toBeTruthy()
  })

  it('swaps the form to the example template', async () => {
    await signedInDetail()
    await user().click(screen.getAllByTestId('example-card')[0])

    expect(
      screen.getByTestId('playground-output').getAttribute('data-state')
    ).toBe('example')
    expect(screen.getByTestId('field-end_frame')).toBeTruthy()
    expect(screen.getByTestId<HTMLTextAreaElement>('field-prompt').value).toBe(
      'a capybara'
    )
  })

  it('renders a declared audio example with audio transport', async () => {
    auth.session.value = credential
    mountDetail({
      model: {
        ...model,
        modality: 'audio',
        examples: [
          {
            ...model.examples[0],
            thumbnailUrl: 'https://cdn.example/asset-without-extension',
            mediaKind: 'audio'
          }
        ]
      }
    })
    await nextTick()

    expect(
      screen.getByLabelText('Start and end frame').getAttribute('src')
    ).toBe('https://cdn.example/asset-without-extension')
  })

  it.for([false, true])(
    'views output-only samples without changing inputs (native JSON: %s)',
    async (nativeJson) => {
      mountDetail({
        model: {
          ...(nativeJson ? uncuratedRunnable : runnable),
          defaults: { prompt: 'Native default' },
          examples: [
            {
              ...model.examples[0],
              fields: undefined,
              sampleOnly: true,
              values: { prompt: 'Unverified legacy prompt' }
            }
          ]
        }
      })
      expect(
        screen.getByTestId<HTMLTextAreaElement>('field-prompt').value
      ).toBe('Native default')
      expect(
        screen.getByRole('heading', { name: 'Sample outputs' })
      ).toBeTruthy()
      expect(screen.getByText(/without changing your inputs/)).toBeTruthy()
      if (nativeJson)
        await user().click(screen.getByRole('button', { name: 'Native JSON' }))
      const input = screen.getByTestId<HTMLTextAreaElement>(
        nativeJson ? 'field-request_body' : 'field-prompt'
      )
      const edited = nativeJson
        ? '{"prompt":"My edited draft"}'
        : 'My edited draft'
      await fireEvent.update(input, edited)
      await user().click(screen.getByRole('button', { name: 'View sample' }))
      expect(input.value).toBe(edited)
      expect(input.isConnected).toBe(true)
      expect(screen.getByTestId('example-card').getAttribute('title')).toBe(
        'Viewing sample'
      )
      expect(
        screen.getByTestId('playground-output').getAttribute('data-state')
      ).toBe('example')
      expect(runWorkshopRouter).not.toHaveBeenCalled()
    }
  )
})
