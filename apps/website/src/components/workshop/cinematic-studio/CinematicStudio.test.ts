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
import { runnableCinematicEditingModels } from '../../../lib/workshop/cinematic-studio/editing'
import { runnableCinematicModels } from '../../../lib/workshop/cinematic-studio/models'
import CinematicStudio from './CinematicStudio.vue'
import CinematicStudioPage from './CinematicStudioPage.vue'

vi.mock(
  import('../../../lib/workshop/cinematic-studio/reference-bundles'),
  () => ({
    saveReferenceBundle: vi.fn(async () => undefined),
    loadReferenceBundle: vi.fn()
  })
)
vi.mock(import('../../../config/workshop-session-state'))
vi.mock(import('../../../config/workshop-credits'))
vi.mock(import('../../../scripts/posthog'))
vi.mock(import('../../../config/router-render'), () => ({
  router_render: vi.fn()
}))

const models = runnableCinematicModels(getRouterWorkshopModelDetail)
const editingModels = runnableCinematicEditingModels(
  getRouterWorkshopModelDetail
)
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
  render(CinematicStudio, {
    props: {
      models: studioModels,
      editingModels: studioModels.length ? editingModels : []
    }
  })
  return userEvent.setup()
}

async function addTake(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^Format/ }))
  await user.click(screen.getByRole('button', { name: 'More takes' }))
}

const generateButton = () => screen.getByTestId('cinematic-generate')

async function confirmShot(user: ReturnType<typeof userEvent.setup>) {
  const dialog = await screen.findByRole('dialog', { name: 'Review your shot' })
  await user.click(
    within(dialog).getByRole('button', { name: 'Generate shot' })
  )
}

