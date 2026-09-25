import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, ref } from 'vue'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { useCinematicEnhancement } from './useCinematicEnhancement'
import { cinematicEnhancementModel } from '../lib/workshop/cinematic-studio/enhancement-model'
import { useWorkshopSession } from '../config/workshop-session-state'
import type { WorkshopSession } from '../config/workshop-session-state'
import {
  useWorkshopCredits,
  refreshWorkshopCredits
} from '../config/workshop-credits'
import { useWorkshopEnabled } from '../scripts/posthog'
import { router_render } from '../config/router-render'
import type { RouterRenderResult } from '../config/router-render'
import { releaseRouterOutputs } from '../config/workshop-response'
import CinematicEnhancer from '../components/workshop/cinematic-studio/CinematicEnhancer.vue'

vi.mock(import('../config/workshop-session-state'))
vi.mock(import('../config/workshop-credits'))
vi.mock(import('../scripts/posthog'))
vi.mock(import('../config/router-render'), () => ({ router_render: vi.fn() }))
vi.mock(import('../config/workshop-response'), () => ({
  releaseRouterOutputs: vi.fn()
}))
const model = cinematicEnhancementModel()!
const account: WorkshopSession = {
  token: 'test-token',
  expiresAt: Date.now() + 60000,
  uid: 'user-1',
  workspace: { id: 'workspace-1', name: 'Personal', type: 'personal' },
  role: 'owner',
  permissions: []
}
const identity = ref<WorkshopSession | undefined>(account)
const scene = ref('  A boat.\nKEEP COPY  ')
const namespace = ref('user-1/workspace-1')
const response = (): RouterRenderResult => ({
  slug: model.slug,
  routerId: model.routerId,
  expectedKind: 'text',
  requestId: 'request-test',
  deadlineCollections: 0,
  outputs: [
    {
      kind: 'text',
      url: 'blob:reply',
      fileName: 'reply.json',
      text: JSON.stringify({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Gentle ripples.' }],
        usage: { input_tokens: 10, output_tokens: 5 }
      })
    }
  ]
})
function harness() {
  let run!: ReturnType<typeof useCinematicEnhancement>
  const view = render(
    defineComponent({
      setup() {
        run = useCinematicEnhancement({
          model: () => model,
          input: () => ({
            scene: scene.value,
            directions: 'Static camera.',
            mode: 'image'
          }),
          namespace: () => namespace.value
        })
        return () => h('div')
      }
    })
  )
  return { run, view }
}
describe('cinematic enhancement execution', () => {
  beforeEach(() => {
    vi.stubEnv('PUBLIC_WORKSHOP_ROUTER_RUN', '1')
    window.history.replaceState(null, '', '/cinematic-studio')
    identity.value = account
    scene.value = '  A boat.\nKEEP COPY  '
    namespace.value = 'user-1/workspace-1'
    vi.mocked(useWorkshopEnabled).mockReturnValue(computed(() => true))
    const session = useWorkshopSession()
    session.session = computed(() => identity.value)
    vi.mocked(session.ensureFresh).mockResolvedValue({
      status: 'ok',
      session: account
    })
    useWorkshopCredits().balance = computed(() => ({
      status: 'ok',
      credits: 100
    }))
    vi.mocked(router_render).mockReset().mockResolvedValue(response())
    vi.mocked(releaseRouterOutputs).mockClear()
    vi.mocked(refreshWorkshopCredits).mockClear()
  })
  it('requires acknowledged frozen review, executes once, then preserves editable original and releases output', async () => {
    const { run } = harness()
    await nextTick()
    run.prepare()
    await run.confirm(false)
    expect(router_render).not.toHaveBeenCalled()
    await run.confirm(true)
    await run.confirm(true)
    expect(router_render).toHaveBeenCalledTimes(1)
    expect(router_render).toHaveBeenCalledWith(
      model.slug,
      {},
      expect.objectContaining({
        model,
        form: expect.objectContaining({
          values: expect.objectContaining({ max_tokens: 800 })
        }),
        idempotencyKey: expect.any(String)
      })
    )
    expect(run.proposed.value).toBe(scene.value + '\n\nGentle ripples.')
    run.edited.value = 'Edited detail.'
    expect(run.proposed.value).toBe(scene.value + '\n\nEdited detail.')
    expect(releaseRouterOutputs).toHaveBeenCalledWith(response().outputs)
    expect(refreshWorkshopCredits).toHaveBeenCalledTimes(1)
    scene.value = 'Different scene'
    expect(run.proposed.value).toBeUndefined()
  })
  it('invalidates confirmation after scene or workspace changes', async () => {
    const { run } = harness()
    await nextTick()
    run.prepare()
    scene.value = 'Changed'
    await run.confirm(true)
    expect(router_render).not.toHaveBeenCalled()
    run.prepare()
    identity.value = { ...account, uid: 'user-2' }
    expect(run.review.value).toBeUndefined()
    await run.confirm(true)
    expect(router_render).not.toHaveBeenCalled()
  })
  it('aborts on disposal and releases late outputs without applying them', async () => {
    let resolve!: (value: RouterRenderResult) => void
    vi.mocked(router_render).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        })
    )
    const { run, view } = harness()
    await nextTick()
    run.prepare()
    const pending = run.confirm(true)
    view.unmount()
    expect(vi.mocked(router_render).mock.calls[0][2].signal?.aborted).toBe(true)
    resolve(response())
    await pending
    expect(run.result.value).toBeUndefined()
    expect(releaseRouterOutputs).toHaveBeenCalledWith(response().outputs)
  })
  it('does not retry a failed request', async () => {
    vi.mocked(router_render).mockRejectedValue(
      new Error('Connection interrupted')
    )
    const { run } = harness()
    await nextTick()
    run.prepare()
    await run.confirm(true)
    await run.confirm(true)
    expect(router_render).toHaveBeenCalledTimes(1)
    expect(run.error.value).toBe('request')
  })
  it('aborts an in-flight request when the account changes and discards late results', async () => {
    let resolve!: (value: RouterRenderResult) => void
    vi.mocked(router_render).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        })
    )
    const { run } = harness()
    await nextTick()
    run.prepare()
    const pending = run.confirm(true)
    await run.confirm(true)
    expect(router_render).toHaveBeenCalledTimes(1)
    identity.value = { ...account, uid: 'another-user' }
    expect(vi.mocked(router_render).mock.calls[0][2].signal?.aborted).toBe(true)
    resolve(response())
    await pending
    expect(run.result.value).toBeUndefined()
    expect(run.proposed.value).toBeUndefined()
    expect(releaseRouterOutputs).toHaveBeenCalledWith(response().outputs)
  })
  it('blocks signed-out and empty-credit workspaces', async () => {
    identity.value = undefined
    const { run } = harness()
    await nextTick()
    run.prepare()
    expect(run.gate.value).toBe('signedOut')
    expect(run.review.value).toBeUndefined()
    identity.value = account
    useWorkshopCredits().balance = computed(() => ({
      status: 'ok',
      credits: 0
    }))
    const second = harness()
    await nextTick()
    second.run.prepare()
    expect(second.run.gate.value).toBe('noCredits')
    expect(second.run.review.value).toBeUndefined()
  })
  it('demo dialog never reads session/credits or calls Router and applies only after explicit acceptance', async () => {
    window.history.replaceState(null, '', '/cinematic-studio?demo=success')
    vi.mocked(useWorkshopSession).mockClear()
    vi.mocked(useWorkshopCredits).mockClear()
    const user = userEvent.setup()
    const view = render(CinematicEnhancer, {
      props: {
        open: true,
        scene: scene.value,
        directions: '',
        namespace: 'demo',
        model
      }
    })
    await user.click(
      await screen.findByRole('button', { name: 'Review enhancement request' })
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Generate demo suggestion · no credits'
      })
    )
    const editor = await screen.findByRole('textbox', {
      name: 'Editable suggestion'
    })
    expect(view.emitted().apply).toBeUndefined()
    await user.clear(editor)
    await user.type(editor, 'A reviewed detail.')
    await user.click(screen.getByRole('button', { name: 'Apply suggestion' }))
    expect(view.emitted().apply).toEqual([
      [scene.value + '\n\nA reviewed detail.']
    ])
    expect(useWorkshopSession).not.toHaveBeenCalled()
    expect(useWorkshopCredits).not.toHaveBeenCalled()
    expect(router_render).not.toHaveBeenCalled()
  })
})
