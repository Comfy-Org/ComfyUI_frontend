import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { computed, ref } from 'vue'

import type { AccountCredential } from '@comfyorg/account-core/session'

import { resolveModelRouterRender, router_render } from '@/config/router-render'
import type {
  PreparedRouterRender,
  RouterRenderResult
} from '@/config/router-render'
import {
  refreshWorkshopCredits,
  useTopUpWatch,
  useWorkshopCredits
} from '@/config/workshop-credits'
import { getRouterWorkshopModelDetail } from '@/config/workshop-router-content'
import { WorkshopRouterError } from '@/config/workshop-router-errors'
import { useWorkshopSession } from '@/config/workshop-session-state'
import { appModels } from '@/config/workshop-app-content'
import { prepareModelPage } from '@/routes/models/model-page'
import {
  captureWorkshopEvent,
  useWorkshopEnabled,
  useWorkshopEnabledSettled,
  useWorkshopAppsEnabled,
  useWorkshopFlag
} from '@/scripts/posthog'
import { CINEMATIC_STUDIO_APP_SLUG } from '@/lib/workshop/cinematic-studio/analytics'
import { sampleImageColors } from '@/lib/workshop/cinematic-studio/colors'
import { t, translationsFor } from '@/i18n/translations'
import { MAX_TAKES } from '@/lib/workshop/cinematic-studio/catalog'
import type { CinematicModel } from '@/lib/workshop/cinematic-studio/models'
import {
  runnableCinematicModels,
  runnableCinematicVideoModels
} from '@/lib/workshop/cinematic-studio/models'
import CinematicStudio from './CinematicStudio.vue'
import CinematicStudioPage from './CinematicStudioPage.vue'
import CinematicStudioPanel from './CinematicStudioPanel.vue'

const { t: tc } = translationsFor('en')

vi.mock(import('@/config/workshop-session-state'))
vi.mock(import('@/config/workshop-credits'))
vi.mock(import('@/scripts/posthog'))
vi.mock(import('@/config/router-render'), { spy: true })
vi.mock(import('@/lib/workshop/cinematic-studio/colors'), { spy: true })

const deploy = vi.hoisted(() => ({ env: '' }))
vi.mock(import('astro:env/client'), () => ({
  WORKSHOP_LOCAL_DEV: false,
  WORKSHOP_RELEASE: 'test',
  get WORKSHOP_DEPLOY_ENV() {
    return deploy.env
  }
}))

const models = runnableCinematicModels(getRouterWorkshopModelDetail)
const [first, second] = models
const videoModels = runnableCinematicVideoModels(getRouterWorkshopModelDetail)

/** What a take sent: the studio's own form, and the files attached to it. */
function sent(call: Parameters<typeof router_render>) {
  const values = call[2].form?.values ?? {}
  const references: File[] = []
  const collect = (value: unknown): void => {
    if (value instanceof File) references.push(value)
    else if (Array.isArray(value)) value.forEach(collect)
    else if (value && typeof value === 'object')
      Object.values(value).forEach(collect)
  }
  collect(values)
  return { values, prompt: String(values.prompt ?? ''), references }
}

const { fetchData } = vi.hoisted(() => ({ fetchData: vi.fn<typeof fetch>() }))

/** A still left on the provider's storage, which sends no CORS header. */
const PROVIDER_LINK =
  'https://ark-content-generation-v2-ap-southeast-1.tos-ap-southeast-1.volces.com/seedream/shot.jpeg'

async function servePageData(input: RequestInfo | URL) {
  if (String(input) === PROVIDER_LINK) throw new TypeError('Failed to fetch')
  if (String(input).startsWith('blob:'))
    return new Response(new Blob(['shot'], { type: 'image/png' }))
  const slug = decodeURIComponent(String(input).split('/')[2])
  const page = await prepareModelPage(slug)
  return Response.json(page)
}

function rendered(slug: string): RouterRenderResult {
  return {
    slug,
    routerId: slug,
    expectedKind: 'image',
    requestId: 'request-1',
    deadlineCollections: 0,
    outputs: [{ kind: 'image', url: 'blob:shot', fileName: 'shot.png' }]
  }
}

function renderedAtProvider(slug: string): RouterRenderResult {
  return {
    ...rendered(slug),
    outputs: [{ kind: 'image', url: PROVIDER_LINK, fileName: 'shot.jpeg' }]
  }
}

const credential: AccountCredential = {
  token: 'workspace-jwt',
  expiresAt: Date.now() + 60_000,
  uid: 'user-1',
  workspace: { id: 'workspace-1', name: 'Personal', type: 'personal' },
  role: 'owner',
  permissions: []
}

const signedIn = ref<AccountCredential>()

function renderStudio(studioModels: readonly CinematicModel[] = models) {
  render(CinematicStudio, { props: { models: studioModels } })
  return userEvent.setup()
}

async function chooseTakes(
  user: ReturnType<typeof userEvent.setup>,
  takes: number
) {
  const more = screen.queryByRole('button', { name: 'More takes' })
  if (more) {
    for (let count = 1; count < takes; count++) await user.click(more)
    return
  }
  await user.click(screen.getByRole('button', { name: /^Takes: / }))
  await user.click(
    await screen.findByRole('menuitemradio', { name: `×${takes}` })
  )
}

const generateButton = () => screen.getByTestId('cinematic-generate')

