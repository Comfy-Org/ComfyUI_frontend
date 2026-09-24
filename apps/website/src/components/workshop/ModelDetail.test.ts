// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen, within } from '@testing-library/vue'
import { IDBFactory } from 'fake-indexeddb'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { computed, defineComponent, h, nextTick, ref } from 'vue'

import type {
  AccountCredential,
  SessionResult
} from '@comfyorg/account-core/session'

import type { WorkshopModelDetail } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { subscribeToWorkshopBuyCredits } from '../../config/workshop-buy-credits'
import { runWorkshopRouter } from '../../config/workshop-router-queue'
import { WorkshopRouterError } from '../../config/workshop-router-errors'
import { listWorkshopGenerations } from '../../config/workshop-generation-assets'
import { workshopContract } from '../../config/workshop-contract-catalog'
import { getAuthoredRouterWorkshopModelDetail as getRouterWorkshopModelDetail } from '../../config/workshop-router-content'
import {
  refreshWorkshopCredits,
  useWorkshopCredits
} from '../../config/workshop-credits'
import { useWorkshopSession } from '../../config/workshop-session-state'
import * as draftStorage from '../../config/workshop-draft-storage'
import {
  cancelWorkshopRun,
  workshopRunInFlight
} from '../../config/workshop-run-state'
import {
  captureWorkshopEvent,
  useWorkshopAuthFlag,
  useWorkshopEnabled,
  useWorkshopEnabledSettled
} from '../../scripts/posthog'
import ModelDetail from './ModelDetail.vue'
import WorkshopGate from './WorkshopGate.vue'
import { workshopHealthLog } from '../../scripts/workshop-health'

vi.mock(import('../../config/workshop-session-state'))
vi.mock(import('../../scripts/posthog'))

vi.mock(import('../../config/workshop-router-queue'), { spy: true })

vi.mock(import('../../config/workshop-generation-assets'), { spy: true })

vi.mock(import('../../config/workshop-output-download'), () => ({
  downloadOutput: vi.fn().mockResolvedValue(true)
}))

vi.mock(import('../../config/workshop-credits'))

const auth = {
  session: ref<AccountCredential>(),
  settled: ref(true),
  enabled: ref(true),
  workshopEnabled: ref(true),
  workshopEnabledSettled: ref(true)
}
const credits = {
  balance: ref<ReturnType<typeof useWorkshopCredits>['balance']['value']>({
    status: 'unknown'
  })
}

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

function captureBuyCreditsRequest() {
  const requested = vi.fn()
  const stop = subscribeToWorkshopBuyCredits(requested)
  onTestFinished(stop)
  return requested
}

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
  requestId: 'request-123',
  deadlineCollections: 0
}

