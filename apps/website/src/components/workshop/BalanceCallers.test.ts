/**
 * The pages that gate a run on credits read the cookie balance when the web
 * session knows the visitor, and the Firebase balance in every other
 * rollout state.
 */
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import {
  BALANCE,
  SESSION_BALANCE_READ,
  SESSION_FLAGS,
  TOKEN,
  credential,
  stubCloud
} from '../../config/__fixtures__/workshopCloudRecorder'

vi.mock(import('../../scripts/posthog'))
vi.mock(import('../../config/workshop-session-state'))
vi.mock(import('../../config/workshop-credits'))
vi.mock(import('../../config/workshop-billing-sdk'))
vi.mock(import('../../config/workshop-features'))
vi.mock(import('../../config/workshop-firebase'))
vi.mock(import('../../config/router-render'), { spy: true })
vi.mock(import('astro:env/client'), () => ({
  WORKSHOP_LOCAL_DEV: false,
  WORKSHOP_RELEASE: 'test',
  WORKSHOP_DEPLOY_ENV: ''
}))

const FLAG_OFF = { anonymous: { web_session_probe: false } }

async function signIn() {
  const posthog = await import('../../scripts/posthog')
  const enabled = computed(() => true)
  vi.mocked(posthog.useWorkshopEnabled).mockReturnValue(enabled)
  vi.mocked(posthog.useWorkshopEnabledSettled).mockReturnValue(enabled)
  vi.mocked(posthog.useWorkshopWorkflowsEnabled).mockReturnValue(enabled)
  vi.mocked(posthog.useWorkshopAppsEnabled).mockReturnValue(enabled)
  const { useWorkshopSession } =
    await import('../../config/workshop-session-state')
  const session = useWorkshopSession()
  const personal = credential('personal')
  session.session = computed(() => personal)
  vi.mocked(session.ensureFresh).mockResolvedValue({
    status: 'ok',
    session: personal
  })
}

async function firebaseHolds(credits: number) {
  const { useWorkshopCredits } = await import('../../config/workshop-credits')
  useWorkshopCredits().balance = computed(() => ({
    status: 'ok' as const,
    credits
  }))
  vi.mocked(useWorkshopCredits).mockClear()
  return useWorkshopCredits
}

async function mountPlayground() {
  const { workflowDetailsBySlug } =
    await import('../../config/workshop-workflow-content')
  const model = workflowDetailsBySlug.get('workflows/remove-background')
  assert(model)
  const { default: WorkflowPlayground } =
    await import('./WorkflowPlayground.vue')
  render(WorkflowPlayground, {
    props: { model, scope: JSON.stringify(['uid-1', 'workspace-1']) }
  })
  return async () => ({
    canRun:
      (await screen.findByTestId('workflow-run')).textContent.trim() === 'Run'
  })
}

async function mountStudio() {
  vi.stubEnv('PUBLIC_WORKSHOP_ROUTER_RUN', '1')
  const { getRouterWorkshopModelDetail } =
    await import('../../config/workshop-router-content')
  const { runnableCinematicModels } =
    await import('../../lib/workshop/cinematic-studio/models')
  const { default: CinematicStudio } =
    await import('./cinematic-studio/CinematicStudio.vue')
  render(CinematicStudio, {
    props: { models: runnableCinematicModels(getRouterWorkshopModelDetail) }
  })
  await userEvent.setup().type(screen.getByLabelText('Scene'), 'A diner')
  return async () => ({
    canRun: screen.queryByTestId('cinematic-generate') !== null
  })
}

async function mountCreditAction() {
  const { default: CinematicCreditAction } =
    await import('./cinematic-studio/CinematicCreditAction.vue')
  render(CinematicCreditAction, { props: { retryLabel: 'Retry' } })
  return async () => ({ canRun: false })
}

const CALLERS = [
  { caller: 'WorkflowPlayground', mount: mountPlayground },
  { caller: 'CinematicStudio', mount: mountStudio },
  { caller: 'CinematicCreditAction', mount: mountCreditAction }
]

const RUN_GATES = CALLERS.slice(0, 2)

beforeEach(async () => {
  vi.resetModules()
  await signIn()
})

describe('balance callers', { timeout: 30_000 }, () => {
  it.for(CALLERS)(
    '$caller, session mode, personal workspace: one cookie balance read, no minted token, no Firebase balance',
    async ({ mount }) => {
      const sent = stubCloud({ ...SESSION_FLAGS })
      const firebase = await firebaseHolds(0)
      await mount()

      await vi.waitFor(() =>
        expect(sent.filter(({ url }) => url === BALANCE)).toEqual([
          SESSION_BALANCE_READ
        ])
      )
      expect(sent.map(({ url }) => url)).not.toContain(TOKEN)
      expect(firebase).not.toHaveBeenCalled()
    }
  )

  it.for(CALLERS)(
    '$caller, flag off: reads the Firebase balance and sends no balance or token request',
    async ({ mount }) => {
      const sent = stubCloud(FLAG_OFF)
      const firebase = await firebaseHolds(0)
      await mount()

      await vi.waitFor(() => expect(firebase).toHaveBeenCalled())
      expect(sent.filter(({ url }) => [BALANCE, TOKEN].includes(url))).toEqual(
        []
      )
    }
  )

  it.for(RUN_GATES)(
    '$caller: a funded cookie balance runs where an empty Firebase balance would not',
    async ({ mount }) => {
      stubCloud({ ...SESSION_FLAGS })
      await firebaseHolds(0)
      const gate = await mount()

      await vi.waitFor(async () =>
        expect(await gate()).toEqual({ canRun: true })
      )
    }
  )

  it.for(RUN_GATES)(
    '$caller: flag off, an empty Firebase balance cannot run',
    async ({ mount }) => {
      stubCloud(FLAG_OFF)
      const firebase = await firebaseHolds(0)
      const gate = await mount()

      await vi.waitFor(() => expect(firebase).toHaveBeenCalled())
      expect(await gate()).toEqual({ canRun: false })
    }
  )
})
