import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import type { AccountCredential } from '@comfyorg/account-core/session'

import {
  resolveModelRouterRender,
  router_render
} from '../../../config/router-render'
import type {
  PreparedRouterRender,
  RouterRenderResult
} from '../../../config/router-render'
import {
  useTopUpWatch,
  useWorkshopCredits
} from '../../../config/workshop-credits'
import { getRouterWorkshopModelDetail } from '../../../config/workshop-router-content'
import { WorkshopRouterError } from '../../../config/workshop-router-errors'
import { useWorkshopSession } from '../../../config/workshop-session-state'
import { prepareModelPage } from '../../../routes/models/model-page'
import {
  useWorkshopEnabled,
  useWorkshopEnabledSettled,
  useWorkshopWorkflowsEnabled
} from '../../../scripts/posthog'
import { t } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/models'
import { runnableCinematicModels } from '../../../lib/workshop/cinematic-studio/models'
import CinematicStudio from './CinematicStudio.vue'
import CinematicStudioPage from './CinematicStudioPage.vue'
import CinematicStudioPanel from './CinematicStudioPanel.vue'

vi.mock(import('../../../config/workshop-session-state'))
vi.mock(import('../../../config/workshop-credits'))
vi.mock(import('../../../scripts/posthog'))
vi.mock(import('../../../config/router-render'), { spy: true })

const models = runnableCinematicModels(getRouterWorkshopModelDetail)
const [first, second] = models

const { fetchData } = vi.hoisted(() => ({ fetchData: vi.fn<typeof fetch>() }))

async function servePageData(input: RequestInfo | URL) {
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

async function addTake(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^Format/ }))
  await user.click(screen.getByRole('button', { name: 'More takes' }))
}

const generateButton = () => screen.getByTestId('cinematic-generate')