function mountDetail(options?: {
  clone?: { href: string }
  details?: () => ReturnType<typeof h>
  model?: WorkshopModelDetail
  locale?: Locale
}) {
  return render(
    defineComponent({
      setup() {
        return () =>
          h(
            ModelDetail,
            {
              model: options?.model ?? model,
              clone: options?.clone,
              locale: options?.locale
            },
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
    vi.mocked(useWorkshopEnabled).mockReturnValue(
      computed(() => auth.workshopEnabled.value)
    )
    vi.mocked(useWorkshopEnabledSettled).mockReturnValue(
      computed(() => auth.workshopEnabledSettled.value)
    )
    vi.mocked(useWorkshopAuthFlag).mockReturnValue(
      computed(() => auth.enabled.value)
    )
    const session = useWorkshopSession()
    session.session = computed(() => auth.session.value)
    session.settled = computed(() => auth.settled.value)
    const balance = useWorkshopCredits()
    balance.balance = computed(() => credits.balance.value)
    balance.session = session.session
    auth.session.value = undefined
    auth.settled.value = true
    auth.enabled.value = true
    auth.workshopEnabled.value = true
    auth.workshopEnabledSettled.value = true
    credits.balance.value = { status: 'unknown' }
    localStorage.clear()
    sessionStorage.clear()
    vi.useFakeTimers()
    vi.stubEnv('PUBLIC_WORKSHOP_ROUTER_RUN', '1')
    vi.mocked(runWorkshopRouter).mockReset()
    vi.mocked(session.ensureFresh).mockResolvedValue({
      status: 'ok',
      session: credential
    })
    vi.mocked(session.remint).mockResolvedValue({
      status: 'ok',
      session: credential
    })
  })

  it('enables durable saving and lets navigation detach without asking to cancel', async () => {
    vi.stubEnv('PUBLIC_WORKSHOP_SAVE_ASSETS', '1')
    auth.session.value = credential
    vi.mocked(listWorkshopGenerations).mockResolvedValue({ requests: [] })
    vi.mocked(runWorkshopRouter).mockReturnValue(
      Promise.withResolvers<typeof routerResult>().promise
    )
    const { unmount } = mountDetail({ model: runnable })
    await user().type(screen.getByTestId('field-prompt'), 'A teapot')
    await user().click(screen.getByTestId('run-button'))
    await vi.waitFor(() => expect(runWorkshopRouter).toHaveBeenCalledOnce())
    const run = vi.mocked(runWorkshopRouter).mock.calls[0][0]
    expect(run.comfy_save_asset).toBe(true)
    expect(workshopRunInFlight.value).toBe(false)
    expect(
      window.dispatchEvent(new Event('beforeunload', { cancelable: true }))
    ).toBe(true)
    unmount()
    expect(run.signal.aborted).toBe(true)
    expect(run.signal.reason.message).not.toBe('Generation cancelled by user')
  })

  it('aborts the old history read and discards its result after a workspace switch', async () => {
    vi.stubEnv('PUBLIC_WORKSHOP_SAVE_ASSETS', '1')
    auth.session.value = credential
    const oldPage =
      Promise.withResolvers<
        Awaited<ReturnType<typeof listWorkshopGenerations>>
      >()
    vi.mocked(listWorkshopGenerations)
      .mockReturnValueOnce(oldPage.promise)
      .mockResolvedValue({ requests: [] })
    mountDetail({ model: runnable })
    await vi.waitFor(() =>
      expect(listWorkshopGenerations).toHaveBeenCalledOnce()
    )
    const oldSignal = vi.mocked(listWorkshopGenerations).mock.calls[0][1]
    auth.session.value = {
      ...credential,
      workspace: { ...credential.workspace, id: 'workspace-2' }
    }
    vi.mocked(useWorkshopSession().ensureFresh).mockResolvedValue({
      status: 'ok',
      session: auth.session.value
    })
    await nextTick()
    expect(oldSignal.aborted).toBe(true)
    oldPage.resolve({
      requests: [
        {
          request_id: '18655193-3f73-4abf-b49c-1c6a058355bc',
          provider: 'private-old-provider',
          model: 'old-model',
          created_at: '2026-09-20T12:00:00Z',
          status: 'COMPLETED',
          asset_save_status: 'failed',
          asset_outputs: []
        }
      ]
    })
    await vi.waitFor(() =>
      expect(listWorkshopGenerations).toHaveBeenCalledTimes(2)
    )
    expect(screen.queryByText('private-old-provider/old-model')).toBeNull()
  })

  it('links a documented provider in a new tab', () => {
    mountDetail({
      model: {
        ...model,
        provider: 'Black Forest Labs',
        routerId: 'bfl/flux'
      }
    })

    const link = screen.getByTestId('model-docs-link')
    expect(link.getAttribute('href')).toBe(
      'https://docs.comfy.org/development/comfy-router/models#black-forest-labs'
    )
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('does not offer a generic docs link for an undocumented provider', () => {
    mountDetail()
    expect(screen.queryByTestId('model-docs-link')).toBeNull()
  })

  it.for(['json', 'example'])(
    'keeps the schema stable while a media draft is restoring: %s',
    async (action) => {
      vi.stubGlobal('indexedDB', new IDBFactory())
      const read = Promise.withResolvers<unknown>()
      vi.spyOn(draftStorage, 'readWorkshopDraft').mockReturnValueOnce(
        read.promise
      )
      const mediaModel: WorkshopModelDetail = {
        ...uncuratedRunnable,
        fields: [
          prompt,
          {
            kind: 'file',
            name: 'image',
            label: 'Image',
            accept: 'image',
            required: true
          }
        ],
        defaults: { prompt: 'Current form' },
        examples: [
          {
            ...model.examples[0],
            fields: undefined,
            values: { prompt: 'Different example' }
          }
        ]
      }
      sessionStorage.setItem(
        `comfy-workshop-form:${mediaModel.slug}`,
        JSON.stringify({ prompt: 'Current form' })
      )
      sessionStorage.setItem(
        `comfy-workshop-form:${mediaModel.slug}:media`,
        'pending'
      )
      mountDetail({ model: mediaModel })
      await nextTick()
      if (action === 'json') {
        const toggle = screen.getByRole('button', { name: 'Native JSON' })
        expect(toggle).toHaveProperty('disabled', true)
        await user().click(toggle)
      } else {
        await user().click(
          screen.getByRole('button', { name: /Open in Playground$/ })
        )
      }
      expect(screen.getByRole('textbox', { name: 'Prompt' })).toHaveProperty(
        'value',
        'Current form'
      )
      read.resolve({ image: 'https://example.com/saved.webp' })
      await vi.waitFor(() =>
        expect(
          screen.getByRole('button', { name: 'Native JSON' })
        ).toHaveProperty('disabled', false)
      )
      expect(screen.getByRole('img', { name: 'saved.webp' })).toBeTruthy()
    }
  )

  // The endpoint action on a workflow page is a link to #api in another
  // island, so the address bar is the only thing the two share.
  describe('the API panel asked for through the address bar', () => {
    const goTo = (hash: string) =>
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${hash}`
      )

    const selected = (name: string) =>
      screen.getByRole('tab', { name }).getAttribute('aria-selected')

    it('opens on a link followed into the page, once mounted', async () => {
      goTo('#api')
      mountDetail({ model: runnable })
      await nextTick()

      expect(selected('API')).toBe('true')
      expect(selected('Playground')).toBe('false')
    })

    // Holding the fragment after the reader leaves would make the next
    // request the address already satisfies, and the link would do nothing.
    it('lets a reader ask for it again after going back to the playground', async () => {
      goTo('#api')
      mountDetail({ model: runnable })
      await nextTick()
      const visitor = user()

      await visitor.click(screen.getByRole('tab', { name: 'Playground' }))
      expect(window.location.hash).toBe('')

      goTo('#api')
      window.dispatchEvent(new HashChangeEvent('hashchange'))
      await nextTick()

      expect(selected('API')).toBe('true')
    })
  })

  it('prevents generation while the feature is hidden', async () => {
    auth.session.value = credential
    auth.workshopEnabled.value = false
    mountDetail({ model: runnable })
    await nextTick()
    expect(screen.queryByRole('button', { name: 'Run' })).toBeNull()
    expect(runWorkshopRouter).not.toHaveBeenCalled()
    expect(captureWorkshopEvent).not.toHaveBeenCalled()
  })

  it('reports API views only while Models is enabled', async () => {
    auth.workshopEnabled.value = false
    mountDetail({ model: runnable })
    const visitor = user()
    await visitor.click(screen.getByRole('tab', { name: 'API' }))
    expect(captureWorkshopEvent).not.toHaveBeenCalled()
    auth.workshopEnabled.value = true
    await nextTick()
    expect(captureWorkshopEvent).toHaveBeenCalledWith({
      name: 'api_viewed',
      properties: expect.objectContaining({ model_slug: runnable.slug })
    })
    vi.mocked(captureWorkshopEvent).mockClear()
    auth.workshopEnabled.value = false
    await nextTick()
    await visitor.click(screen.getByRole('tab', { name: 'Playground' }))
    await visitor.click(screen.getByRole('tab', { name: 'API' }))
    expect(captureWorkshopEvent).not.toHaveBeenCalled()
  })

  it.for(['load', 'error'] as const)(
    'correlates an HTTP success with the primary image %s outcome',
    async (event) => {
      auth.session.value = credential
      vi.mocked(runWorkshopRouter).mockResolvedValue(routerResult)
      mountDetail({ model: runnable })
      const visitor = user()
      await visitor.type(
        screen.getByRole('textbox', { name: 'Prompt' }),
        'A landscape'
      )
      await visitor.click(await screen.findByRole('button', { name: 'Run' }))
      const image = await screen.findByRole('img', { name: 'Output' })
      expect(captureWorkshopEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({ name: 'delivery_finished' })
      )
      await fireEvent(image, new Event(event))
      const started = vi
        .mocked(captureWorkshopEvent)
        .mock.calls.map(([event]) => event)
        .find((event) => event.name === 'run_started')
      assert.exists(started)
      expect(started.properties.attempt_id).toEqual(expect.any(String))
      expect(captureWorkshopEvent).toHaveBeenCalledWith({
        name: 'delivery_finished',
        properties: expect.objectContaining({
          attempt_id: started.properties.attempt_id,
          request_id: routerResult.requestId,
          status: event === 'load' ? 'succeeded' : 'failed'
        })
      })
    }
  )

  it('tracks the render funnel and actions without sending inputs or output contents', async () => {
    auth.session.value = credential
    vi.mocked(runWorkshopRouter).mockResolvedValue(routerResult)
    mountDetail({ model: runnable })
    const visitor = user()
    await visitor.type(
      screen.getByRole('textbox', { name: 'Prompt' }),
      'Private prompt'
    )
    await visitor.click(screen.getByRole('button', { name: 'Run' }))
    await fireEvent.load(await screen.findByRole('img', { name: 'Output' }))
    const download = await screen.findByTestId('output-download')
    download.addEventListener('click', (event) => event.preventDefault(), {
      once: true
    })
    await visitor.click(download)
    await visitor.click(screen.getByRole('tab', { name: 'API' }))

    const events = vi
      .mocked(captureWorkshopEvent)
      .mock.calls.map(([event]) => event)
    expect(events.map((event) => event.name)).toEqual([
      'model_viewed',
      'run_started',
      'run_finished',
      'delivery_finished',
      'output_download_clicked',
      'api_viewed'
    ])
    const metadata = {
      model_slug: runnable.slug,
      router_id: runnable.routerId,
      provider: 'Demo',
      modality: 'image'
    }
    const started = events.find((event) => event.name === 'run_started')
    expect(started).toEqual({
      name: 'run_started',
      properties: {
        ...metadata,
        attempt_id: expect.any(String),
        user_id: credential.uid,
        workspace_id: credential.workspace.id
      }
    })
    expect(events.find((event) => event.name === 'run_finished')).toEqual({
      name: 'run_finished',
      properties: {
        ...started?.properties,
        status: 'succeeded',
        duration_ms: expect.any(Number),
        request_id: routerResult.requestId,
        output_count: 1
      }
    })
    expect(events.find((event) => event.name === 'delivery_finished')).toEqual({
      name: 'delivery_finished',
      properties: {
        ...started?.properties,
        status: 'succeeded',
        duration_ms: expect.any(Number),
        request_id: routerResult.requestId,
        output_kind: 'image'
      }
    })
    expect(
      events.find((event) => event.name === 'output_download_clicked')
    ).toEqual({
      name: 'output_download_clicked',
      properties: { ...metadata, output_kind: 'image' }
    })
    expect(JSON.stringify(events)).not.toContain('Private prompt')
    expect(JSON.stringify(events)).not.toContain(credential.token)
    expect(JSON.stringify(events)).not.toContain(routerResult.outputs[0].url)
  })

  it.for([
    {
      name: 'leaving the Playground',
      result: routerResult,
      abandon: () => user().click(screen.getByRole('tab', { name: 'API' }))
    },
    {
      name: 'replacing the result with an example',
      result: routerResult,
      abandon: () => user().click(screen.getByTestId('example-card'))
    },
    {
      name: 'viewing another file of the same run',
      result: {
        ...routerResult,
        outputs: [
          ...routerResult.outputs,
          {
            kind: 'text' as const,
            url: 'blob:transcript',
            fileName: 'transcript.txt',
            text: 'A transcript'
          }
        ]
      },
      abandon: () =>
        user().click(screen.getByRole('button', { name: 'Raw response' }))
    }
  ])('excludes delivery after $name', async ({ result, abandon }) => {
    auth.session.value = credential
    vi.mocked(runWorkshopRouter).mockResolvedValue(result)
    mountDetail({
      model: {
        ...runnable,
        defaults: { prompt: 'A landscape' },
        examples: [{ ...model.examples[0], sampleOnly: true }]
      }
    })
    await user().click(await screen.findByRole('button', { name: 'Run' }))
    await screen.findByRole('img', { name: 'Output' })

    await abandon()
    await vi.advanceTimersByTimeAsync(120_000)

    const deliveries = vi
      .mocked(captureWorkshopEvent)
      .mock.calls.map(([event]) => event)
      .filter((event) => event.name === 'delivery_finished')
    expect(deliveries).toEqual([
      {
        name: 'delivery_finished',
        properties: expect.objectContaining({
          request_id: routerResult.requestId,
          status: 'cancelled'
        })
      }
    ])
  })

  it('excludes delivery when a response arrives after leaving the Playground', async () => {
    auth.session.value = credential
    const response = Promise.withResolvers<typeof routerResult>()
    vi.mocked(runWorkshopRouter).mockReturnValue(response.promise)
    mountDetail({ model: { ...runnable, defaults: { prompt: 'A landscape' } } })
    await user().click(await screen.findByRole('button', { name: 'Run' }))
    await vi.waitFor(() => expect(runWorkshopRouter).toHaveBeenCalledOnce())
    await user().click(screen.getByRole('tab', { name: 'API' }))

    response.resolve(routerResult)
    await vi.waitFor(() =>
      expect(captureWorkshopEvent).toHaveBeenCalledWith({
        name: 'run_finished',
        properties: expect.objectContaining({ status: 'succeeded' })
      })
    )
    await vi.advanceTimersByTimeAsync(120_000)

    const deliveries = vi
      .mocked(captureWorkshopEvent)
      .mock.calls.map(([event]) => event)
      .filter((event) => event.name === 'delivery_finished')
    expect(deliveries).toEqual([
      {
        name: 'delivery_finished',
        properties: expect.objectContaining({
          request_id: routerResult.requestId,
          status: 'cancelled'
        })
      }
    ])
  })

  it('reports a failed attempt with a bounded reason and no error payload', async () => {
    auth.session.value = credential
    vi.mocked(runWorkshopRouter).mockRejectedValue(
      new WorkshopRouterError(
        'provider',
        'request-failed',
        {},
        {
          status: 503,
          errorType: 'provider_timeout',
          retryAfter: null,
          concurrencyLimit: null,
          concurrencyCurrent: null,
          concurrencyRemaining: null,
          body: 'Private provider response'
        },
        'response'
      )
    )
    mountDetail({ model: runnable })
    const visitor = user()
    await visitor.type(
      screen.getByRole('textbox', { name: 'Prompt' }),
      'Private prompt'
    )
    await visitor.click(screen.getByRole('button', { name: 'Run' }))
    await vi.waitFor(() =>
      expect(captureWorkshopEvent).toHaveBeenCalledWith({
        name: 'run_finished',
        properties: expect.objectContaining({
          status: 'failed',
          reason: 'provider',
          request_id: 'request-failed',
          http_status: 503,
          router_error_type: 'provider_timeout',
          failure_stage: 'response',
          workspace_id: credential.workspace.id
        })
      })
    )
    expect(
      JSON.stringify(vi.mocked(captureWorkshopEvent).mock.calls)
    ).not.toContain('Private prompt')
    expect(
      JSON.stringify(vi.mocked(captureWorkshopEvent).mock.calls)
    ).not.toContain('Private provider response')
  })

  it('reports empty output as a response-stage failure with its request ID', async () => {
    auth.session.value = credential
    vi.mocked(runWorkshopRouter).mockResolvedValue({
      ...routerResult,
      outputs: []
    })
    mountDetail({ model: runnable })
    const visitor = user()
    await visitor.type(
      screen.getByRole('textbox', { name: 'Prompt' }),
      'An image'
    )
    await visitor.click(screen.getByRole('button', { name: 'Run' }))

    await vi.waitFor(() =>
      expect(captureWorkshopEvent).toHaveBeenCalledWith({
        name: 'run_finished',
        properties: expect.objectContaining({
          status: 'failed',
          reason: 'response',
          failure_stage: 'response',
          request_id: routerResult.requestId
        })
      })
    )
    expect(screen.queryByTestId('output-download')).not.toBeInTheDocument()
  })

  it('captures unexpected client exceptions without the error message', async () => {
    auth.session.value = credential
    const cause = new TypeError('Private prompt and token=secret')
    cause.stack = `${cause.toString()}\n    at https://comfy.org/_website/run.abc.js:12:34`
    vi.mocked(runWorkshopRouter).mockRejectedValue(cause)
    mountDetail({ model: runnable })
    await user().type(
      screen.getByRole('textbox', { name: 'Prompt' }),
      'An image'
    )
    await user().click(screen.getByRole('button', { name: 'Run' }))

    await vi.waitFor(() =>
      expect(captureWorkshopEvent).toHaveBeenCalledWith({
        name: 'run_finished',
        properties: expect.objectContaining({
          status: 'failed',
          reason: 'client',
          exception_name: 'TypeError',
          exception_frames: ['/_website/run.abc.js:12:34']
        })
      })
    )
    expect(
      JSON.stringify(vi.mocked(captureWorkshopEvent).mock.calls)
    ).not.toContain('Private prompt')
    expect(
      JSON.stringify(vi.mocked(captureWorkshopEvent).mock.calls)
    ).not.toContain('token=secret')
  })

  it('asks for an unreadable image to be reselected and then runs successfully', async () => {
    auth.session.value = credential
    const fetch = vi.fn<typeof globalThis.fetch>()
    vi.stubGlobal('fetch', fetch)
    const model = getRouterWorkshopModelDetail(
      'vertexai--gemini-nano-banana-2--edit-images'
    )
    if (!model) throw new Error('Missing Nano Banana model')
    mountDetail({
      model: { ...model, examples: [], defaults: { prompt: 'Edit this image' } }
    })
    await nextTick()
    const sources = within(screen.getByRole('group', { name: 'Source images' }))
    for (const remove of sources.queryAllByRole('button', { name: /^Remove / }))
      await user().click(remove)
    const file = new File(['pixels'], 'private.png', { type: 'image/png' })
    vi.spyOn(file, 'arrayBuffer').mockRejectedValue(
      new DOMException('Private file detail', 'NotReadableError')
    )
    const input = screen.getByLabelText('Source images', {
      selector: 'input[type="file"]'
    })
    await user().upload(input, file)
    await user().click(screen.getByTestId('run-button'))

    await vi.waitFor(() =>
      expect(input).toHaveAttribute('aria-invalid', 'true')
    )
    expect(screen.getByTestId('error-images')).toHaveTextContent(
      'This file can no longer be read. Select it again.'
    )
    expect(screen.getByTestId('playground-output')).toHaveTextContent(
      'The model has not run.'
    )
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    expect(runWorkshopRouter).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    expect(captureWorkshopEvent).toHaveBeenCalledWith({
      name: 'run_finished',
      properties: expect.objectContaining({
        status: 'failed',
        reason: 'client',
        failure_stage: 'file_read',
        exception_name: 'NotReadableError',
        field_error_codes: ['fileUnreadable']
      })
    })

    await user().click(
      screen.getByRole('button', { name: 'Remove private.png' })
    )
    await user().upload(
      input,
      new File(['pixels'], 'private.png', { type: 'image/png' })
    )
    expect(input).toHaveAttribute('aria-invalid', 'false')
    vi.mocked(runWorkshopRouter).mockResolvedValue(routerResult)
    await user().click(screen.getByTestId('run-button'))
    await screen.findByTestId('output-download')
    expect(runWorkshopRouter).toHaveBeenCalledOnce()
    expect(
      JSON.stringify(vi.mocked(captureWorkshopEvent).mock.calls)
    ).not.toContain('private.png')
  })

  it('omits an unrecognized Router error header from analytics', async () => {
    auth.session.value = credential
    vi.mocked(runWorkshopRouter).mockRejectedValue(
      new WorkshopRouterError(
        'provider',
        'request-private-header',
        {},
        {
          status: 503,
          errorType: 'customer_account_suspended',
          retryAfter: null,
          concurrencyLimit: null,
          concurrencyCurrent: null,
          concurrencyRemaining: null,
          body: 'Private provider response'
        }
      )
    )
    mountDetail({ model: runnable })
    const visitor = user()
    await visitor.type(
      screen.getByRole('textbox', { name: 'Prompt' }),
      'Private prompt'
    )
    await visitor.click(screen.getByRole('button', { name: 'Run' }))

    await vi.waitFor(() =>
      expect(captureWorkshopEvent).toHaveBeenCalledWith({
        name: 'run_finished',
        properties: expect.objectContaining({
          status: 'failed',
          reason: 'provider',
          http_status: 503
        })
      })
    )
    const calls = JSON.stringify(vi.mocked(captureWorkshopEvent).mock.calls)
    expect(calls).not.toContain('customer_account_suspended')
    expect(calls).not.toContain('Private provider response')
    expect(calls).not.toContain('Private prompt')
  })

  it.for([
    {
      slug: 'vertexai--gemini-3-pro-image--edit-images',
      label: 'Source images',
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
      const trigger = form.getByRole('button', { name: `Expand ${file}` })
      const player = within(trigger).getByTestId('video-source-thumbnail')
      expect(player.getAttribute('src')).toContain(`/input/${file}`)
      expect(
        form.getAllByRole('group').some(
          (group) =>
            within(group).queryByRole('button', {
              name: `Expand ${file}`
            }) === trigger
        )
      ).toBe(true)
      expect(runWorkshopRouter).not.toHaveBeenCalled()
      if (slug === 'bria--replace-video-background--edit-videos')
        expect(
          form
            .getByRole('img', { name: 'gothic_hall_light_rays.png' })
            .getAttribute('src')
        ).toContain('/input/gothic_hall_light_rays.png')
    }
  )

  it('reuses uploaded URLs and the retry key after a request whose outcome is unknown', async () => {
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
      new WorkshopRouterError('network')
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
    ).toBe('idle')
  })

  it.for([
    {
      signedIn: false,
      reason: 'missing-input-schema',
      explanation: /cannot be run or called from code/
    },
    {
      signedIn: true,
      reason: 'missing-input-schema',
      explanation: /cannot be run or called from code/
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
      expect(vi.mocked(useWorkshopSession().ensureFresh)).not.toHaveBeenCalled()
      expect(screen.queryByRole('button', { name: 'Native JSON' })).toBeNull()
    }
  )

  it('runs the real Router adapter with edited Advanced values and a fresh workspace session', async () => {
    auth.session.value = credential
    vi.mocked(useWorkshopSession().ensureFresh).mockResolvedValue({
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
    expect(vi.mocked(useWorkshopSession().ensureFresh)).toHaveBeenCalled()
    expect(screen.getByTestId('router-request-id').textContent).toContain(
      'request-123'
    )
    expect(screen.getByTestId('output-expires').textContent).toContain(
      'expire 24 hours'
    )
    const copyRequestId = screen.getByRole('button', {
      name: 'Copy request ID'
    })
    await user().click(copyRequestId)
    await vi.waitFor(() =>
      expect(copyRequestId.textContent).toContain('Copied')
    )
    expect(refreshWorkshopCredits).toHaveBeenCalledWith({ force: true })
  })

  it('opens the shared credits dialog after insufficient balance without losing the prompt', async () => {
    const requested = captureBuyCreditsRequest()
    auth.session.value = credential
    vi.mocked(runWorkshopRouter).mockRejectedValue(
      new WorkshopRouterError('noCredits')
    )
    mountDetail({ model: runnable })
    await user().type(screen.getByTestId('field-prompt'), 'A red teapot')
    await user().click(screen.getByTestId('run-button'))
    await vi.waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add credits' })).toBeDefined()
    )
    expect(screen.getByTestId('field-prompt')).toHaveProperty(
      'value',
      'A red teapot'
    )
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    expect(runWorkshopRouter).toHaveBeenCalledTimes(1)
    await user().click(screen.getByRole('button', { name: 'Add credits' }))
    expect(requested).toHaveBeenCalledOnce()
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

    const buy = screen.getByRole('button', { name: /Add credits/ })
    expect(buy.getAttribute('data-gate')).toBe('noCredits')
    expect(screen.getByTestId('gate-note').textContent).toContain('Personal')
    expect(screen.queryByRole('button', { name: 'Run' })).toBeNull()
    expect(runWorkshopRouter).not.toHaveBeenCalled()

    credits.balance.value = { status: 'ok', credits: 100 }
    await nextTick()
    expect(screen.getByRole('button', { name: 'Run' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Add credits/ })).toBeNull()
    expect(screen.getByRole('textbox', { name: /Prompt/ })).toHaveProperty(
      'value',
      'A red teapot'
    )
  })

  it('opens the amount picker from the gate', async () => {
    const requested = captureBuyCreditsRequest()
    auth.session.value = credential
    credits.balance.value = { status: 'ok', credits: 0 }
    mountDetail({ model: runnable })
    await nextTick()

    expect(screen.queryByTestId('buy-credits-dialog')).toBeNull()
    await user().click(screen.getByRole('button', { name: /Add credits/ }))

    expect(requested).toHaveBeenCalledOnce()
  })

  it.for(['unknown', 'error'] as const)(
    'does not mistake an %s balance for zero credits',
    async (status) => {
      auth.session.value = credential
      credits.balance.value = { status }
      mountDetail({ model: runnable })
      await nextTick()
      expect(screen.getByRole('button', { name: 'Run' })).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'Add credits' })).toBeNull()
    }
  )

  it('does not put the page-load estimate on the live Run button', async () => {
    auth.session.value = credential
    credits.balance.value = { status: 'ok', credits: 100 }
    mountDetail({ model: runnable })
    await nextTick()

    expect(screen.getByTestId('run-button').getAttribute('data-gate')).toBe(
      'ready'
    )
    expect(screen.getByTestId('run-button').textContent.trim()).toBe('Run')
    expect(screen.queryByTestId('run-price')).toBeNull()
  })

  it('offers a personal-workspace switch instead of billing to a member with no credits', async () => {
    auth.session.value = {
      ...credential,
      role: 'member',
      workspace: { id: 'team-1', name: 'Studio', type: 'team' }
    }
    credits.balance.value = { status: 'ok', credits: 0 }
    vi.mocked(useWorkshopSession().remint).mockImplementation(async () => {
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
    expect(screen.getByTestId('gate-note').textContent).toContain(
      'Not enough credits'
    )
    expect(screen.getByText(/Studio has used all its credits/)).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Buy credits' })).toBeNull()
    await visitor.click(
      screen.getByRole('button', { name: 'Switch to personal workspace' })
    )
    expect(vi.mocked(useWorkshopSession().remint)).toHaveBeenCalledWith(
      undefined,
      {
        preserveCredentialOnTransientFailure: true
      }
    )
    expect(screen.getByRole('button', { name: 'Run' })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: /Prompt/ })).toHaveProperty(
      'value',
      'Keep me'
    )
    expect(runWorkshopRouter).not.toHaveBeenCalled()
  })

  it('keeps the team session and surfaces a failed personal-workspace switch', async () => {
    auth.session.value = {
      ...credential,
      role: 'member',
      workspace: { id: 'team-1', name: 'Studio', type: 'team' }
    }
    credits.balance.value = { status: 'ok', credits: 0 }
    vi.mocked(useWorkshopSession().remint).mockResolvedValue({
      status: 'error',
      code: 'TOKEN_EXCHANGE_FAILED'
    })
    mountDetail({ model: runnable })
    await nextTick()

    await user().click(
      screen.getByRole('button', { name: 'Switch to personal workspace' })
    )

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not switch workspaces'
    )
    expect(auth.session.value.workspace.id).toBe('team-1')
  })

  it('does not offer an owner-only purchase after a member receives an insufficient-credit response', async () => {
    auth.session.value = { ...credential, role: 'member' }
    vi.mocked(useWorkshopSession().ensureFresh).mockResolvedValue({
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
    expect(screen.queryByRole('button', { name: 'Add credits' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('does not suggest buying credits to enable an unavailable model', () => {
    auth.session.value = credential
    credits.balance.value = { status: 'ok', credits: 0 }
    mountDetail()
    expect(screen.getByTestId('run-button').hasAttribute('disabled')).toBe(true)
    expect(screen.queryByRole('button', { name: 'Add credits' })).toBeNull()
  })

  it('starts a new generation, not the cancelled one, when an unchanged run follows a cancel', async () => {
    auth.session.value = credential
    const pending = Promise.withResolvers<typeof routerResult>()
    vi.mocked(runWorkshopRouter).mockReturnValue(pending.promise)
    mountDetail({ model: runnable })
    const visitor = user()
    await visitor.type(screen.getByTestId('field-prompt'), 'A teapot')
    await visitor.click(screen.getByTestId('run-button'))
    await vi.waitFor(() => expect(runWorkshopRouter).toHaveBeenCalledTimes(1))
    await visitor.click(screen.getByTestId('run-button'))
    await visitor.click(screen.getByTestId('run-button'))
    await vi.waitFor(() => expect(runWorkshopRouter).toHaveBeenCalledTimes(2))
    const [cancelled, next] = vi
      .mocked(runWorkshopRouter)
      .mock.calls.map(([options]) => options.idempotencyKey)
    expect(next).not.toBe(cancelled)
    pending.resolve(routerResult)
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
    expect(screen.getByRole('button', { name: /Add credits/ })).toBeTruthy()
    pending.resolve(routerResult)
    await vi.waitFor(() => expect(refreshWorkshopCredits).toHaveBeenCalled())
  })

  it('asks before native or Astro navigation during a run, and only then', async () => {
    auth.session.value = credential
    const pending = Promise.withResolvers<typeof routerResult>()
    vi.mocked(runWorkshopRouter).mockReturnValue(pending.promise)
    mountDetail({ model: runnable })

    const leaving = () =>
      window.dispatchEvent(new Event('beforeunload', { cancelable: true }))
    const softLeaving = () =>
      document.dispatchEvent(
        new Event('astro:before-preparation', { cancelable: true })
      )
    expect(leaving()).toBe(true)
    expect(softLeaving()).toBe(true)

    await user().type(
      screen.getByRole('textbox', { name: 'Prompt' }),
      'A teapot'
    )
    await user().click(screen.getByRole('button', { name: 'Run' }))
    await vi.waitFor(() => expect(runWorkshopRouter).toHaveBeenCalledTimes(1))
    expect(leaving()).toBe(false)
    expect(softLeaving()).toBe(false)

    pending.resolve(routerResult)
    await vi.waitFor(() =>
      expect(
        screen.getByTestId('playground-output').getAttribute('data-state')
      ).toBe('succeeded')
    )
    expect(leaving()).toBe(true)
    expect(softLeaving()).toBe(true)
  })

  // The header is outside this island, so the only thing it can act on is what
  // the run reports: that one is going, and how to end it.
  it('hands the rest of the page a way to end the run while one is going', async () => {
    auth.session.value = credential
    const pending = Promise.withResolvers<typeof routerResult>()
    vi.mocked(runWorkshopRouter).mockReturnValue(pending.promise)
    mountDetail({ model: runnable })
    expect(workshopRunInFlight.value).toBe(false)

    await user().type(screen.getByTestId('field-prompt'), 'A teapot')
    await user().click(screen.getByTestId('run-button'))
    await vi.waitFor(() => expect(workshopRunInFlight.value).toBe(true))

    cancelWorkshopRun()
    await vi.waitFor(() =>
      expect(
        screen.getByTestId('playground-output').getAttribute('data-state')
      ).toBe('cancelled')
    )
    expect(workshopRunInFlight.value).toBe(false)
  })

  it('takes that way back when the playground goes away mid-run', async () => {
    auth.session.value = credential
    vi.mocked(runWorkshopRouter).mockReturnValue(
      Promise.withResolvers<typeof routerResult>().promise
    )
    const { unmount } = mountDetail({ model: runnable })

    await user().type(screen.getByTestId('field-prompt'), 'A teapot')
    await user().click(screen.getByTestId('run-button'))
    await vi.waitFor(() => expect(workshopRunInFlight.value).toBe(true))

    unmount()
    expect(workshopRunInFlight.value).toBe(false)
  })

  it('answers an in-site link in its own words, and lets the link go when told to', async () => {
    auth.session.value = credential
    const pending = Promise.withResolvers<typeof routerResult>()
    vi.mocked(runWorkshopRouter).mockReturnValue(pending.promise)
    const assign = vi.spyOn(location, 'assign').mockImplementation(() => {})
    const leaving = () =>
      window.dispatchEvent(new Event('beforeunload', { cancelable: true }))
    onTestFinished(() => assign.mockRestore())
    mountDetail({ model: runnable })

    const linkTo = (path: string) => {
      const link = document.createElement('a')
      link.href = `${location.origin}${path}`
      document.body.append(link)
      onTestFinished(() => link.remove())
      return () =>
        link.dispatchEvent(
          new MouseEvent('click', { bubbles: true, cancelable: true })
        )
    }

    expect(linkTo('/models/idle-model/')()).toBe(true)
    expect(screen.queryByTestId('run-leave-dialog')).toBeNull()

    await user().type(screen.getByTestId('field-prompt'), 'A teapot')
    await user().click(screen.getByTestId('run-button'))
    await vi.waitFor(() => expect(runWorkshopRouter).toHaveBeenCalledOnce())

    const follow = linkTo('/models/another-model/')
    expect(follow()).toBe(false)
    await screen.findByTestId('run-leave-dialog')
    expect(assign).not.toHaveBeenCalled()

    await user().click(screen.getByTestId('run-leave-stay'))
    await vi.waitFor(() =>
      expect(screen.queryByTestId('run-leave-dialog')).toBeNull()
    )
    expect(assign).not.toHaveBeenCalled()

    follow()
    await user().click(await screen.findByTestId('run-leave-confirm'))
    expect(assign).toHaveBeenCalledWith(
      `${location.origin}/models/another-model/`
    )
    expect(
      screen.getByTestId('playground-output').getAttribute('data-state')
    ).toBe('idle')
    expect(leaving()).toBe(true)
  })

  it('restores a declined history traversal without letting Astro unmount the run', async () => {
    history.replaceState({ index: 7 }, '', location.href)
    auth.session.value = credential
    const pending = Promise.withResolvers<typeof routerResult>()
    vi.mocked(runWorkshopRouter).mockReturnValue(pending.promise)
    const confirm = vi.fn().mockReturnValue(false)
    vi.stubGlobal('confirm', confirm)
    const go = vi.spyOn(history, 'go').mockImplementation(() => undefined)
    let astroPreparationCount = 0
    const prepare = () => {
      astroPreparationCount += 1
    }
    window.addEventListener('popstate', prepare)
    onTestFinished(() => {
      vi.unstubAllGlobals()
      go.mockRestore()
      window.removeEventListener('popstate', prepare)
    })
    mountDetail({ model: runnable })
    await user().type(screen.getByTestId('field-prompt'), 'A teapot')
    await user().click(screen.getByTestId('run-button'))
    await vi.waitFor(() => expect(runWorkshopRouter).toHaveBeenCalledOnce())

    window.dispatchEvent(new PopStateEvent('popstate', { state: { index: 6 } }))

    expect(confirm).toHaveBeenCalledOnce()
    expect(go).toHaveBeenCalledWith(1)
    expect(astroPreparationCount).toBe(0)

    window.dispatchEvent(new PopStateEvent('popstate', { state: { index: 7 } }))
    expect(confirm).toHaveBeenCalledOnce()
    expect(astroPreparationCount).toBe(0)
    expect(screen.getByTestId('run-button').textContent).toContain('Cancel')
  })

  it('tracks an approved same-page traversal before guarding the next one', async () => {
    history.replaceState({ index: 7 }, '', location.href)
    auth.session.value = credential
    const pending = Promise.withResolvers<typeof routerResult>()
    vi.mocked(runWorkshopRouter).mockReturnValue(pending.promise)
    const confirm = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false)
    vi.stubGlobal('confirm', confirm)
    const go = vi.spyOn(history, 'go').mockImplementation(() => undefined)
    let preparationWasAllowed = false
    const prepare = () => {
      const event = Object.assign(
        new Event('astro:before-preparation', { cancelable: true }),
        { navigationType: 'traverse' }
      )
      document.dispatchEvent(event)
      preparationWasAllowed = !event.defaultPrevented
    }
    window.addEventListener('popstate', prepare)
    onTestFinished(() => {
      vi.unstubAllGlobals()
      go.mockRestore()
      window.removeEventListener('popstate', prepare)
    })
    mountDetail({ model: runnable })
    await user().type(screen.getByTestId('field-prompt'), 'A teapot')
    await user().click(screen.getByTestId('run-button'))
    await vi.waitFor(() => expect(runWorkshopRouter).toHaveBeenCalledOnce())

    window.dispatchEvent(new PopStateEvent('popstate', { state: { index: 6 } }))

    expect(confirm).toHaveBeenCalledOnce()
    expect(preparationWasAllowed).toBe(true)

    window.dispatchEvent(new PopStateEvent('popstate', { state: { index: 5 } }))
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(go).toHaveBeenCalledWith(1)
  })

  it.for([
    ['network', true],
    ['provider', false]
  ] as const)(
    'after a %s failure an unchanged retry keeps its key: %s, and a run after success always gets a new key',
    async ([reason, keepsKey]) => {
      auth.session.value = credential
      vi.mocked(runWorkshopRouter)
        .mockRejectedValueOnce(new WorkshopRouterError(reason))
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
      const [first, retry] = vi
        .mocked(runWorkshopRouter)
        .mock.calls.map(([options]) => options.idempotencyKey)
      expect(retry === first).toBe(keepsKey)
      await user().click(screen.getByTestId('run-button'))
      await vi.waitFor(() => expect(runWorkshopRouter).toHaveBeenCalledTimes(3))
      expect(
        vi.mocked(runWorkshopRouter).mock.calls[2][0].idempotencyKey
      ).not.toBe(retry)
    }
  )

  it('does not submit with a missing required field', async () => {
    auth.session.value = credential
    mountDetail({ model: runnable })
    await nextTick()
    await user().click(screen.getByTestId('run-button'))
    expect(runWorkshopRouter).not.toHaveBeenCalled()
    expect(captureWorkshopEvent).toHaveBeenCalledWith({
      name: 'run_validation_failed',
      properties: expect.objectContaining({
        model_slug: runnable.slug,
        field_error_codes: ['required'],
        field_error_names: ['prompt']
      })
    })
    expect(
      vi
        .mocked(captureWorkshopEvent)
        .mock.calls.some(([event]) => event.name === 'run_started')
    ).toBe(false)
    expect(
      screen.getByTestId('playground-output').getAttribute('data-state')
    ).toBe('failed')
    expect(screen.getByTestId('run-error')).toHaveTextContent(
      'Check the highlighted fields.'
    )
    expect(screen.getByRole('textbox', { name: 'Prompt' })).toHaveAttribute(
      'aria-invalid',
      'true'
    )
    expect(screen.getByRole('textbox', { name: 'Prompt' })).toHaveAttribute(
      'aria-describedby',
      'error-prompt'
    )
    expect(screen.getByRole('alert')).toBeVisible()
  })

  it('explains an input rejection without pointing to fields that have no errors', async () => {
    auth.session.value = credential
    vi.mocked(runWorkshopRouter).mockRejectedValue(
      new WorkshopRouterError('validation', 'request-rejected')
    )
    mountDetail({ model: runnable })
    await user().type(
      screen.getByRole('textbox', { name: 'Prompt' }),
      'A teapot'
    )
    await user().click(screen.getByTestId('run-button'))

    expect(await screen.findByTestId('run-error')).toHaveTextContent(
      'The model rejected these inputs without identifying a field. Check the model’s input requirements or contact support with the request ID.'
    )
    expect(screen.getByRole('textbox', { name: 'Prompt' })).toHaveAttribute(
      'aria-invalid',
      'false'
    )
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByTestId('router-request-id')).toHaveTextContent(
      'request-rejected'
    )
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
    const outcomes = vi
      .mocked(captureWorkshopEvent)
      .mock.calls.map(([event]) => event)
      .filter((event) => event.name === 'run_finished')
    expect(outcomes).toEqual([
      {
        name: 'run_finished',
        properties: expect.objectContaining({
          status: 'cancelled',
          workspace_id: credential.workspace.id
        })
      }
    ])
  })

  it.for(['sign-out', 'workspace changed'] as const)(
    'does not publish a result after %s',
    async (change) => {
      auth.session.value = credential
      const late = Promise.withResolvers<typeof routerResult>()
      vi.mocked(runWorkshopRouter).mockReturnValue(late.promise)
      mountDetail({ model: runnable })
      const visitor = user()
      await visitor.type(
        screen.getByRole('textbox', { name: 'Prompt' }),
        'A teapot'
      )
      await visitor.click(screen.getByRole('button', { name: 'Run' }))
      await vi.waitFor(() => expect(runWorkshopRouter).toHaveBeenCalledTimes(1))
      if (change === 'sign-out') auth.session.value = undefined
      else
        auth.session.value = {
          ...credential,
          workspace: { ...credential.workspace, id: 'other-workspace' }
        }
      await nextTick()
      late.resolve(routerResult)
      await vi.waitFor(() => expect(refreshWorkshopCredits).toHaveBeenCalled())
      expect(
        screen.getByTestId('playground-output').getAttribute('data-state')
      ).toBe('idle')
      expect(screen.queryByTestId('router-request-id')).toBeNull()
      const outcomes = vi
        .mocked(captureWorkshopEvent)
        .mock.calls.map(([event]) => event)
        .filter((event) => event.name === 'run_finished')
      expect(outcomes).toEqual([])
    }
  )

  it.for([
    {
      case: 'a run that ended in a word keeps saying it',
      outcome: () =>
        vi
          .mocked(runWorkshopRouter)
          .mockRejectedValue(new WorkshopRouterError('provider')),
      ended: 'failed',
      after: 'failed'
    },
    {
      case: 'a picture leaves with the workspace it was made in',
      outcome: () =>
        vi.mocked(runWorkshopRouter).mockResolvedValue(routerResult),
      ended: 'succeeded',
      after: 'idle'
    }
  ])('after a workspace change, $case', async ({ outcome, ended, after }) => {
    auth.session.value = credential
    outcome()
    mountDetail({ model: runnable })
    await user().type(screen.getByTestId('field-prompt'), 'A teapot')
    await user().click(screen.getByTestId('run-button'))
    await vi.waitFor(() =>
      expect(
        screen.getByTestId('playground-output').getAttribute('data-state')
      ).toBe(ended)
    )
    auth.session.value = {
      ...credential,
      workspace: { ...credential.workspace, id: 'other-workspace' }
    }
    await nextTick()
    expect(
      screen.getByTestId('playground-output').getAttribute('data-state')
    ).toBe(after)
  })

  it('finishes an active render while the gate hides the page on revocation', async () => {
    auth.session.value = credential
    const late = Promise.withResolvers<typeof routerResult>()
    vi.mocked(runWorkshopRouter).mockReturnValue(late.promise)
    render(WorkshopGate, {
      props: { keepMounted: true },
      slots: { default: () => h(ModelDetail, { model: runnable }) }
    })
    await nextTick()
    await user().type(screen.getByTestId('field-prompt'), 'A teapot')
    await user().click(screen.getByTestId('run-button'))
    await vi.waitFor(() => expect(runWorkshopRouter).toHaveBeenCalledOnce())
    auth.workshopEnabled.value = false
    await nextTick()
    expect(screen.queryByRole('button', { name: 'Run' })).toBeNull()
    expect(
      screen.getByTestId('playground-output').getAttribute('data-state')
    ).toBe('running')
    expect(vi.mocked(runWorkshopRouter).mock.calls[0][0].signal.aborted).toBe(
      false
    )
    late.resolve(routerResult)
    await vi.waitFor(() =>
      expect(captureWorkshopEvent).toHaveBeenCalledWith({
        name: 'run_finished',
        properties: expect.objectContaining({ status: 'succeeded' })
      })
    )
    expect(captureWorkshopEvent).not.toHaveBeenCalledWith({
      name: 'run_finished',
      properties: expect.objectContaining({ status: 'cancelled' })
    })
    expect(screen.getByTestId('run-button').getAttribute('data-gate')).toBe(
      'unavailable'
    )
  })

  it.for([
    { name: 'superseded refresh', result: undefined },
    {
      name: 'failed token exchange',
      result: { status: 'error', code: 'TOKEN_EXCHANGE_FAILED' }
    },
    {
      name: 'different user',
      result: { status: 'ok', session: { ...credential, uid: 'user-other' } }
    },
    {
      name: 'different workspace',
      result: {
        status: 'ok',
        session: {
          ...credential,
          workspace: { ...credential.workspace, id: 'workspace-other' }
        }
      }
    }
  ] satisfies { name: string; result: SessionResult | undefined }[])(
    'excludes a $name from model outages without sending a generation',
    async ({ result }) => {
      auth.session.value = credential
      vi.mocked(useWorkshopSession().ensureFresh).mockResolvedValue(result)
      mountDetail({ model: runnable })
      await user().type(screen.getByTestId('field-prompt'), 'A teapot')
      await user().click(screen.getByTestId('run-button'))
      await vi.waitFor(() =>
        expect(
          screen.getByTestId('playground-output').getAttribute('data-state')
        ).toBe('failed')
      )
      expect(runWorkshopRouter).not.toHaveBeenCalled()
      expect(captureWorkshopEvent).toHaveBeenCalledWith({
        name: 'run_finished',
        properties: expect.objectContaining({
          status: 'failed',
          reason: 'unavailable',
          failure_stage: 'credential'
        })
      })
      const event = vi
        .mocked(captureWorkshopEvent)
        .mock.calls.map(([event]) => event)
        .find((event) => event.name === 'run_finished')
      assert(event)
      expect(workshopHealthLog(event)?.service_health).toBe('excluded')
    }
  )

  it('keeps execution disabled when the run opt-in is absent', () => {
    vi.stubEnv('PUBLIC_WORKSHOP_ROUTER_RUN', undefined)
    auth.session.value = credential
    mountDetail({ model: runnable })
    expect(
      screen.getByRole('button', {
        name: 'This model cannot be run from the browser yet.'
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
    'allows a signed-out visitor to select a local $kind upload while keeping Run gated',
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
      expect(input).toHaveProperty('disabled', false)
      expect(screen.getByRole('img', { name: 'example.png' })).toBeTruthy()
      await visitor.type(
        screen.getByRole('textbox', { name: /Prompt/ }),
        'My image idea'
      )
      await visitor.upload(input, file)
      expect(
        screen.getByRole('button', { name: 'Replace local.png' })
      ).toBeTruthy()
      expect(screen.getByRole('link', { name: 'Sign in to run' })).toBeTruthy()
      expect(runWorkshopRouter).not.toHaveBeenCalled()
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
          name: 'This model cannot be run from the browser yet.'
        })
      ).toHaveProperty('disabled', true)
    }
  )

  it('waits for session initialization before offering sign-in', async () => {
    auth.settled.value = false
    mountDetail({ model: runnable })
    expect(
      screen
        .getByRole('button', { name: 'Checking your session…' })
        .hasAttribute('disabled')
    ).toBe(true)
    expect(screen.queryByRole('link', { name: 'Sign in to run' })).toBeNull()
    auth.session.value = credential
    auth.settled.value = true
    await nextTick()
    expect(
      screen.getByRole('button', { name: 'Run' }).hasAttribute('disabled')
    ).toBe(false)
  })

  it('hides response metadata while retaining normal attachments in run history', async () => {
    auth.session.value = credential
    vi.mocked(runWorkshopRouter).mockResolvedValue({
      ...routerResult,
      outputs: [
        ...routerResult.outputs,
        {
          kind: 'text',
          url: 'blob:transcript',
          fileName: 'transcript.txt',
          text: 'A transcript'
        },
        {
          kind: 'text',
          purpose: 'response-metadata',
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
    await visitor.click(
      await screen.findByRole('button', { name: 'Raw response' })
    )
    expect(screen.getByText('A transcript')).toBeTruthy()
    expect(screen.queryByTitle('response.json')).toBeNull()

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
    await screen.findByTestId('earlier-runs')
    expect(
      within(screen.getByTestId('earlier-runs')).getAllByRole('button')
    ).toHaveLength(2)
    await visitor.click(screen.getByTestId('earlier-run-0'))
    await visitor.click(screen.getByRole('button', { name: 'Raw response' }))
    expect(screen.getByText('A transcript')).toBeTruthy()
    expect(screen.queryByTitle('response.json')).toBeNull()
  })

  it('evicts old blob outputs and attachments when the retained byte budget is reached', async () => {
    auth.session.value = credential
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    vi.mocked(runWorkshopRouter)
      .mockResolvedValueOnce({
        requestId: 'first',
        deadlineCollections: 0,
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
        deadlineCollections: 0,
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
    await screen.findByRole('button', { name: 'Run' })
    expect(revoke).not.toHaveBeenCalled()
    await visitor.click(screen.getByRole('button', { name: 'Run' }))
    await screen.findByRole('button', { name: 'Run' })
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
      'This model cannot be run from the browser yet'
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

  it('opens an example straight away when there is nothing to lose', async () => {
    await signedInDetail()
    await user().click(
      screen.getByRole('button', { name: /Open in Playground$/ })
    )
    expect(screen.queryByTestId('example-replace-dialog')).toBeNull()
    expect(screen.getByTestId<HTMLTextAreaElement>('field-prompt').value).toBe(
      'a capybara'
    )
  })

  it.for([
    ['keeps', 'example-replace-keep', 'my own words'],
    ['replaces', 'example-replace-confirm', 'a capybara']
  ] as const)(
    'asks before an example overwrites what was typed, and then %s it',
    async ([, answer, expected]) => {
      await signedInDetail()
      const prompt = screen.getByTestId('field-prompt')
      await user().clear(prompt)
      await user().type(prompt, 'my own words')

      await user().click(
        screen.getByRole('button', { name: /Open in Playground$/ })
      )

      expect(screen.getByTestId('example-replace-dialog')).toBeTruthy()
      expect(
        screen.getByTestId<HTMLTextAreaElement>('field-prompt').value
      ).toBe('my own words')

      await user().click(screen.getByTestId(answer))

      expect(screen.queryByTestId('example-replace-dialog')).toBeNull()
      expect(
        screen.getByTestId<HTMLTextAreaElement>('field-prompt').value
      ).toBe(expected)
    }
  )

  it('asks in the reader locale before it overwrites', async () => {
    auth.session.value = credential
    mountDetail({ locale: 'zh-CN' })
    await nextTick()
    const prompt = screen.getByTestId('field-prompt')
    await user().clear(prompt)
    await user().type(prompt, '我写的')

    await user().click(
      screen.getByRole('button', { name: /在 Playground 中打开$/ })
    )

    expect(screen.getByTestId('example-replace-dialog').textContent).toContain(
      '要替换你的输入吗？'
    )
    expect(screen.getByTestId('example-replace-confirm').textContent).toContain(
      '使用该示例'
    )
  })

  it('asks for a draft restored after a sign-in, not only for fresh typing', async () => {
    sessionStorage.setItem(
      `comfy-workshop-form:${model.slug}`,
      JSON.stringify({ prompt: 'what I wrote before signing in' })
    )
    auth.session.value = credential
    mountDetail()
    await nextTick()
    expect(screen.getByTestId<HTMLTextAreaElement>('field-prompt').value).toBe(
      'what I wrote before signing in'
    )

    await user().click(
      screen.getByRole('button', { name: /Open in Playground$/ })
    )

    expect(screen.getByTestId('example-replace-dialog')).toBeTruthy()
    expect(screen.getByTestId<HTMLTextAreaElement>('field-prompt').value).toBe(
      'what I wrote before signing in'
    )
  })

  it('asks for a form edit left behind in the other editor', async () => {
    const jsonModel: WorkshopModelDetail = {
      ...uncuratedRunnable,
      fields: [prompt],
      examples: [{ ...model.examples[0], fields: undefined }]
    }
    auth.session.value = credential
    mountDetail({ model: jsonModel })
    await nextTick()

    const prompt_ = screen.getByTestId('field-prompt')
    await user().clear(prompt_)
    await user().type(prompt_, 'my own words')
    await user().click(screen.getByRole('button', { name: 'Native JSON' }))

    await user().click(
      screen.getByRole('button', { name: /Open in Playground$/ })
    )

    expect(screen.getByTestId('example-replace-dialog')).toBeTruthy()
  })

  it('asks before an example overwrites a native JSON request too', async () => {
    const jsonModel: WorkshopModelDetail = {
      ...uncuratedRunnable,
      examples: [{ ...model.examples[0], fields: undefined }]
    }
    auth.session.value = credential
    mountDetail({ model: jsonModel })
    await nextTick()

    await user().click(screen.getByRole('button', { name: 'Native JSON' }))
    const body = screen.getByTestId('field-request_body')
    await user().clear(body)
    await user().type(body, '{{"prompt":"mine"}')

    await user().click(
      screen.getByRole('button', { name: /Open in Playground$/ })
    )

    expect(screen.getByTestId('example-replace-dialog')).toBeTruthy()
    expect(
      screen.getByTestId<HTMLTextAreaElement>('field-request_body').value
    ).toBe('{"prompt":"mine"}')
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

  it('can run again after reselecting an example whose source image comes from page defaults', async () => {
    const model = getRouterWorkshopModelDetail(
      'freepik--magnific-upscaler-precise-v2--edit-images'
    )
    if (!model) throw new Error('Missing Freepik model')
    auth.session.value = credential
    vi.mocked(runWorkshopRouter).mockResolvedValue(routerResult)
    mountDetail({ model })
    await nextTick()
    expect(screen.getByTestId('run-button').getAttribute('data-gate')).toBe(
      'ready'
    )
    await user().click(screen.getByTestId('run-button'))
    await vi.waitFor(() =>
      expect(
        screen.getByTestId('playground-output').getAttribute('data-state')
      ).toBe('succeeded')
    )
    const body = vi.mocked(runWorkshopRouter).mock.calls[0][0].body
    expect(JSON.stringify(body)).toContain('/input/denim_girl.png')
    await user().click(screen.getAllByTestId('example-card')[0])
    await user().click(screen.getByTestId('run-button'))
    await vi.waitFor(() => expect(runWorkshopRouter).toHaveBeenCalledTimes(2))
    expect(vi.mocked(runWorkshopRouter).mock.calls[1][0].body).toEqual(body)
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
      if (nativeJson)
        await user().click(screen.getByRole('button', { name: 'Native JSON' }))
      const input = screen.getByTestId<HTMLTextAreaElement>(
        nativeJson ? 'field-request_body' : 'field-prompt'
      )
      const edited = nativeJson
        ? '{"prompt":"My edited draft"}'
        : 'My edited draft'
      await fireEvent.update(input, edited)
      await user().click(
        screen.getByRole('button', { name: 'Start and end frame: View sample' })
      )
      expect(input.value).toBe(edited)
      expect(input.isConnected).toBe(true)
      expect(
        screen.getByRole('button', {
          name: 'Start and end frame: View sample',
          current: true
        })
      ).toBeTruthy()
      expect(
        screen.getByTestId('playground-output').getAttribute('data-state')
      ).toBe('example')
      expect(runWorkshopRouter).not.toHaveBeenCalled()
    }
  )

  it("sends the API tab's get-key link as a models onboarding arrival for this model and workspace", async () => {
    auth.session.value = credential
    mountDetail({ model: runnable })
    await nextTick()
    await user().click(screen.getByTestId('tab-api'))
    const href = screen.getByTestId('api-get-key').getAttribute('href')
    const params = new URL(href ?? '').searchParams
    expect(params.get('onboarding')).toBe('models')
    expect(params.get('model')).toBe('bfl--flux-2-pro')
    expect(params.get('workspace')).toBe(credential.workspace.id)
  })
})
