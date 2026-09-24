import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import type { AccountCredential } from '@comfyorg/account-core/session'

import { router_render } from '../../../config/router-render'
import type { RouterRenderResult } from '../../../config/router-render'
import { useWorkshopCredits } from '../../../config/workshop-credits'
import { getRouterWorkshopModelDetail } from '../../../config/workshop-router-content'
import { WorkshopRouterError } from '../../../config/workshop-router-errors'
import { useWorkshopSession } from '../../../config/workshop-session-state'
import { prepareModelPage } from '../../../routes/models/model-page'
import {
  useWorkshopEnabled,
  useWorkshopEnabledSettled
} from '../../../scripts/posthog'
import { t } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/models'
import { runnableCinematicModels } from '../../../lib/workshop/cinematic-studio/models'
import CinematicStudio from './CinematicStudio.vue'
import CinematicStudioPage from './CinematicStudioPage.vue'

vi.mock(import('../../../config/workshop-session-state'))
vi.mock(import('../../../config/workshop-credits'))
vi.mock(import('../../../scripts/posthog'))
vi.mock(import('../../../config/router-render'), () => ({
  router_render: vi.fn()
}))

const models = runnableCinematicModels(getRouterWorkshopModelDetail)
const [first, second] = models

const { fetchData } = vi.hoisted(() => ({ fetchData: vi.fn<typeof fetch>() }))

async function servePageData(input: RequestInfo | URL) {
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
    vi.mocked(router_render).mockReset()
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

  it('reports a failed take in the stage', async () => {
    vi.mocked(router_render).mockRejectedValue(
      new WorkshopRouterError('provider')
    )
    const user = renderStudio()

    await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
    await user.click(generateButton())

    expect(await screen.findByRole('status')).toHaveTextContent(
      t('workshop.error.provider')
    )
  })

  it('does not offer to generate when no model can run', () => {
    renderStudio([])

    expect(generateButton()).toBeDisabled()
    expect(
      screen.getByText(tc('cinematic.output.unavailable'))
    ).toBeInTheDocument()
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
      screen.getByRole('button', { name: 'Extreme wide' })
    ).toBeInTheDocument()
  })

  it('writes a picked option into the chip and the prompt', async () => {
    vi.mocked(router_render).mockImplementation(async (slug) => rendered(slug))
    const user = renderStudio()

    await user.click(screen.getByRole('button', { name: 'Practical night' }))
    const picker = screen.getByRole('dialog', { name: 'Light' })
    await user.click(within(picker).getByRole('radio', { name: 'Neon' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: 'Neon' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
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
    const [, parameters] = vi.mocked(router_render).mock.calls[0]
    expect(parameters?.reference_images).toEqual([face])
    expect(parameters?.prompt).toContain(
      'Keep the character from reference image 1.'
    )
  })

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
    const chip = screen.getByRole('button', { name: 'Practical night' })

    await user.click(chip)
    expect(screen.getByRole('radio', { name: 'Practical night' })).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(chip).toHaveFocus()
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