describe('CinematicStudio', () => {
  beforeEach(() => {
    deploy.env = ''
    vi.stubEnv('PUBLIC_WORKSHOP_ROUTER_RUN', '1')
    vi.mocked(useWorkshopEnabled).mockReturnValue(computed(() => true))
    vi.mocked(useWorkshopEnabledSettled).mockReturnValue(computed(() => true))
    vi.mocked(useWorkshopAppsEnabled).mockReturnValue(computed(() => true))
    vi.mocked(useWorkshopFlag).mockReturnValue(computed(() => true))
    const session = useWorkshopSession()
    session.session = computed(() => signedIn.value)
    vi.mocked(session.ensureFresh).mockResolvedValue({
      status: 'ok',
      session: credential
    })
    useWorkshopCredits().balance = computed(() => ({
      status: 'ok' as const,
      credits: 100
    }))
    signedIn.value = credential
    vi.mocked(sampleImageColors).mockImplementation(async (file: File) => {
      if (file.name === 'bad.png') throw new Error('Unsupported image')
      return ['#102030', '#405060']
    })
    vi.mocked(router_render)
      .mockReset()
      .mockRejectedValue(new WorkshopRouterError('client'))
    vi.stubGlobal('fetch', fetchData)
    fetchData.mockImplementation(servePageData)
    window.history.replaceState(null, '', '/hub/apps/cinematic-studio/')
  })

  it('waits for a scene before it can generate', async () => {
    const user = renderStudio()
    expect(generateButton()).toBeDisabled()

    await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')

    expect(generateButton()).toBeEnabled()
  })

  it('renders one Router request per take with the directed prompt', async () => {
    vi.mocked(router_render).mockImplementation(async (slug) => rendered(slug))
    const user = renderStudio()

    await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
    await chooseTakes(user, 2)
    await user.click(generateButton())

    expect(await screen.findByRole('radio', { name: 'B' })).toBeInTheDocument()
    expect(router_render).toHaveBeenCalledTimes(2)
    const [slug, parameters, options] = vi.mocked(router_render).mock.calls[0]
    expect(slug).toBe(first.slug)
    // The shot's own form: the exact frame size, no watermark, no example.
    expect(parameters).toEqual({})
    expect(sent(vi.mocked(router_render).mock.calls[0]).values).toMatchObject({
      size: '1920x1080',
      watermark: false,
      prompt: expect.stringMatching(
        /^Medium shot\. A diner at dawn .*Shot on large format cinema camera/
      )
    })
    const keys = vi
      .mocked(router_render)
      .mock.calls.map(([, , callOptions]) => callOptions.idempotencyKey)
    expect(new Set(keys).size).toBe(2)
    expect(options.model.slug).toBe(first.slug)
    expect(screen.getByAltText(/A diner at dawn/)).toHaveAttribute(
      'src',
      'blob:shot'
    )
    expect(screen.getByText(`${first.name} · 16:9`)).toBeInTheDocument()
  })

  it('sends the aspect and AI prompt setting chosen in the composer', async () => {
    vi.mocked(router_render).mockImplementation(async (slug) => rendered(slug))
    const user = renderStudio()

    await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
    // Seedream 5.0 Pro, the first model, has no 21:9 size, so it opens on 16:9.
    await user.click(screen.getByRole('button', { name: 'Aspect ratio: 16:9' }))
    await user.click(await screen.findByRole('menuitemradio', { name: /1:1/ }))
    await user.click(screen.getByRole('switch', { name: 'AI prompt' }))
    await user.click(generateButton())

    await vi.waitFor(() => expect(router_render).toHaveBeenCalledTimes(1))
    expect(
      screen.getByRole('button', { name: 'Aspect ratio: 1:1' })
    ).toBeInTheDocument()
    const shot = sent(vi.mocked(router_render).mock.calls[0])
    expect(shot.values).toMatchObject({ size: '2048x2048' })
    expect(shot.prompt).not.toContain('Cinematic film still')
  })

  it('runs the shot on the model picked in the composer', async () => {
    vi.mocked(router_render).mockImplementation(async (slug) => rendered(slug))
    const user = renderStudio()

    await user.click(screen.getByRole('button', { name: /^Model/ }))
    await user.click(
      await screen.findByRole('menuitemradio', {
        name: new RegExp(second.name)
      })
    )
    await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
    await user.click(generateButton())

    await screen.findByAltText(/A diner at dawn/)
    expect(vi.mocked(router_render).mock.calls[0][0]).toBe(second.slug)
    expect(fetchData).toHaveBeenCalledWith(
      `/models/${encodeURIComponent(second.slug)}/page.json`
    )
  })

  it('opens on the model a model page links to', async () => {
    window.history.replaceState(
      null,
      '',
      `/cinematic-studio?model=${second.slug}`
    )
    renderStudio()

    expect(
      await screen.findByRole('button', {
        name: `Model: ${second.name}`
      })
    ).toBeInTheDocument()
  })

  it('offers a failed take again on another model', async () => {
    vi.mocked(router_render)
      .mockRejectedValueOnce(new WorkshopRouterError('provider', 'request-9'))
      .mockImplementation(async (slug) => rendered(slug))
    const user = renderStudio()

    await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
    await user.click(generateButton())

    const notice = await screen.findByRole('status')
    expect(notice).toHaveTextContent(t('workshop.error.provider'))
    expect(notice).toHaveTextContent('request-9')
    await user.click(
      within(notice).getByRole('button', {
        name: tc(
          'cinematic.state.tryOn',
          { model: second.name },
          { locale: 'en' }
        )
      })
    )

    await screen.findByAltText(/A diner at dawn/)
    expect(vi.mocked(router_render).mock.calls[1][0]).toBe(second.slug)
  })

  it('settles the frame when a failed take switches to a narrower model', async () => {
    // Nano Banana Pro makes 21:9, so the studio opens on it; Seedream 5.0 Pro
    // does not, and `switch-model` sets the model and generates in one handler.
    const wide = models.find((model) => model.aspects?.includes('21:9'))!
    const narrow = models.find((model) => !model.aspects?.includes('21:9'))!
    vi.mocked(router_render)
      .mockRejectedValueOnce(new WorkshopRouterError('provider', 'request-9'))
      .mockImplementation(async (slug) => rendered(slug))
    const user = renderStudio([wide, narrow])

    await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
    expect(
      screen.getByRole('button', { name: 'Aspect ratio: 21:9' })
    ).toBeInTheDocument()
    await user.click(generateButton())

    const notice = await screen.findByRole('status')
    await user.click(
      within(notice).getByRole('button', {
        name: tc(
          'cinematic.state.tryOn',
          { model: narrow.name },
          { locale: 'en' }
        )
      })
    )

    await screen.findByAltText(/A diner at dawn/)
    const calls = vi.mocked(router_render).mock.calls
    expect(calls[1][0]).toBe(narrow.slug)
    // The take must fall to the nearest frame the new model can make, not carry
    // 21:9 over from the model that failed.
    expect(sent(calls[1]).values).toMatchObject({ size: '1920x1080' })
    const chosen = screen.getByRole('button', { name: 'Aspect ratio: 16:9' })
    expect(chosen).toBeInTheDocument()
    // The menu follows the model too, so 21:9 is no longer on offer.
    await user.click(chosen)
    expect(
      await screen.findByRole('menuitemradio', { name: /16:9/ })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('menuitemradio', { name: /21:9/ })
    ).not.toBeInTheDocument()
  })

  it('sends a take blocked by content policy back to the scene', async () => {
    vi.mocked(router_render).mockRejectedValue(
      new WorkshopRouterError('policy')
    )
    const user = renderStudio()

    await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
    await user.click(generateButton())
    const notice = await screen.findByRole('status')
    expect(
      within(notice).queryByRole('button', { name: t('workshop.error.retry') })
    ).toBeNull()
    await user.click(
      within(notice).getByRole('button', {
        name: tc('cinematic.state.editScene')
      })
    )

    expect(screen.getByLabelText('Scene')).toHaveFocus()
  })

  it('hides a sensitive take until the viewer chooses to see it', async () => {
    vi.mocked(router_render).mockImplementation(async (slug) => ({
      ...rendered(slug),
      outputs: [
        { kind: 'image', url: 'blob:shot', fileName: 'shot.png', nsfw: true }
      ]
    }))
    const user = renderStudio()

    await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
    await user.click(generateButton())
    const reveal = await screen.findByRole('button', {
      name: t('workshop.output.reveal')
    })
    expect(screen.getByText(t('workshop.output.nsfw'))).toBeInTheDocument()

    await user.click(reveal)

    expect(screen.queryByText(t('workshop.output.nsfw'))).toBeNull()
  })

  it.for([
    {
      name: 'a finished take',
      render: async (slug: string) => rendered(slug),
      outcome: {
        status: 'succeeded',
        request_id: 'request-1',
        output_count: 1
      }
    },
    {
      name: 'a failed take',
      render: async () => {
        throw new WorkshopRouterError('provider', 'request-9')
      },
      outcome: { status: 'failed', reason: 'provider', request_id: 'request-9' }
    }
  ])(
    'records $name as an app run, apart from model pages',
    async ({ render: renderTake, outcome }) => {
      vi.mocked(router_render).mockImplementation(renderTake)
      const user = renderStudio()

      await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
      await user.click(generateButton())

      const app = {
        model_slug: first.slug,
        page_type: 'app',
        app_slug: CINEMATIC_STUDIO_APP_SLUG,
        render_engine: 'router',
        user_id: credential.uid,
        workspace_id: credential.workspace.id
      }
      await vi.waitFor(() =>
        expect(captureWorkshopEvent).toHaveBeenCalledWith({
          name: 'run_finished',
          properties: expect.objectContaining({ ...app, ...outcome })
        })
      )
      expect(captureWorkshopEvent).toHaveBeenCalledWith({
        name: 'run_started',
        properties: expect.objectContaining(app)
      })
    }
  )

  it.for([
    {
      name: 'a cancelled take',
      prepare: () =>
        vi
          .mocked(router_render)
          .mockImplementation(
            (_slug, _parameters, options) =>
              new Promise((_resolve, reject) =>
                options.signal?.addEventListener('abort', () =>
                  reject(options.signal?.reason)
                )
              )
          ),
      act: async (user: ReturnType<typeof userEvent.setup>) =>
        user.click(await screen.findByRole('button', { name: 'Cancel' })),
      outcome: { status: 'cancelled' }
    },
    {
      name: 'a take whose model cannot load',
      prepare: () =>
        fetchData.mockImplementation(async (input) =>
          String(input).startsWith('blob:')
            ? servePageData(input)
            : new Response('unavailable', { status: 500 })
        ),
      act: async () => {},
      outcome: {
        status: 'failed',
        reason: 'unavailable',
        failure_stage: 'input_preparation'
      }
    }
  ])('records $name as an app run', async ({ prepare, act, outcome }) => {
    prepare()
    const user = renderStudio()

    await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
    await user.click(generateButton())
    await act(user)

    await vi.waitFor(() =>
      expect(captureWorkshopEvent).toHaveBeenCalledWith({
        name: 'run_finished',
        properties: expect.objectContaining({
          model_slug: first.slug,
          page_type: 'app',
          app_slug: CINEMATIC_STUDIO_APP_SLUG,
          ...outcome
        })
      })
    )
    expect(
      vi
        .mocked(captureWorkshopEvent)
        .mock.calls.filter(([event]) => event.name === 'run_finished')
    ).toHaveLength(1)
  })

  it.for([
    { name: 'arrives', page: servePageData },
    {
      name: 'fails',
      page: async () => new Response('unavailable', { status: 500 })
    }
  ])(
    'records no run for a take cancelled before its model page $name',
    async ({ page }) => {
      const requested = Promise.withResolvers<void>()
      const cancelled = Promise.withResolvers<void>()
      fetchData.mockImplementation(async (input) => {
        if (String(input).startsWith('blob:')) return servePageData(input)
        requested.resolve()
        await cancelled.promise
        return page(input)
      })
      vi.mocked(router_render).mockImplementation(async (slug) =>
        rendered(slug)
      )
      const user = renderStudio()

      await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
      await user.click(generateButton())
      await requested.promise
      await user.click(await screen.findByRole('button', { name: 'Cancel' }))
      vi.mocked(refreshWorkshopCredits).mockClear()
      cancelled.resolve()

      await vi.waitFor(() =>
        expect(refreshWorkshopCredits).toHaveBeenCalledWith({ force: true })
      )
      expect(router_render).not.toHaveBeenCalled()
      expect(
        vi
          .mocked(captureWorkshopEvent)
          .mock.calls.filter(([event]) => event.name.startsWith('run_'))
      ).toEqual([])
    }
  )

  it('records a take download as an app download', async () => {
    vi.mocked(router_render).mockImplementation(async (slug) => rendered(slug))
    const user = renderStudio()
    await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
    await user.click(generateButton())

    const download = await screen.findByRole('link', {
      name: tc('cinematic.stage.download')
    })
    const stayOnPage = (event: Event) => event.preventDefault()
    window.addEventListener('click', stayOnPage, { capture: true })
    onTestFinished(() =>
      window.removeEventListener('click', stayOnPage, { capture: true })
    )
    await user.click(download)

    expect(captureWorkshopEvent).toHaveBeenCalledWith({
      name: 'output_download_clicked',
      properties: {
        model_slug: first.slug,
        page_type: 'app',
        app_slug: CINEMATIC_STUDIO_APP_SLUG,
        output_kind: 'image'
      }
    })
  })

  it('records each app page once, however often it is picked', async () => {
    render(CinematicStudioPage, { props: { apps: appModels, models } })
    const user = userEvent.setup()
    const pick = async (name: string) => {
      await user.click(
        await screen.findByRole('button', { name: /^Layout to review/ })
      )
      await user.click(await screen.findByRole('menuitemradio', { name }))
    }

    await pick('Re-shoot a video')
    await pick('Cinematic Studio')
    await pick('Re-shoot a video')

    const viewed = (slug: string) => ({
      name: 'model_viewed',
      properties: { model_slug: slug, page_type: 'app', app_slug: slug }
    })
    expect(
      vi
        .mocked(captureWorkshopEvent)
        .mock.calls.filter(([event]) => event.name === 'model_viewed')
        .map(([event]) => event)
    ).toEqual([viewed(CINEMATIC_STUDIO_APP_SLUG), viewed('apps/reshoot')])
    expect(appModels.find((app) => app.appId === 'studio')?.slug).toBe(
      CINEMATIC_STUDIO_APP_SLUG
    )
  })

  it('does not offer to generate when no model can run', () => {
    renderStudio([])

    expect(generateButton()).toBeDisabled()
    expect(generateButton()).toHaveAttribute(
      'aria-description',
      tc('cinematic.output.unavailable')
    )
  })

  it('asks a signed-out visitor to sign in instead of generating', async () => {
    signedIn.value = undefined
    renderStudio()

    expect(
      await screen.findByRole('link', { name: t('workshop.run.signIn') })
    ).toBeInTheDocument()
    expect(screen.queryByTestId('cinematic-generate')).toBeNull()
  })

  it('fills the composer from a starter shot', async () => {
    const user = renderStudio()

    await user.click(
      screen.getByRole('button', { name: tc('cinematic.firstRun.desert') })
    )

    expect(screen.getByDisplayValue(/^A lone rider/)).toHaveFocus()
    expect(
      screen.getByRole('button', { name: tc('cinematic.firstRun.desert') })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: 'Framing: Extreme wide' })
    ).toBeInTheDocument()
  })

  it('opens each direction segment on its own picker and writes the pick into the prompt', async () => {
    vi.mocked(router_render).mockImplementation(async (slug) => rendered(slug))
    const user = renderStudio()
    const direction = screen.getByRole('group', { name: 'Direction' })

    await user.click(within(direction).getByRole('button', { name: /^Light:/ }))
    const light = screen.getByRole('dialog', { name: 'Light' })
    expect(within(light).queryByRole('radio', { name: 'Western' })).toBeNull()
    await user.click(within(light).getByRole('radio', { name: 'Neon' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(within(direction).getByRole('button', { name: /^Look:/ }))
    await user.click(
      within(screen.getByRole('dialog', { name: 'Look' })).getByRole('radio', {
        name: 'Western'
      })
    )

    await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
    expect(
      within(direction)
        .getAllByRole('button')
        .map((segment) => segment.getAttribute('aria-label'))
    ).toEqual([
      'Framing: Medium',
      'Light: Neon',
      expect.stringMatching(/^Film: /),
      'Look: Western',
      expect.stringMatching(/^Grade: /)
    ])
    await user.click(generateButton())
    await screen.findByAltText(/A diner at dawn/)
    expect(sent(vi.mocked(router_render).mock.calls[0]).prompt).toContain(
      'Neon light'
    )
  })

  it.for([
    { control: /^Light:/, tooltip: /^Light: / },
    { control: /^Camera:/, tooltip: /^Camera: Large format · / },
    { control: 'Resolution: 2K', tooltip: 'Resolution: 2K' }
  ])(
    'names the composer control $control in a tooltip on hover',
    async ({ control, tooltip }) => {
      const user = renderStudio()
      const trigger = screen.getByRole('button', { name: control })

      await user.hover(trigger)

      expect((await screen.findAllByText(tooltip)).length).toBeGreaterThan(0)
    }
  )

  const openReferenceMenu = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(
      screen.getByRole('button', { name: tc('cinematic.composer.references') })
    )

  it.for([
    { kind: 'cast', label: 'Character', action: 'Add a character reference' }
  ])(
    'names an attached $label reference in the composer menu and removes it from there',
    async ({ kind, label, action }) => {
      const user = renderStudio()
      const file = new File(['ref'], 'ref.png', { type: 'image/png' })

      await user.upload(screen.getByTestId(`cinematic-reference-${kind}`), file)
      await openReferenceMenu(user)
      expect(
        await screen.findByRole('menuitem', {
          name: new RegExp(`^${label}.*ref\\.png`)
        })
      ).toBeInTheDocument()
      await user.click(
        screen.getByRole('menuitem', {
          name: new RegExp(`^Remove reference: ${label}`)
        })
      )

      await openReferenceMenu(user)
      expect(
        await screen.findByRole('menuitem', {
          name: new RegExp(`^${label}.*${action}`)
        })
      ).toBeInTheDocument()
      expect(screen.queryByRole('menuitem', { name: /^Remove/ })).toBeNull()
    }
  )

  it('offers no palette reference in the composer menu', async () => {
    const user = renderStudio()

    await openReferenceMenu(user)

    expect(
      await screen.findByRole('menuitem', { name: /^Character/ })
    ).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /^Palette/ })).toBeNull()
  })

  it('sends the colors of a Grade picture as words, in place of the preset', async () => {
    vi.mocked(router_render).mockImplementation(async (slug) => rendered(slug))
    const user = renderStudio()

    await user.click(screen.getByRole('button', { name: /^Grade:/ }))
    await user.click(
      within(screen.getByRole('dialog', { name: 'Grade' })).getByRole('radio', {
        name: 'Teal and orange'
      })
    )
    await user.click(screen.getByRole('button', { name: /^Grade:/ }))
    await user.upload(
      screen.getByTestId('cinematic-grade-image-input'),
      new File(['ref'], 'colors.png', { type: 'image/png' })
    )
    await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
    await user.click(generateButton())

    await screen.findByAltText(/A diner at dawn/)
    const shot = sent(vi.mocked(router_render).mock.calls[0])
    expect(shot.prompt).not.toContain('teal and orange grade')
    expect(shot.prompt).toContain('dominant colors #102030, #405060')
    expect(shot.references).toEqual([])
  })

  it('keeps the camera picker open across columns until clicked away', async () => {
    const user = renderStudio()

    await user.click(screen.getByRole('button', { name: /^Camera:/ }))
    const picker = screen.getByRole('dialog', { name: 'Camera' })
    await user.click(within(picker).getByRole('radio', { name: '85mm' }))
    await user.click(within(picker).getByRole('radio', { name: 'f/4' }))

    expect(picker).toBeInTheDocument()
    await user.click(screen.getByLabelText('Scene'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByLabelText('Scene')).toHaveFocus()
    expect(
      screen.getByRole('button', { name: 'Camera: 85mm' })
    ).toHaveTextContent('85mm')
  })

  it('names the camera chip by its body when the focal length is left to auto', async () => {
    const user = renderStudio()

    await user.click(screen.getByRole('button', { name: 'Camera: 50mm' }))
    const picker = screen.getByRole('dialog', { name: 'Camera' })
    await user.click(
      within(
        within(picker).getByRole('radiogroup', { name: 'Focal length' })
      ).getByRole('radio', { name: 'Auto' })
    )

    expect(
      screen.getByRole('button', { name: 'Camera: Large format' })
    ).toBeInTheDocument()
  })

  it('sends a character reference with the prompt that names it', async () => {
    vi.mocked(router_render).mockImplementation(async (slug) => rendered(slug))
    const user = renderStudio()
    const face = new File(['face'], 'mara.png', { type: 'image/png' })

    await user.click(
      screen.getByRole('button', { name: tc('cinematic.composer.references') })
    )
    await user.click(
      await screen.findByRole('menuitem', { name: /^Character/ })
    )
    await user.upload(screen.getByTestId('cinematic-reference-cast'), face)
    await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
    await user.click(generateButton())

    await screen.findByAltText(/A diner at dawn/)
    const call = vi.mocked(router_render).mock.calls[0]
    expect(call[0]).toBe(first.referenceSlug)
    expect(sent(call).references).toEqual([face])
    expect(sent(call).prompt).toContain(
      'Keep the character from reference image 1.'
    )
  })

  it('does not charge for references a model would drop', async () => {
    const dropsReferences = models.find((model) => !model.referenceSlug)
    if (!dropsReferences) throw new Error('Every model keeps references')
    window.history.replaceState(
      null,
      '',
      `/cinematic-studio?model=${dropsReferences.slug}`
    )
    const user = renderStudio()
    const face = new File(['face'], 'mara.png', { type: 'image/png' })

    await user.click(
      await screen.findByRole('button', {
        name: tc('cinematic.composer.references')
      })
    )
    await user.click(
      await screen.findByRole('menuitem', { name: /^Character/ })
    )
    await user.upload(screen.getByTestId('cinematic-reference-cast'), face)
    await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')

    expect(generateButton()).toBeDisabled()
    expect(
      screen.getByText(
        tc(
          'cinematic.references.unsupported',
          {
            model: dropsReferences.name
          },
          { locale: 'en' }
        )
      )
    ).toBeInTheDocument()
    expect(router_render).not.toHaveBeenCalled()
  })

  it.for([
    {
      layout: 'the stage',
      ux: '?ux=e',
      settlement: 'pending' as const
    },
    {
      layout: 'the stage',
      ux: '?ux=e',
      settlement: 'terminal' as const
    },
    {
      layout: 'the side panel',
      ux: '?ux=d',
      settlement: 'pending' as const
    }
  ])(
    'tries only the failed take again on $layout after a $settlement failure',
    async ({ ux, settlement }) => {
      window.history.replaceState(null, '', `/cinematic-studio${ux}`)
      const first: {
        key: unknown
        prepared: PreparedRouterRender
      }[] = []
      vi.mocked(router_render).mockImplementation(
        async (slug, parameters, options) => {
          if (first.length >= 2) return rendered(slug)
          const prepared = {
            ...resolveModelRouterRender(options.model, parameters, {
              form: options.form
            }),
            body: { take: first.length }
          }
          await options.onPrepared?.(prepared)
          first.push({ key: options.idempotencyKey, prepared })
          if (first.length === 1) return rendered(slug)
          throw new WorkshopRouterError(
            'network',
            'request-7',
            {},
            undefined,
            'response',
            { requestSettlement: settlement }
          )
        }
      )
      render(CinematicStudioPage, { props: { apps: appModels, models } })
      const user = userEvent.setup()

      await user.type(await screen.findByLabelText('Scene'), 'A diner at dawn')
      await chooseTakes(user, 2)
      await user.click(generateButton())
      await user.click(
        await screen.findByRole('button', { name: 'Shot 1, take B' })
      )
      await user.click(
        within(await screen.findByRole('status')).getByRole('button', {
          name: t('workshop.error.retry')
        })
      )

      await vi.waitFor(() =>
        expect(vi.mocked(router_render)).toHaveBeenCalledTimes(3)
      )
      const [, , retry] = vi.mocked(router_render).mock.calls[2]
      if (settlement === 'pending') {
        expect(retry.idempotencyKey).toBe(first[1].key)
        expect(retry.prepared).toBe(first[1].prepared)
      } else {
        expect(retry.prepared).toBeUndefined()
        expect([first[0].key, first[1].key]).not.toContain(retry.idempotencyKey)
      }
    }
  )

  it('cancels a take that is still rendering', async () => {
    const signals: AbortSignal[] = []
    vi.mocked(router_render).mockImplementation(
      (_slug, _parameters, options) =>
        new Promise(() => {
          if (options.signal) signals.push(options.signal)
        })
    )
    const user = renderStudio()

    await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
    await user.click(generateButton())
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      t('workshop.output.cancelled')
    )
    expect(signals).toHaveLength(1)
    expect(signals[0].aborted).toBe(true)
  })

  it.for([
    { layout: 'bottom composer', component: CinematicStudio },
    { layout: 'side panel', component: CinematicStudioPanel }
  ])(
    'asks before a link leaves a take still rendering in the $layout',
    async ({ component }) => {
      const signals: AbortSignal[] = []
      vi.mocked(router_render).mockImplementation(
        (_slug, _parameters, options) =>
          new Promise(() => {
            if (options.signal) signals.push(options.signal)
          })
      )
      const assign = vi
        .spyOn(window.location, 'assign')
        .mockImplementation(() => {})
      render(component, { props: { models } })
      const user = userEvent.setup()
      const away = document.body.appendChild(document.createElement('a'))
      away.href = '/pricing'
      away.textContent = 'Pricing'

      await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
      await user.click(generateButton())
      await user.click(away)
      const dialog = await screen.findByRole('dialog', {
        name: t('workshop.run.leaveTitle')
      })
      await user.click(
        within(dialog).getByRole('button', {
          name: t('workshop.run.leaveAnyway')
        })
      )

      expect(signals[0].aborted).toBe(true)
      expect(assign).toHaveBeenCalledWith(`${location.origin}/pricing`)
      away.remove()
      assign.mockRestore()
    }
  )

  it('introduces the app under its title in the side panel', () => {
    render(CinematicStudioPanel, { props: { models } })

    expect(screen.getByText(tc('cinematic.lead'))).toBeVisible()
  })

  it('does not generate again once the scene is cleared', async () => {
    vi.mocked(router_render).mockImplementation(async (slug) => rendered(slug))
    const user = renderStudio()

    await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
    await user.click(generateButton())
    await screen.findByAltText(/A diner at dawn/)
    await user.clear(screen.getByLabelText('Scene'))
    await user.click(
      screen.getByRole('button', { name: tc('cinematic.stage.again') })
    )

    expect(router_render).toHaveBeenCalledTimes(1)
  })

  it('moves between takes with the arrow keys', async () => {
    vi.mocked(router_render).mockImplementation(async (slug) => rendered(slug))
    const user = renderStudio()
    await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
    await chooseTakes(user, 2)
    await user.click(generateButton())

    const takeA = await screen.findByRole('radio', { name: 'A' })
    expect(takeA).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('radio', { name: 'B' })).toHaveAttribute(
      'tabindex',
      '-1'
    )

    takeA.focus()
    await user.keyboard('{ArrowRight}')

    const takeB = screen.getByRole('radio', { name: 'B' })
    expect(takeB).toBeChecked()
    expect(takeB).toHaveFocus()
  })

  it('moves focus into a picker and back to its chip on Escape', async () => {
    const user = renderStudio()
    const chip = screen.getByRole('button', { name: /^Framing:/ })

    await user.click(chip)
    expect(screen.getByRole('radio', { name: 'Medium' })).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(chip).toHaveFocus()
  })

  it('reruns a finished shot and reuses it as the next reference', async () => {
    vi.mocked(router_render).mockImplementation(async (slug) => rendered(slug))
    const user = renderStudio()
    await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
    await user.click(generateButton())
    await screen.findByAltText(/A diner at dawn/)

    await user.click(
      screen.getByRole('button', { name: tc('cinematic.stage.useAsReference') })
    )
    await user.click(
      screen.getByRole('button', { name: tc('cinematic.stage.again') })
    )

    await vi.waitFor(() => expect(router_render).toHaveBeenCalledTimes(2))
    const rerun = sent(vi.mocked(router_render).mock.calls[1])
    expect(rerun.references).toEqual([expect.any(File)])
    expect(rerun.prompt).toContain('Keep the character from reference image 1.')
  })

  it('keeps the scene unreferenced when a take can no longer be read', async () => {
    fetchData.mockImplementation(async (input) =>
      String(input).startsWith('blob:')
        ? Promise.reject(new TypeError('Revoked'))
        : servePageData(input)
    )
    vi.mocked(router_render).mockImplementation(async (slug) => rendered(slug))
    const user = renderStudio()
    await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
    await user.click(generateButton())
    await screen.findByAltText(/A diner at dawn/)

    await user.click(
      screen.getByRole('button', { name: tc('cinematic.stage.useAsReference') })
    )
    await user.click(
      screen.getByRole('button', { name: tc('cinematic.stage.again') })
    )

    await vi.waitFor(() => expect(router_render).toHaveBeenCalledTimes(2))
    expect(sent(vi.mocked(router_render).mock.calls[1]).references).toEqual([])
  })

  it('renders sample frames in demo mode without calling the Router', async () => {
    window.history.replaceState(null, '', '/hub/apps/cinematic-studio/?demo=1')
    signedIn.value = undefined
    const user = renderStudio()

    await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
    await user.click(generateButton())

    const frame = await screen.findByAltText(
      /A diner at dawn/,
      {},
      { timeout: 3000 }
    )
    expect(frame.getAttribute('src')).toMatch(/^\/images\/cinematic-studio\//)
    expect(router_render).not.toHaveBeenCalled()
  })

  it.for([
    { apps: false, open: false },
    { apps: true, open: true }
  ])(
    'opens the studio only to the Apps rollout (apps $apps)',
    async ({ apps, open }) => {
      vi.mocked(useWorkshopAppsEnabled).mockReturnValue(computed(() => apps))
      render(CinematicStudioPage, { props: { apps: appModels, models } })

      await vi.waitFor(() => {
        expect(screen.queryAllByTestId('cinematic')).toHaveLength(open ? 1 : 0)
        expect(
          screen.queryAllByText(tc('cinematic.unavailable.title'))
        ).toHaveLength(open ? 0 : 1)
      })
    }
  )

  it.for([
    { app: 'reshoot', flag: false, open: false },
    { app: 'reshoot', flag: true, open: true },
    { app: 'studio', flag: false, open: true }
  ] as const)(
    'opens $app only while its PostHog flag allows it (flag $flag)',
    async ({ app, flag, open }) => {
      vi.mocked(useWorkshopFlag).mockImplementation((name) =>
        computed(() => name !== 'workshop-reshoot-app-enabled' || flag)
      )
      render(CinematicStudioPage, {
        props: { apps: appModels, models, initialApp: app }
      })

      await vi.waitFor(() => {
        expect(
          screen.queryAllByText(tc('cinematic.unavailable.title'))
        ).toHaveLength(open ? 0 : 1)
        expect(
          screen.queryAllByTestId(app === 'reshoot' ? 'reshoot' : 'cinematic')
        ).toHaveLength(open ? 1 : 0)
      })
    }
  )

  it('reports switching to Video as a tab_switched event', async () => {
    const user = renderStudio([...models, ...videoModels])

    await user.click(screen.getByRole('button', { name: 'Video' }))

    expect(captureWorkshopEvent).toHaveBeenCalledWith({
      name: 'tab_switched',
      properties: {
        model_slug: CINEMATIC_STUDIO_APP_SLUG,
        page_type: 'app',
        app_slug: CINEMATIC_STUDIO_APP_SLUG,
        tab: 'video'
      }
    })
  })

  it('does not report a tab switch when the URL alone sets the mode', () => {
    window.history.replaceState(
      null,
      '',
      `/cinematic-studio?model=${videoModels[0].slug}`
    )
    renderStudio([...models, ...videoModels])

    expect(
      vi
        .mocked(captureWorkshopEvent)
        .mock.calls.some(([event]) => event.name === 'tab_switched')
    ).toBe(false)
  })

  it('shoots a clip on the first video model in video mode', async () => {
    vi.mocked(router_render).mockImplementation(async (slug) => rendered(slug))
    const user = renderStudio([...models, ...videoModels])

    await user.click(screen.getByRole('button', { name: 'Video' }))
    await user.type(
      screen.getByLabelText('Scene'),
      'A lighthouse keeper climbs'
    )
    await user.click(generateButton())

    await vi.waitFor(() => expect(router_render).toHaveBeenCalledOnce())
    const call = vi.mocked(router_render).mock.calls[0]
    expect(call[0]).toBe(videoModels[0].slug)
    expect(sent(call).values).toMatchObject({
      duration: 5,
      resolution: '720p',
      generate_audio: false
    })
    expect(sent(call).prompt).toContain('continuous motion')
  })

  it('shoots a clip on a video model that picks its own frame', async () => {
    // Wan 3.0 and Gemini Omni Flash 1.1 list no frames because the operation
    // chooses one, so an empty list here has to read as unrestricted -- the
    // opposite of an empty list on the image path, where it means the model can
    // make none. Seedance 2.5 Edit also lists none but wants a source video, so
    // pick the one that is otherwise ready to run.
    const ownFrame = videoModels.find(
      (option) =>
        option.video &&
        !option.video.aspects.length &&
        !option.video.sourceVideo
    )!
    vi.mocked(router_render).mockImplementation(async (slug) => rendered(slug))
    const user = renderStudio([...models, ownFrame])

    await user.click(screen.getByRole('button', { name: 'Video' }))
    await user.type(
      screen.getByLabelText('Scene'),
      'A lighthouse keeper climbs'
    )
    await user.click(generateButton())

    await vi.waitFor(() => expect(router_render).toHaveBeenCalledOnce())
    expect(vi.mocked(router_render).mock.calls[0][0]).toBe(ownFrame.slug)
  })

  it('animates a finished still on the image-to-video operation', async () => {
    vi.mocked(router_render).mockImplementation(async (slug) => rendered(slug))
    const user = renderStudio([...models, ...videoModels])

    await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
    await user.click(generateButton())
    await user.click(
      await screen.findByRole('button', { name: 'Animate image' })
    )
    await user.click(generateButton())

    await vi.waitFor(() => expect(router_render).toHaveBeenCalledTimes(2))
    const call = vi.mocked(router_render).mock.calls[1]
    expect(call[0]).toBe(videoModels[0].firstFrameSlug)
    expect(sent(call).references).toEqual([expect.any(File)])
  })

  describe('reusing a still the page cannot read', () => {
    async function shootAtProvider() {
      vi.mocked(router_render).mockImplementation(async (slug) =>
        renderedAtProvider(slug)
      )
      const user = renderStudio([...models, ...videoModels])
      await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
      await user.click(generateButton())
      await screen.findByAltText(/A diner at dawn/)
      return user
    }

    it('animates it by handing its link to the video model', async () => {
      const user = await shootAtProvider()
      await user.click(screen.getByRole('button', { name: 'Animate image' }))
      await user.click(generateButton())

      await vi.waitFor(() => expect(router_render).toHaveBeenCalledTimes(2))
      const call = vi.mocked(router_render).mock.calls[1]
      expect(call[0]).toBe(videoModels[0].firstFrameSlug)
      expect(JSON.stringify(sent(call).values)).toContain(PROVIDER_LINK)
    })

    it('says so when the next model needs the picture itself', async () => {
      const user = await shootAtProvider()
      await user.click(screen.getByRole('button', { name: 'Use as reference' }))
      expect(
        await screen.findByText(/needs the picture itself/)
      ).toBeInTheDocument()
      expect(generateButton()).toBeDisabled()
    })

    it('offers it as a reference only for another still', async () => {
      const user = await shootAtProvider()
      await user.click(screen.getByRole('button', { name: 'Video' }))
      expect(
        screen.queryByRole('button', { name: 'Use as reference' })
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Animate image' })
      ).toBeInTheDocument()
    })
  })

  describe('credits', () => {
    const priced: readonly CinematicModel[] = models.map((model) =>
      model.slug === first.slug
        ? {
            ...model,
            prices: {
              '16:9 2K 0': { min: 6, max: 6 },
              '16:9 1K 0': { min: 3, max: 3 }
            }
          }
        : model
    )
    const estimate = () => screen.findByTestId('cinematic-estimate')
    const credits = (amount: number) =>
      tc('cinematic.credits.estimate', { credits: amount }, { locale: 'en' })

    async function shootTakes(
      user: ReturnType<typeof userEvent.setup>,
      takes: number
    ) {
      if (takes > 1) await chooseTakes(user, takes)
    }

    function withBalance(amount: number) {
      useWorkshopCredits().balance = computed(() => ({
        status: 'ok' as const,
        credits: amount
      }))
    }

    it('estimates a priced model and says an unpriced one varies', async () => {
      const user = renderStudio(priced)
      expect(await estimate()).toHaveTextContent(credits(6))

      await user.click(screen.getByRole('button', { name: /^Model/ }))
      await user.click(
        await screen.findByRole('menuitemradio', {
          name: new RegExp(second.name)
        })
      )

      expect(await estimate()).toHaveTextContent(tc('cinematic.credits.varies'))
      expect(await estimate()).not.toHaveTextContent(/\d/)
    })

    it('scales the estimate with takes and resolution', async () => {
      const user = renderStudio(priced)

      await chooseTakes(user, 2)
      expect(await estimate()).toHaveTextContent(credits(12))
      expect(await estimate()).toHaveTextContent('2 takes × ~6 credits')

      await user.click(screen.getByRole('button', { name: 'Resolution: 2K' }))
      await user.click(await screen.findByRole('menuitemradio', { name: '1K' }))

      expect(await estimate()).toHaveTextContent(credits(6))
      expect(await estimate()).toHaveTextContent('2 takes × ~3 credits')
    })

    it.for([
      {
        balance: 20,
        takes: 4,
        note: '4 takes need ~24 credits; you have 20.',
        reduce: 'Use 3 takes'
      },
      {
        balance: 7,
        takes: 2,
        note: '2 takes need ~12 credits; you have 7.',
        reduce: 'Use 1 take'
      },
      {
        balance: 5,
        takes: 1,
        note: '1 take needs ~6 credits; you have 5.',
        reduce: undefined
      }
    ])(
      'blocks $takes takes on a balance of $balance',
      async ({ balance, takes, note, reduce }) => {
        withBalance(balance)
        const user = renderStudio(priced)
        await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
        await shootTakes(user, takes)

        expect(screen.getByTestId('cinematic-credit-note')).toHaveTextContent(
          note
        )
        expect(screen.queryByTestId('cinematic-generate')).toBeNull()
        expect(
          screen.getByRole('button', { name: t('workshop.run.buyCredits') })
        ).toBeInTheDocument()
        expect(
          screen
            .queryByRole('button', { name: /^Use \d takes?$/ })
            ?.textContent.trim()
        ).toBe(reduce)
      }
    )

    it.for([
      { layout: 'side panel', ux: '' },
      { layout: 'bottom composer', ux: '?ux=e' }
    ])('keeps credit amounts off the $layout', async ({ ux }) => {
      withBalance(5)
      window.history.replaceState(null, '', `/cinematic-studio${ux}`)
      render(CinematicStudioPage, {
        props: { apps: appModels, models: priced }
      })

      expect(
        await screen.findByRole('button', {
          name: t('workshop.run.buyCredits')
        })
      ).toBeInTheDocument()
      expect(screen.queryByTestId('cinematic-estimate')).toBeNull()
      expect(screen.queryByTestId('cinematic-credit-note')).toBeNull()
    })

    it('generates the takes a short balance covers once reduced', async () => {
      withBalance(20)
      vi.mocked(router_render).mockImplementation(async (slug) =>
        rendered(slug)
      )
      const user = renderStudio(priced)
      await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
      await shootTakes(user, 4)

      await user.click(screen.getByRole('button', { name: 'Use 3 takes' }))
      expect(await estimate()).toHaveTextContent(credits(18))
      await user.click(generateButton())

      expect(
        await screen.findByRole('radio', { name: 'C' })
      ).toBeInTheDocument()
      expect(router_render).toHaveBeenCalledTimes(3)
    })

    it('keeps the zero-balance gate for a model without an estimate', async () => {
      withBalance(0)
      renderStudio()

      expect(await estimate()).toHaveTextContent(tc('cinematic.credits.varies'))
      expect(screen.queryByTestId('cinematic-generate')).toBeNull()
      expect(
        screen.getByRole('button', { name: t('workshop.run.buyCredits') })
      ).toBeInTheDocument()
    })

    it('runs an unpriced model on any balance above zero', async () => {
      withBalance(1)
      const user = renderStudio()
      await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')

      expect(generateButton()).toBeEnabled()
    })

    it('sends a member to their personal workspace instead of checkout', async () => {
      withBalance(0)
      signedIn.value = { ...credential, role: 'member' }
      const user = renderStudio(priced)

      await user.click(
        await screen.findByRole('button', {
          name: t('workshop.run.switchPersonal')
        })
      )

      expect(useWorkshopSession().remint).toHaveBeenCalledWith(undefined, {
        preserveCredentialOnTransientFailure: true
      })
      expect(
        screen.queryByRole('button', { name: t('workshop.run.buyCredits') })
      ).toBeNull()
    })

    it.for([
      {
        role: 'owner' as const,
        body: t('workshop.error.noCredits'),
        action: t('workshop.run.buyCredits'),
        other: t('workshop.run.switchPersonal')
      },
      {
        role: 'member' as const,
        body: t(
          'workshop.error.memberNoCredits',
          {
            workspace: 'Studio Team'
          },
          { locale: 'en' }
        ),
        action: t('workshop.run.switchPersonal'),
        other: t('workshop.run.buyCredits')
      }
    ])(
      'answers a take refused for credits with the $role action',
      async ({ role, body, action, other }) => {
        signedIn.value = {
          ...credential,
          role,
          workspace: { id: 'team-1', name: 'Studio Team', type: 'team' }
        }
        vi.mocked(router_render).mockRejectedValue(
          new WorkshopRouterError('noCredits')
        )
        const user = renderStudio()
        await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
        await user.click(generateButton())

        const notice = await screen.findByRole('status')
        expect(notice).toHaveTextContent(tc('cinematic.state.noCredits'))
        expect(notice).toHaveTextContent(body)
        expect(
          within(notice).getByRole('button', { name: action })
        ).toBeInTheDocument()
        expect(within(notice).queryByRole('button', { name: other })).toBeNull()
      }
    )

    it('sums up the takes of a shot the balance could not pay for', async () => {
      vi.mocked(router_render)
        .mockRejectedValueOnce(new WorkshopRouterError('noCredits'))
        .mockImplementation(async (slug) => rendered(slug))
      const user = renderStudio()
      await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
      await shootTakes(user, 4)
      await user.click(generateButton())

      const summary = await screen.findByTestId('cinematic-credit-summary')
      expect(summary).toHaveTextContent(
        tc(
          'cinematic.credits.skipped',
          { failed: 1, total: 4 },
          { locale: 'en' }
        )
      )
      expect(
        within(summary).getByRole('button', {
          name: t('workshop.run.buyCredits')
        })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Shot 1, take A' })
      ).toHaveAttribute('aria-description', tc('cinematic.state.noCredits'))
    })

    it('runs the skipped takes again once a top-up lands', async () => {
      vi.mocked(useTopUpWatch).mockReturnValue(
        computed(() => ({
          status: 'landed' as const,
          uid: credential.uid,
          workspaceId: credential.workspace.id,
          workspaceName: credential.workspace.name,
          previousCredits: 0,
          newCredits: 500,
          landedAt: 0
        }))
      )
      vi.mocked(router_render)
        .mockRejectedValueOnce(new WorkshopRouterError('noCredits'))
        .mockRejectedValueOnce(new WorkshopRouterError('noCredits'))
        .mockImplementation(async (slug) => rendered(slug))
      const user = renderStudio()
      await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
      await shootTakes(user, 3)
      await user.click(generateButton())

      await user.click(
        within(await screen.findByTestId('cinematic-credit-summary')).getByRole(
          'button',
          { name: tc('cinematic.credits.retrySkipped') }
        )
      )

      await vi.waitFor(() => expect(router_render).toHaveBeenCalledTimes(5))
      expect(screen.queryByTestId('cinematic-credit-summary')).toBeNull()
    })

    it('offers the skipped takes again once the balance rises another way', async () => {
      const amount = ref(5)
      useWorkshopCredits().balance = computed(() => ({
        status: 'ok' as const,
        credits: amount.value
      }))
      vi.mocked(router_render)
        .mockRejectedValueOnce(new WorkshopRouterError('noCredits'))
        .mockImplementation(async (slug) => rendered(slug))
      const user = renderStudio()
      await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
      await shootTakes(user, 2)
      await user.click(generateButton())

      const summary = await screen.findByTestId('cinematic-credit-summary')
      const retry = { name: tc('cinematic.credits.retrySkipped') }
      expect(within(summary).queryByRole('button', retry)).toBeNull()

      amount.value = 500
      await user.click(await within(summary).findByRole('button', retry))

      await vi.waitFor(() => expect(router_render).toHaveBeenCalledTimes(3))
    })
  })

  it.for([
    { env: 'preview', url: '?ux=hub', shown: 'cinematic-apps-hub', menu: 1 },
    { env: 'production', url: '?ux=hub', shown: 'cinematic', menu: 0 },
    { env: 'production', url: '?app=reshoot', shown: 'reshoot', menu: 0 }
  ])(
    'keeps review layouts and their menu off production ($env $url)',
    async ({ env, url, shown, menu }) => {
      deploy.env = env
      window.history.replaceState(null, '', `/cinematic-studio${url}`)
      render(CinematicStudioPage, { props: { apps: appModels, models } })

      expect(await screen.findByTestId(shown)).toBeVisible()
      expect(
        screen.queryAllByRole('button', { name: /^Layout to review/ })
      ).toHaveLength(menu)
    }
  )

  it('leads back to the apps page of the hub', async () => {
    render(CinematicStudioPage, { props: { apps: appModels, models } })

    expect(
      await screen.findByRole('link', { name: tc('cinematic.backToApps') })
    ).toHaveAttribute('href', '/hub/apps/')
  })

  it('heads the side panel as a new shot, with Shot then Format and no field labels', async () => {
    render(CinematicStudioPage, { props: { apps: appModels, models } })

    const panel = await screen.findByRole('complementary', {
      name: 'Shot settings'
    })
    expect(within(panel).queryByTestId('cinematic-advanced')).toBeNull()
    expect(
      within(panel)
        .getAllByRole('heading')
        .map((heading) => heading.textContent.trim())
    ).toEqual(['New shot'])
    expect(
      within(panel)
        .getAllByRole('region')
        .map((region) => region.getAttribute('aria-label'))
    ).toEqual(['Shot', 'Format'])
  })

  it('opens a direction part from its row in the side panel shot list', async () => {
    render(CinematicStudioPage, { props: { apps: appModels, models } })
    const user = userEvent.setup()
    const panel = await screen.findByRole('complementary', {
      name: 'Shot settings'
    })

    await user.click(within(panel).getByRole('button', { name: /^Film/ }))
    await user.click(
      within(screen.getByRole('dialog', { name: 'Film' })).getByRole('radio', {
        name: 'Daylight 250D'
      })
    )

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(
      within(panel).getByRole('button', { name: /^Film.*Daylight 250D/ })
    ).toBeInTheDocument()
  })

  it('opens the camera picker centred on its row and closes it again', async () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: Element) {
        if (this.getAttribute('data-testid') === 'cinematic-picker')
          return DOMRect.fromRect({ y: 0, height: 300 })
        if (this.getAttribute('aria-expanded') === 'true')
          return DOMRect.fromRect({ y: 400, height: 48 })
        return DOMRect.fromRect({ y: 100, height: 1000 })
      }
    )
    render(CinematicStudioPage, { props: { apps: appModels, models } })
    const user = userEvent.setup()
    const panel = await screen.findByRole('complementary', {
      name: 'Shot settings'
    })
    const camera = within(panel).getByRole('button', { name: /Large format/ })

    await user.click(camera)
    const picker = await screen.findByTestId('cinematic-picker')
    expect(camera).toHaveAttribute('aria-expanded', 'true')
    await vi.waitFor(() =>
      expect(picker.style.getPropertyValue('--anchor-top')).toBe('174px')
    )

    await user.click(camera)
    expect(screen.queryByTestId('cinematic-picker')).toBeNull()
  })

  describe('layout switch', () => {
    const panel = () =>
      screen.queryByRole('complementary', { name: 'Shot settings' })

    it('opens on the side panel and swaps to the bottom composer, remembering it in the address', async () => {
      render(CinematicStudioPage, { props: { apps: appModels, models } })
      const user = userEvent.setup()
      expect(
        await screen.findByRole('complementary', { name: 'Shot settings' })
      ).toBeInTheDocument()

      await user.click(
        await screen.findByRole('button', { name: /^Layout to review/ })
      )
      await user.click(
        await screen.findByRole('menuitemradio', {
          name: /E · Bottom composer/
        })
      )

      expect(panel()).toBeNull()
      expect(window.location.search).toBe('?ux=e')
    })

    it('asks before a layout switch would cancel a take still rendering', async () => {
      const signals: AbortSignal[] = []
      vi.mocked(router_render).mockImplementation(
        (_slug, _parameters, options) =>
          new Promise(() => {
            if (options.signal) signals.push(options.signal)
          })
      )
      render(CinematicStudioPage, { props: { apps: appModels, models } })
      const user = userEvent.setup()

      await user.type(await screen.findByLabelText('Scene'), 'A diner at dawn')
      await user.click(generateButton())
      await user.click(
        await screen.findByRole('button', { name: /^Layout to review/ })
      )
      await user.click(
        await screen.findByRole('menuitemradio', {
          name: /E · Bottom composer/
        })
      )
      const dialog = await screen.findByRole('dialog', {
        name: t('workshop.run.leaveTitle')
      })

      expect(
        screen.getByRole('complementary', {
          name: 'Shot settings',
          hidden: true
        }),
        'The layout stays put while the dialog asks'
      ).toBeInTheDocument()
      expect(signals[0].aborted).toBe(false)
      await user.click(
        within(dialog).getByRole('button', {
          name: t('workshop.run.leaveAnyway')
        })
      )
      expect(panel()).toBeNull()
      expect(signals[0].aborted).toBe(true)
    })

    it('leaves the Hub mock for the side panel when an app is picked', async () => {
      window.history.replaceState(null, '', '/cinematic-studio?ux=hub')
      render(CinematicStudioPage, { props: { apps: appModels, models } })
      const user = userEvent.setup()
      const pick = async (name: string) => {
        await user.click(
          await screen.findByRole('button', { name: /^Layout to review/ })
        )
        await user.click(await screen.findByRole('menuitemradio', { name }))
      }

      await pick('Re-shoot a video')
      expect(window.location.pathname).toBe('/hub/apps/reshoot/')
      expect(window.location.search).toBe('?ux=d')
      await pick('Cinematic Studio')

      expect(panel()).toBeInTheDocument()
    })

    it('swaps to the Re-shoot app, which has a single layout', async () => {
      window.history.replaceState(null, '', '/hub/apps/cinematic-studio/?ux=d')
      render(CinematicStudioPage, { props: { apps: appModels, models } })
      const user = userEvent.setup()

      await user.click(
        await screen.findByRole('button', { name: /^Layout to review/ })
      )
      await user.click(
        await screen.findByRole('menuitemradio', { name: 'Re-shoot a video' })
      )

      expect(
        screen.getByRole('complementary', { name: 'Your clip' })
      ).toBeInTheDocument()
      expect(panel()).toBeNull()
      expect(window.location.pathname).toBe('/hub/apps/reshoot/')
      expect(window.location.search).toBe('?ux=d')
      expect(document.title).toBe('Re-shoot a video - Comfy')
    })

    it('lists every app in the Hub apps tab', async () => {
      window.history.replaceState(
        null,
        '',
        '/hub/apps/cinematic-studio/?ux=hub'
      )
      render(CinematicStudioPage, { props: { apps: appModels, models } })

      const tab = await screen.findByRole('button', { name: 'Apps' })
      expect(tab).toHaveAttribute('aria-pressed', 'true')
      const apps = screen.getAllByRole('listitem')
      expect(apps, 'Apps that do not open yet stay off the Hub').toHaveLength(5)
      const [firstApp, secondApp, thirdApp, fourthApp, fifthApp] = apps
      expect(
        within(firstApp).getByRole('link', { name: 'Cinematic Studio' })
      ).toHaveAttribute('href', '/hub/apps/cinematic-studio/')
      expect(
        within(secondApp).getByRole('link', { name: 'Re-shoot a video' })
      ).toHaveAttribute('href', '/hub/apps/reshoot/')
      expect(
        within(thirdApp).getByRole('link', { name: 'Move anything' })
      ).toHaveAttribute('href', '/hub/apps/move-anything/')
      expect(
        within(fourthApp).getByRole('link', { name: 'Relight' })
      ).toHaveAttribute('href', '/hub/apps/relight/')
      expect(
        within(fifthApp).getByRole('link', { name: 'Background Removal' })
      ).toHaveAttribute('href', '/hub/apps/background-removal/')
    })

    it('runs a shot from the side panel on the model picked there', async () => {
      window.history.replaceState(null, '', '/hub/apps/cinematic-studio/?ux=d')
      vi.mocked(router_render).mockImplementation(async (slug) =>
        rendered(slug)
      )
      render(CinematicStudioPage, { props: { apps: appModels, models } })
      const user = userEvent.setup()

      await user.click(await screen.findByRole('button', { name: /^Model:/ }))
      const menu = await screen.findByRole('menu')
      expect(within(menu).queryByText('Model')).toBeNull()
      await user.click(
        within(menu).getByRole('menuitemradio', {
          name: new RegExp(second.name)
        })
      )
      await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
      await user.click(generateButton())

      await screen.findByAltText(/A diner at dawn/)
      expect(vi.mocked(router_render).mock.calls[0][0]).toBe(second.slug)
      expect(panel()).toBeInTheDocument()
    })
  })

  describe('side panel direction', () => {
    const renderPanel = () => {
      render(CinematicStudioPanel, { props: { models } })
      return userEvent.setup()
    }
    const gradeRow = () => screen.getByRole('button', { name: /^Grade/ })

    it('offers no character picture in video mode, where a clip drops it', async () => {
      render(CinematicStudioPanel, {
        props: { models: [...models, ...videoModels] }
      })
      const user = userEvent.setup()
      const character = () =>
        screen.queryByRole('button', { name: /character reference/i })

      expect(character()).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Video' }))

      expect(character()).toBeNull()
    })

    it('matches the grade to an uploaded image in place of a palette reference', async () => {
      const user = renderPanel()
      expect(
        screen.queryByRole('button', { name: /Add a palette reference/ })
      ).toBeNull()

      await user.click(gradeRow())
      const [firstOption] = within(
        screen.getByRole('radiogroup', { name: 'Grade' })
      ).getAllByRole('radio')
      expect(firstOption).toHaveAccessibleName(
        tc('cinematic.grade.fromImageAction')
      )
      await user.upload(
        screen.getByTestId('cinematic-grade-image-input'),
        new File(['ref'], 'colors.png', { type: 'image/png' })
      )

      expect(gradeRow()).toHaveTextContent(tc('cinematic.grade.yourPalette'))
      expect(screen.queryByRole('region', { name: 'Colors' })).toBeNull()
      const picker = screen.getByRole('dialog', { name: 'Grade' })
      expect(
        within(picker).getByRole('radio', {
          name: tc('cinematic.grade.fromImageAction')
        })
      ).toHaveAttribute('aria-checked', 'true')

      await user.click(
        within(picker).getByRole('button', { name: tc('cinematic.grade.edit') })
      )
      await user.click(
        within(picker).getByRole('button', { name: 'Remove color 1' })
      )
      expect(within(picker).getByLabelText('Color 1: #405060')).toBeVisible()
      await user.click(
        within(picker).getByRole('button', { name: tc('cinematic.grade.done') })
      )

      await user.click(
        within(picker).getByRole('radio', { name: 'Teal and orange' })
      )

      expect(gradeRow()).toHaveTextContent('Teal and orange')
      await user.click(gradeRow())
      expect(
        screen.getByRole('radio', {
          name: tc('cinematic.grade.fromImageAction')
        })
      ).toHaveAttribute('aria-checked', 'false')
    })

    it('keeps the grade as it was when a picture has no colors to read', async () => {
      const user = renderPanel()

      await user.click(gradeRow())
      await user.upload(
        screen.getByTestId('cinematic-grade-image-input'),
        new File(['x'], 'bad.png', { type: 'image/png' })
      )

      expect(
        await screen.findByText("Couldn't read colors from that image.")
      ).toBeInTheDocument()
      expect(gradeRow()).not.toHaveTextContent(
        tc('cinematic.grade.yourPalette')
      )
    })

    it('lists the camera settings beside the body as separate chips', async () => {
      const user = renderPanel()

      await user.click(screen.getByRole('button', { name: /^Camera/ }))
      await user.click(screen.getByRole('radio', { name: '85mm' }))

      expect(
        within(screen.getByTestId('camera-specs')).getByText('85mm')
      ).toBeInTheDocument()
    })

    it('steps the number of takes between one and the maximum', async () => {
      const user = renderPanel()
      const fewer = screen.getByRole('button', { name: 'Fewer takes' })
      const more = screen.getByRole('button', { name: 'More takes' })
      const count = screen.getByTestId('cinematic-takes')

      expect(fewer).toBeDisabled()
      for (let step = 1; step < MAX_TAKES; step++) await user.click(more)
      expect(count).toHaveTextContent(String(MAX_TAKES))
      expect(more).toBeDisabled()

      await user.click(fewer)
      expect(count).toHaveTextContent(String(MAX_TAKES - 1))
    })

    it('attaches the character reference straight from the scene box', async () => {
      const user = renderPanel()
      const action = tc('cinematic.reference.castAction')

      await user.upload(
        screen.getByTestId('cinematic-reference-cast'),
        new File(['ref'], 'face.png', { type: 'image/png' })
      )
      expect(
        screen.getByRole('button', { name: `${action}: face.png` })
      ).toBeInTheDocument()

      await user.click(
        screen.getByRole('button', {
          name: `${tc('cinematic.reference.remove')}: ${tc('cinematic.reference.cast')}`
        })
      )
      expect(screen.getByRole('button', { name: action })).toBeInTheDocument()
      expect(
        screen.queryByRole('button', {
          name: tc('cinematic.composer.references')
        })
      ).toBeNull()
    })

    it('offers the starting frame beside the scene in video mode', async () => {
      render(CinematicStudioPanel, {
        props: { models: [...models, ...videoModels] }
      })
      const user = userEvent.setup()

      await user.click(screen.getByRole('button', { name: 'Video' }))

      expect(
        screen.getByRole('button', {
          name: tc('cinematic.video.addFirstFrame')
        })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('heading', {
          name: tc('cinematic.section.references')
        })
      ).toBeNull()
    })
  })
})