describe('CinematicStudio', () => {
  beforeEach(() => {
    vi.stubEnv('PUBLIC_WORKSHOP_ROUTER_RUN', '1')
    vi.mocked(useWorkshopEnabled).mockReturnValue(computed(() => true))
    vi.mocked(useWorkshopEnabledSettled).mockReturnValue(computed(() => true))
    vi.mocked(useWorkshopWorkflowsEnabled).mockReturnValue(computed(() => true))
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
    vi.mocked(router_render)
      .mockReset()
      .mockRejectedValue(new WorkshopRouterError('client'))
    vi.stubGlobal('fetch', fetchData)
    fetchData.mockImplementation(servePageData)
    window.history.replaceState(null, '', '/cinematic-studio')
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
    await addTake(user)
    await user.click(generateButton())

    expect(await screen.findByRole('radio', { name: 'B' })).toBeInTheDocument()
    expect(router_render).toHaveBeenCalledTimes(2)
    const [slug, parameters, options] = vi.mocked(router_render).mock.calls[0]
    expect(slug).toBe(first.slug)
    expect(parameters).toMatchObject({
      aspect_ratio: '21:9',
      resolution: 2048,
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
    expect(screen.getByText(`${first.name} · 21:9`)).toBeInTheDocument()
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
        name: `Model · via Comfy Router: ${second.name}`
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
        name: tc('cinematic.state.tryOn').replace('{model}', second.name)
      })
    )

    await screen.findByAltText(/A diner at dawn/)
    expect(vi.mocked(router_render).mock.calls[1][0]).toBe(second.slug)
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
      screen.getByRole('button', { name: /^Direction: Shot: Extreme wide/ })
    ).toBeInTheDocument()
  })

  it('writes a picked option into the direction chip and the prompt', async () => {
    vi.mocked(router_render).mockImplementation(async (slug) => rendered(slug))
    const user = renderStudio()

    await user.click(screen.getByRole('button', { name: /^Direction:/ }))
    const picker = screen.getByRole('dialog', { name: 'Direction' })
    await user.click(within(picker).getByRole('button', { name: /^Light/ }))
    await user.click(within(picker).getByRole('radio', { name: 'Neon' }))
    expect(
      within(picker).getByRole('button', { name: 'Film' })
    ).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(picker).getByRole('button', { name: /^Look/ }))
    await user.click(within(picker).getByRole('radio', { name: 'Western' }))

    expect(picker).toBeInTheDocument()
    await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(
      screen.getByRole('button', {
        name: /^Direction: Shot: Medium, Light: Neon, .*Look: Western/
      })
    ).toBeInTheDocument()
    await user.click(generateButton())
    await screen.findByAltText(/A diner at dawn/)
    expect(vi.mocked(router_render).mock.calls[0][1]?.prompt).toContain(
      'Neon light'
    )
  })

  it('keeps the camera picker open across columns until clicked away', async () => {
    const user = renderStudio()

    await user.click(screen.getByRole('button', { name: /Large format/ }))
    const picker = screen.getByRole('dialog', { name: 'Camera' })
    await user.click(within(picker).getByRole('radio', { name: '85mm' }))
    await user.click(within(picker).getByRole('radio', { name: 'f/4' }))

    expect(picker).toBeInTheDocument()
    await user.click(screen.getByLabelText('Scene'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByLabelText('Scene')).toHaveFocus()
    expect(
      screen.getByRole('button', { name: /Large format/ })
    ).toHaveTextContent('85mm')
  })

  it('sends a character reference with the prompt that names it', async () => {
    vi.mocked(router_render).mockImplementation(async (slug) => rendered(slug))
    const user = renderStudio()
    const face = new File(['face'], 'mara.png', { type: 'image/png' })

    await user.click(
      screen.getByRole('button', { name: tc('cinematic.composer.references') })
    )
    await user.upload(screen.getByTestId('cinematic-reference-cast'), face)
    await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
    await user.click(generateButton())

    await screen.findByAltText(/A diner at dawn/)
    const [slug, parameters] = vi.mocked(router_render).mock.calls[0]
    expect(slug).toBe(first.referenceSlug)
    expect(parameters?.reference_images).toEqual([face])
    expect(parameters?.prompt).toContain(
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
    await user.upload(screen.getByTestId('cinematic-reference-cast'), face)
    await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')

    expect(generateButton()).toBeDisabled()
    expect(
      screen.getByText(
        tc('cinematic.references.unsupported').replace(
          '{model}',
          dropsReferences.name
        )
      )
    ).toBeInTheDocument()
    expect(router_render).not.toHaveBeenCalled()
  })

  it.for([
    {
      layout: 'the stage',
      ux: '',
      inFormat: true,
      settlement: 'pending' as const
    },
    {
      layout: 'the stage',
      ux: '',
      inFormat: true,
      settlement: 'terminal' as const
    },
    {
      layout: 'the side panel',
      ux: '?ux=d',
      inFormat: false,
      settlement: 'pending' as const
    }
  ])(
    'tries only the failed take again on $layout after a $settlement failure',
    async ({ ux, inFormat, settlement }) => {
      window.history.replaceState(null, '', `/cinematic-studio${ux}`)
      const first: {
        key: unknown
        prepared: PreparedRouterRender
      }[] = []
      vi.mocked(router_render).mockImplementation(
        async (slug, parameters, options) => {
          if (first.length >= 2) return rendered(slug)
          const prepared = {
            ...resolveModelRouterRender(options.model, parameters),
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
      render(CinematicStudioPage, { props: { models } })
      const user = userEvent.setup()

      await user.type(await screen.findByLabelText('Scene'), 'A diner at dawn')
      if (inFormat)
        await user.click(screen.getByRole('button', { name: /^Format/ }))
      await user.click(screen.getByRole('button', { name: 'More takes' }))
      await user.click(generateButton())
      await user.click(await screen.findByRole('radio', { name: 'B' }))
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
    await addTake(user)
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
    const chip = screen.getByRole('button', { name: /^Direction:/ })

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
    const [, parameters] = vi.mocked(router_render).mock.calls[1]
    expect(parameters?.reference_images).toEqual([expect.any(File)])
    expect(parameters?.prompt).toContain(
      'Keep the character from reference image 1.'
    )
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
    const [, parameters] = vi.mocked(router_render).mock.calls[1]
    expect(parameters?.reference_images).toBeUndefined()
  })

  it('renders sample frames in demo mode without calling the Router', async () => {
    window.history.replaceState(null, '', '/cinematic-studio?demo=1')
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

  it('withholds the studio from visitors outside the staff rollout', async () => {
    vi.mocked(useWorkshopWorkflowsEnabled).mockReturnValue(
      computed(() => false)
    )
    render(CinematicStudioPage, { props: { models } })

    expect(
      await screen.findByText(tc('cinematic.unavailable.title'))
    ).toBeInTheDocument()
    expect(screen.queryByTestId('cinematic')).toBeNull()
  })

  describe('credits', () => {
    const priced: readonly CinematicModel[] = models.map((model) =>
      model.slug === first.slug
        ? {
            ...model,
            prices: {
              '21:9 2K 0': { min: 6, max: 6 },
              '21:9 1K 0': { min: 3, max: 3 }
            }
          }
        : model
    )
    const estimate = () => screen.findByTestId('cinematic-estimate')
    const credits = (amount: number) =>
      tc('cinematic.credits.estimate').replace('{credits}', String(amount))

    async function shootTakes(
      user: ReturnType<typeof userEvent.setup>,
      takes: number
    ) {
      await user.click(screen.getByRole('button', { name: /^Format/ }))
      const more = screen.getByRole('button', { name: 'More takes' })
      for (let shown = 1; shown < takes; shown++) await user.click(more)
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

      await addTake(user)
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
        body: t('workshop.error.memberNoCredits').replace(
          '{workspace}',
          'Studio Team'
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
        tc('cinematic.credits.skipped')
          .replace('{failed}', '1')
          .replace('{total}', '4')
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
  })

  describe('layout switch', () => {
    const panel = () =>
      screen.queryByRole('complementary', { name: 'Shot settings' })

    it('swaps to the side panel layout and remembers it in the address', async () => {
      render(CinematicStudioPage, { props: { models } })
      const user = userEvent.setup()
      expect(panel()).toBeNull()

      await user.click(
        await screen.findByRole('button', { name: /^Layout to review/ })
      )
      await user.click(
        await screen.findByRole('menuitemradio', { name: /D · Side panel/ })
      )

      expect(panel()).toBeInTheDocument()
      expect(window.location.search).toBe('?ux=d')
    })

    it('asks before a layout switch would cancel a take still rendering', async () => {
      const signals: AbortSignal[] = []
      vi.mocked(router_render).mockImplementation(
        (_slug, _parameters, options) =>
          new Promise(() => {
            if (options.signal) signals.push(options.signal)
          })
      )
      render(CinematicStudioPage, { props: { models } })
      const user = userEvent.setup()

      await user.type(await screen.findByLabelText('Scene'), 'A diner at dawn')
      await user.click(generateButton())
      await user.click(
        await screen.findByRole('button', { name: /^Layout to review/ })
      )
      await user.click(
        await screen.findByRole('menuitemradio', { name: /D · Side panel/ })
      )
      const dialog = await screen.findByRole('dialog', {
        name: t('workshop.run.leaveTitle')
      })

      expect(panel()).toBeNull()
      expect(signals[0].aborted).toBe(false)
      await user.click(
        within(dialog).getByRole('button', {
          name: t('workshop.run.leaveAnyway')
        })
      )
      expect(panel()).toBeInTheDocument()
      expect(signals[0].aborted).toBe(true)
    })

    it('swaps to the Re-shoot app, which has a single layout', async () => {
      window.history.replaceState(null, '', '/cinematic-studio?ux=d')
      render(CinematicStudioPage, { props: { models } })
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
      expect(window.location.search).toBe('?ux=d&app=reshoot')
    })

    it('lists Cinematic Studio first and Re-shoot a video next in the Hub apps tab', async () => {
      window.history.replaceState(null, '', '/cinematic-studio?ux=hub')
      render(CinematicStudioPage, { props: { models } })

      const tab = await screen.findByRole('button', { name: 'Apps' })
      expect(tab).toHaveAttribute('aria-pressed', 'true')
      const [firstApp, secondApp] = screen.getAllByRole('listitem')
      expect(
        within(firstApp).getByRole('link', { name: 'Cinematic Studio' })
      ).toHaveAttribute('href', '/cinematic-studio?ux=e')
      expect(
        within(secondApp).getByRole('link', { name: 'Re-shoot a video' })
      ).toHaveAttribute('href', expect.stringContaining('crossview_warp_h3'))
    })

    it('runs a shot from the side panel on the model picked there', async () => {
      window.history.replaceState(null, '', '/cinematic-studio?ux=d')
      vi.mocked(router_render).mockImplementation(async (slug) =>
        rendered(slug)
      )
      render(CinematicStudioPage, { props: { models } })
      const user = userEvent.setup()

      await user.click(
        await screen.findByRole('button', { name: /^Model · via Comfy Router/ })
      )
      await user.click(
        await screen.findByRole('menuitemradio', {
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
})