describe('CinematicStudio', () => {
  it.for(['increment', 'decrement', 'fixed'] as const)(
    'applies %s only after a successful reviewed run',
    async (behavior) => {
      vi.mocked(router_render).mockImplementation(async (slug) =>
        rendered(slug)
      )
      const user = renderStudio()
      await user.type(screen.getByLabelText('Scene'), 'A quiet lake')
      const seed = screen.getByRole('spinbutton', { name: 'Seed (optional)' })
      await user.type(seed, '10')
      await user.selectOptions(
        screen.getByRole('combobox', { name: 'After run' }),
        behavior
      )
      await user.click(generateButton())
      expect(seed).toHaveValue(10)
      expect(router_render).not.toHaveBeenCalled()
      await confirmShot(user)
      await vi.waitFor(() =>
        expect(seed).toHaveValue(
          behavior === 'increment' ? 11 : behavior === 'decrement' ? 9 : 10
        )
      )
      await vi.waitFor(() => expect(router_render).toHaveBeenCalledTimes(1))
      expect(vi.mocked(router_render).mock.calls[0][2].form?.values.seed).toBe(
        10
      )
    }
  )

  it('keeps the seed after a failed run and clears it for randomize', async () => {
    vi.mocked(router_render).mockRejectedValue(
      new WorkshopRouterError('unavailable')
    )
    const user = renderStudio()
    await user.type(screen.getByLabelText('Scene'), 'A quiet lake')
    const seed = screen.getByRole('spinbutton', { name: 'Seed (optional)' })
    await user.type(seed, '0')
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'After run' }),
      'increment'
    )
    await user.click(generateButton())
    await confirmShot(user)
    await vi.waitFor(() => expect(generateButton()).not.toBeDisabled())
    expect(seed).toHaveValue(0)
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'After run' }),
      'random'
    )
    expect(seed).toHaveValue(null)
  })

  it('does not advance another model after switching during a run', async () => {
    const result = Promise.withResolvers<RouterRenderResult>()
    vi.mocked(router_render).mockReturnValue(result.promise)
    const user = renderStudio()
    await user.type(screen.getByLabelText('Scene'), 'A quiet lake')
    await user.type(
      screen.getByRole('spinbutton', { name: 'Seed (optional)' }),
      '10'
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'After run' }),
      'increment'
    )
    await user.click(generateButton())
    await confirmShot(user)
    await vi.waitFor(() => expect(router_render).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole('button', { name: /^Model/ }))
    await user.click(
      await screen.findByRole('menuitemradio', {
        name: new RegExp(second.name)
      })
    )
    result.resolve(rendered(first.slug))
    await screen.findByAltText(/A quiet lake/)
    await user.click(screen.getByRole('button', { name: /^Model/ }))
    await user.click(
      await screen.findByRole('menuitemradio', { name: new RegExp(first.name) })
    )
    expect(
      screen.getByRole('spinbutton', { name: 'Seed (optional)' })
    ).toHaveValue(10)
  })
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

  it('fills editable video starters without submitting and preserves the image draft', async () => {
    const user = renderStudio()
    await user.type(screen.getByLabelText('Scene'), 'My image draft')
    await user.click(screen.getByRole('button', { name: 'Video' }))
    expect(
      screen.getByRole('heading', { name: 'Bring your scene to life.' })
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: /Slow cinematic push-in/ })
    )
    expect(screen.getByLabelText('Scene')).toHaveDisplayValue(/fisherman/)
    expect(screen.getByLabelText('Scene')).toHaveFocus()
    expect(router_render).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('dialog', { name: 'Review your shot' })
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Image' }))
    expect(screen.getByLabelText('Scene')).toHaveValue('My image draft')
  })

  it('chooses an image-compatible model and opens the real starting-frame controls', async () => {
    const user = renderStudio()
    await user.click(screen.getByRole('button', { name: 'Video' }))
    await user.click(
      screen.getByRole('button', { name: 'Choose a starting image' })
    )
    expect(
      screen.getByTestId('cinematic-reference-firstFrame')
    ).toBeInTheDocument()
    expect(router_render).not.toHaveBeenCalled()
  })

  it('keeps image and video scene drafts separate while switching modes', async () => {
    const user = renderStudio()
    await user.type(screen.getByLabelText('Scene'), 'Still frame at dawn')
    await user.click(screen.getByRole('button', { name: 'Video' }))
    expect(screen.getByLabelText('Scene')).toHaveValue('')
    await user.type(screen.getByLabelText('Scene'), 'Slow camera push in')
    await user.click(screen.getByRole('button', { name: 'Image' }))
    expect(screen.getByLabelText('Scene')).toHaveValue('Still frame at dawn')
    await user.click(screen.getByRole('button', { name: 'Video' }))
    expect(screen.getByLabelText('Scene')).toHaveValue('Slow camera push in')
    await user.click(screen.getByRole('button', { name: /Large format/ }))
    expect(screen.getByRole('dialog', { name: 'Camera' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '85mm' })).toBeVisible()
    expect(router_render).not.toHaveBeenCalled()
  })

  it('sends reviewed video settings through the model-page form and offers a download', async () => {
    vi.mocked(router_render).mockImplementation(async (slug) => ({
      ...rendered(slug),
      expectedKind: 'video',
      outputs: [{ kind: 'video', url: 'blob:clip', fileName: 'clip.mp4' }]
    }))
    const user = renderStudio()
    await user.click(screen.getByRole('button', { name: 'Video' }))
    await user.type(
      screen.getByLabelText('Scene'),
      'A slow push through the mist'
    )
    await user.click(screen.getByRole('button', { name: /^Format/ }))
    await user.selectOptions(screen.getByLabelText('Duration'), '8')
    await user.selectOptions(screen.getByLabelText('Resolution'), '1080p')
    await user.click(screen.getByLabelText('Generate audio'))
    await user.click(generateButton())
    expect(
      screen.getByRole('dialog', { name: 'Review your shot' })
    ).toHaveTextContent('1080p · 8s')
    expect(router_render).not.toHaveBeenCalled()
    await confirmShot(user)
    const download = await screen.findByRole('link', {
      name: tc('cinematic.stage.download')
    })
    expect(download).toHaveAttribute('href', 'blob:clip')
    expect(download).toHaveAttribute('download', 'clip.mp4')
    expect(router_render).toHaveBeenCalledTimes(1)
    const [slug, parameters, options] = vi.mocked(router_render).mock.calls[0]
    expect(slug).toContain('text-to-video')
    expect(parameters).toEqual({})
    expect(options.form?.values).toMatchObject({
      duration: 8,
      resolution: '1080p',
      generate_audio: true,
      ratio: '16:9'
    })
    expect(options.form?.values.prompt).toContain('continuous action')
    expect(options.form?.values.prompt).not.toContain('film still')
  })

  it('animates a generated image using the actual starting frame, without catalogue sample frames', async () => {
    vi.mocked(router_render).mockImplementation(async (slug) => rendered(slug))
    const user = renderStudio()
    await user.type(screen.getByLabelText('Scene'), 'A lighthouse at dawn')
    await user.click(generateButton())
    await confirmShot(user)
    await user.click(
      await screen.findByRole('button', { name: 'Animate image' })
    )
    await vi.waitFor(() =>
      expect(screen.getByRole('button', { name: 'Video' })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    )
    await user.type(
      screen.getByLabelText('Scene'),
      'Waves roll past the lighthouse'
    )
    await user.click(generateButton())
    expect(
      screen.getByRole('dialog', { name: 'Review your shot' })
    ).toHaveTextContent('shot.png')
    await confirmShot(user)
    await vi.waitFor(() => expect(router_render).toHaveBeenCalledTimes(2))
    const [slug, , options] = vi.mocked(router_render).mock.calls[1]
    expect(slug).toContain('first-last-frame')
    expect(options.form?.values.first_frame_url).toMatchObject({
      file: expect.any(File),
      name: 'shot.png'
    })
    expect(options.form?.values.last_frame_url).toBeFalsy()
  })

  it('requires an uploaded starting frame and includes the optional ending frame in review and request', async () => {
    window.history.replaceState(
      null,
      '',
      '/cinematic-studio?model=byteplus--seedance-2-5-first-last-frame--animate-images'
    )
    vi.mocked(router_render).mockImplementation(async (slug) => ({
      ...rendered(slug),
      expectedKind: 'video',
      outputs: [{ kind: 'video', url: 'blob:clip', fileName: 'clip.mp4' }]
    }))
    const user = renderStudio()
    await user.type(
      screen.getByLabelText('Scene'),
      'A slow transition into sunset'
    )
    expect(generateButton()).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /^Format/ }))
    expect(
      screen.getByText('Add a starting frame before reviewing this video.')
    ).toBeVisible()
    const firstFrame = new File(['first'], 'start.png', { type: 'image/png' })
    const lastFrame = new File(['last'], 'end.png', { type: 'image/png' })
    await user.upload(
      screen.getByTestId('cinematic-reference-firstFrame'),
      firstFrame
    )
    await user.upload(
      screen.getByTestId('cinematic-reference-lastFrame'),
      lastFrame
    )
    await user.click(generateButton())
    const review = screen.getByRole('dialog', { name: 'Review your shot' })
    expect(review).toHaveTextContent('start.png, end.png')
    await confirmShot(user)
    await screen.findByLabelText('Generated video')
    const values = vi.mocked(router_render).mock.calls[0][2].form?.values
    expect(values?.first_frame_url).toMatchObject({ file: firstFrame })
    expect(values?.last_frame_url).toMatchObject({ file: lastFrame })
  })

  it('reviews an edit with the selected source and preserves instructions when returning', async () => {
    vi.mocked(router_render).mockImplementation(async (slug) => rendered(slug))
    const user = renderStudio()
    await user.type(screen.getByLabelText('Scene'), 'A traveler by the sea')
    await user.click(generateButton())
    await confirmShot(user)
    await user.click(await screen.findByRole('button', { name: 'Edit image' }))
    const editor = await screen.findByRole('dialog', {
      name: 'Edit this frame'
    })
    await user.click(
      within(editor).getByRole('button', { name: 'Camera view' })
    )
    const instruction = within(editor).getByRole('textbox', {
      name: 'Edit instruction'
    })
    await user.clear(instruction)
    await user.type(
      instruction,
      'Move the camera to the left. Keep the red coat.'
    )
    await user.click(within(editor).getByRole('button', { name: /Review/ }))
    const review = screen.getByRole('dialog', { name: 'Review your shot' })
    expect(review).toHaveTextContent('shot.png')
    expect(review).toHaveTextContent('Keep the red coat.')
    expect(router_render).toHaveBeenCalledTimes(1)
    await user.click(
      within(review).getByRole('button', { name: 'Back to editing' })
    )
    expect(instruction).toHaveValue(
      'Move the camera to the left. Keep the red coat.'
    )
    await user.click(within(editor).getByRole('button', { name: /Review/ }))
    await confirmShot(user)
    await vi.waitFor(() => expect(router_render).toHaveBeenCalledTimes(2))
    const [slug, parameters, options] = vi.mocked(router_render).mock.calls[1]
    expect(slug).toContain('edit-images')
    expect(parameters).toEqual({})
    expect(options.form?.values.prompt).toContain('Keep the red coat.')
    expect(options.form?.values.images).toEqual([
      expect.objectContaining({ file: expect.any(File) })
    ])
  })

  it('does not submit remaining variations after a provider failure', async () => {
    vi.mocked(router_render).mockRejectedValue(
      new WorkshopRouterError('provider')
    )
    const user = renderStudio()
    await user.type(screen.getByLabelText('Scene'), 'A quiet harbor')
    await addTake(user)
    await user.click(generateButton())
    await confirmShot(user)
    await vi.waitFor(() => expect(router_render).toHaveBeenCalledTimes(1))
    await user.click(
      await screen.findByRole('button', {
        name: tc('cinematic.stage.thumb')
          .replace('{shot}', '1')
          .replace('{take}', 'B')
      })
    )
    expect(await screen.findByRole('status')).toHaveTextContent(
      t('workshop.output.cancelled')
    )
    expect(router_render).toHaveBeenCalledTimes(1)
  })

  it('renders one Router request per take with the directed prompt', async () => {
    vi.mocked(router_render).mockImplementation(async (slug) => rendered(slug))
    const user = renderStudio()

    await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
    await addTake(user)
    await user.click(generateButton())
    await confirmShot(user)

    expect(await screen.findByRole('radio', { name: 'B' })).toBeInTheDocument()
    expect(router_render).toHaveBeenCalledTimes(2)
    const [slug, parameters, options] = vi.mocked(router_render).mock.calls[0]
    expect(slug).toBe(first.slug)
    expect(parameters).toEqual({})
    expect(options.form?.values).toMatchObject({
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

  it('lets the user inspect and dismiss a shot without submitting it', async () => {
    const user = renderStudio()
    await user.type(screen.getByLabelText('Scene'), 'A lighthouse in a storm')
    await addTake(user)
    await user.click(generateButton())

    const dialog = await screen.findByRole('dialog', {
      name: 'Review your shot'
    })
    expect(dialog).toHaveTextContent(first.name)
    expect(dialog).toHaveTextContent('A lighthouse in a storm')
    expect(dialog).toHaveTextContent('21:9 · 2K')
    expect(dialog).toHaveTextContent('Each take is a separate generation')
    expect(router_render).not.toHaveBeenCalled()
    expect(fetchData).not.toHaveBeenCalled()

    await user.click(
      within(dialog).getByRole('button', {
        name: 'Back to editing'
      })
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByLabelText('Scene')).toHaveValue(
      'A lighthouse in a storm'
    )
    await vi.waitFor(() => expect(generateButton()).toHaveFocus())
    expect(router_render).not.toHaveBeenCalled()
  })

  it('requires a new review after switching the paying workspace', async () => {
    vi.mocked(router_render).mockImplementation(async (slug) => rendered(slug))
    const user = renderStudio()
    await user.type(screen.getByLabelText('Scene'), 'A lighthouse in a storm')
    await user.click(generateButton())
    const dialog = await screen.findByRole('dialog', {
      name: 'Review your shot'
    })

    signedIn.value = {
      ...credential,
      workspace: { ...credential.workspace, id: 'workspace-2' }
    }
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(dialog).not.toBeInTheDocument()
    expect(screen.getByLabelText('Scene')).toHaveValue('')
    expect(router_render).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('Scene'), 'A lighthouse in a storm')
    await user.click(generateButton())
    await confirmShot(user)
    await screen.findByAltText(/A lighthouse in a storm/)
    expect(router_render).toHaveBeenCalledTimes(1)
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
    await confirmShot(user)

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
    await confirmShot(user)

    const notice = await screen.findByRole('status')
    expect(notice).toHaveTextContent(t('workshop.error.provider'))
    expect(notice).toHaveTextContent('request-9')
    await user.click(
      within(notice).getByRole('button', {
        name: tc('cinematic.state.tryOn').replace('{model}', second.name)
      })
    )

    await confirmShot(user)
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
    await confirmShot(user)
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
    await confirmShot(user)
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
    await confirmShot(user)
    await screen.findByAltText(/A diner at dawn/)
    expect(
      vi.mocked(router_render).mock.calls[0][2].form?.values.prompt
    ).toContain('Neon light')
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
    await confirmShot(user)

    await screen.findByAltText(/A diner at dawn/)
    const [slug, parameters, options] = vi.mocked(router_render).mock.calls[0]
    expect(slug).toBe('byteplus--seedream-4-5--edit-images')
    expect(parameters).toEqual({})
    expect(options.form?.values.images).toEqual([
      expect.objectContaining({ file: face, name: face.name })
    ])
    expect(options.form?.values.prompt).toContain(
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
    await confirmShot(user)
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      t('workshop.output.cancelled')
    )
    expect(signals).toHaveLength(1)
    expect(signals[0].aborted).toBe(true)
  })

  it('asks before a link leaves a take that is still rendering', async () => {
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
    const user = renderStudio()
    const away = document.body.appendChild(document.createElement('a'))
    away.href = '/pricing'
    away.textContent = 'Pricing'

    await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
    await user.click(generateButton())
    await confirmShot(user)
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
  })

  it('moves between takes with the arrow keys', async () => {
    vi.mocked(router_render).mockImplementation(async (slug) => rendered(slug))
    const user = renderStudio()
    await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
    await addTake(user)
    await user.click(generateButton())
    await confirmShot(user)

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
    await confirmShot(user)
    await screen.findByAltText(/A diner at dawn/)

    await user.click(
      screen.getByRole('button', { name: tc('cinematic.stage.useAsReference') })
    )
    await user.click(
      screen.getByRole('button', { name: tc('cinematic.stage.again') })
    )

    await confirmShot(user)
    await vi.waitFor(() => expect(router_render).toHaveBeenCalledTimes(2))
    const [slug, parameters, options] = vi.mocked(router_render).mock.calls[1]
    expect(slug).toBe('byteplus--seedream-4-5--edit-images')
    expect(parameters).toEqual({})
    expect(options.form?.values.images).toEqual([
      expect.objectContaining({ file: expect.any(File), name: 'shot.png' })
    ])
    expect(options.form?.values.prompt).toContain(
      'Keep the character from reference image 1.'
    )
  })

  it('renders sample frames in demo mode without calling the Router', async () => {
    window.history.replaceState(null, '', '/cinematic-studio?demo=1')
    signedIn.value = undefined
    const user = renderStudio()

    await user.type(screen.getByLabelText('Scene'), 'A diner at dawn')
    await user.click(generateButton())
    await confirmShot(user)

    const frame = await screen.findByAltText(
      /A diner at dawn/,
      {},
      { timeout: 3000 }
    )
    expect(frame.getAttribute('src')).toMatch(/^\/images\/cinematic-studio\//)
    expect(router_render).not.toHaveBeenCalled()
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
      await confirmShot(user)

      await screen.findByAltText(/A diner at dawn/)
      expect(vi.mocked(router_render).mock.calls[0][0]).toBe(second.slug)
      expect(panel()).toBeInTheDocument()
    })
  })
})
