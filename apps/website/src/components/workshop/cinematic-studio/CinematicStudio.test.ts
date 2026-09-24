import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import type { AccountCredential } from '@comfyorg/account-core/session'

import type { ModelsPageData } from '../../../config/models-page-data'
import { fetchModelsPage } from '../../../config/models-page-data'
import { router_render } from '../../../config/router-render'
import { useWorkshopCredits } from '../../../config/workshop-credits'
import { WorkshopRouterError } from '../../../config/workshop-router-errors'
import { useWorkshopSession } from '../../../config/workshop-session-state'
import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/catalog'
import { useWorkshopEnabled } from '../../../scripts/posthog'
import { t } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import CinematicStudio from './CinematicStudio.vue'

vi.mock(import('../../../config/workshop-session-state'))
vi.mock(import('../../../config/workshop-credits'))
vi.mock(import('../../../scripts/posthog'))
vi.mock(import('../../../config/models-page-data'), () => ({
  fetchModelsPage: vi.fn()
}))
vi.mock(import('../../../config/router-render'), () => ({
  router_render: vi.fn(),
  resolveModelRouterRender: vi.fn()
}))

const models: CinematicModel[] = [
  {
    slug: 'bfl--flux-2-pro--generate-images',
    name: 'FLUX.2 Pro',
    provider: 'Black Forest Labs',
    logo: '/icons/ai-models/bfl.svg'
  }
]

const detail: ModelsPageData['model'] = {
  slug: 'bfl--flux-2-pro--generate-images',
  name: 'FLUX.2 Pro',
  workflowCount: 0,
  href: '/models/bfl--flux-2-pro--generate-images/',
  routerId: 'bfl/flux-2-pro',
  capabilities: [],
  fields: [],
  defaults: {},
  examples: []
}

const page: ModelsPageData = {
  kind: 'page',
  model: detail,
  related: [],
  relatedHeading: '',
  relatedHeadingShort: '',
  tags: [],
  shownTags: [],
  restTags: [],
  restTagCount: 0
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

function renderStudio() {
  render(CinematicStudio, { props: { models } })
  return userEvent.setup()
}

const generateButton = () => screen.getByTestId('cinematic-generate')

describe('CinematicStudio', () => {
  beforeEach(() => {
    vi.stubEnv('PUBLIC_WORKSHOP_ROUTER_RUN', '1')
    vi.mocked(useWorkshopEnabled).mockReturnValue(computed(() => true))
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
    vi.mocked(fetchModelsPage).mockResolvedValue(page)
    vi.mocked(router_render).mockReset()
  })

  it('waits for a scene before it can generate', async () => {
    const user = renderStudio()
    expect(generateButton()).toBeDisabled()

    await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')

    expect(generateButton()).toBeEnabled()
  })

  it('renders one Router request per take with the directed prompt', async () => {
    vi.mocked(router_render).mockImplementation(async () => ({
      slug: detail.slug,
      routerId: detail.routerId,
      expectedKind: 'image',
      requestId: 'request-1',
      deadlineCollections: 0,
      outputs: [{ kind: 'image', url: 'blob:shot', fileName: 'shot.png' }]
    }))
    const user = renderStudio()

    await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
    await user.click(screen.getByRole('button', { name: 'More takes' }))
    await user.click(generateButton())

    expect(await screen.findByRole('tab', { name: 'B' })).toBeInTheDocument()
    expect(router_render).toHaveBeenCalledTimes(2)
    const [slug, parameters, options] = vi.mocked(router_render).mock.calls[0]
    expect(slug).toBe(detail.slug)
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
    expect(options.model).toBe(detail)
    expect(screen.getByAltText(/A diner at dawn/)).toHaveAttribute(
      'src',
      'blob:shot'
    )
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

  it('asks a signed-out visitor to sign in instead of generating', async () => {
    signedIn.value = undefined
    renderStudio()

    expect(
      await screen.findByRole('link', { name: t('workshop.run.signIn') })
    ).toBeInTheDocument()
    expect(screen.queryByTestId('cinematic-generate')).toBeNull()
  })

  it('writes a picked option into the tile and the prompt', async () => {
    const user = renderStudio()

    await user.click(screen.getByRole('button', { name: /Light/ }))
    const picker = screen.getByRole('dialog', { name: 'Light' })
    await user.click(within(picker).getByRole('radio', { name: 'Neon' }))
    await user.click(within(picker).getByRole('button', { name: 'Done' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: /Light/ })).toHaveTextContent(
      'Neon'
    )
    await user.click(screen.getByRole('button', { name: 'View full prompt' }))
    expect(screen.getByTestId('cinematic-full-prompt')).toHaveTextContent(
      'Neon light'
    )
  })

  it('opens the API request from the tool bar instead of a tab', async () => {
    const user = renderStudio()
    expect(screen.queryByRole('tablist')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'API' }))

    expect(
      await screen.findByRole('dialog', {
        name: tc('cinematic.api.title')
      })
    ).toBeInTheDocument()
  })

  it('sends a character reference with the prompt that names it', async () => {
    vi.mocked(router_render).mockResolvedValue({
      slug: detail.slug,
      routerId: detail.routerId,
      expectedKind: 'image',
      requestId: 'request-1',
      deadlineCollections: 0,
      outputs: [{ kind: 'image', url: 'blob:shot', fileName: 'shot.png' }]
    })
    const user = renderStudio()
    const face = new File(['face'], 'mara.png', { type: 'image/png' })

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

  it('moves focus into a picker and back to its tile on Escape', async () => {
    const user = renderStudio()
    const tile = screen.getByRole('button', { name: /Light/ })

    await user.click(tile)
    expect(screen.getByRole('radio', { name: 'Practical night' })).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(tile).toHaveFocus()
  })
})
