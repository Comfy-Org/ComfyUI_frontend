/**
 * The pages that gate a run on credits read the cookie balance when the web
 * session knows the visitor, and the Firebase balance in every other
 * rollout state.
 */
import userEvent from '@testing-library/user-event'
import { cleanup, render, screen } from '@testing-library/vue'
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import {
  BALANCE,
  SESSION_BALANCE_READ,
  SESSION_FLAGS,
  TOKEN,
  credential,
  stubCloud
} from '../../config/__fixtures__/workshopCloudRecorder'
import { getRouterWorkshopModelDetail } from '../../config/workshop-router-content'
import { resetWorkshopAccountSource } from '../../config/workshop-account-source'
import { useWorkshopCredits } from '../../config/workshop-credits'
import { resetWorkshopSessionBalance } from '../../config/workshop-session-balance'
import { useWorkshopSession } from '../../config/workshop-session-state'
import { resetUnifiedWebSessionEnabled } from '../../config/workshop-web-session'
import { workflowDetailsBySlug } from '../../config/workshop-workflow-content'
import { runnableCinematicModels } from '../../lib/workshop/cinematic-studio/models'
import {
  useWorkshopAppsEnabled,
  useWorkshopEnabled,
  useWorkshopEnabledSettled,
  useWorkshopWorkflowsEnabled
} from '../../scripts/posthog'
import CinematicCreditAction from './cinematic-studio/CinematicCreditAction.vue'
import CinematicStudio from './cinematic-studio/CinematicStudio.vue'
import WorkflowPlayground from './WorkflowPlayground.vue'

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
const EMPTY_COOKIE_BALANCE = {
  status: 200,
  body: { amount_micros: 0, currency: 'usd', effective_balance_micros: 0 }
}

function signIn(workspace: 'personal' | 'team' = 'personal') {
  const enabled = computed(() => true)
  vi.mocked(useWorkshopEnabled).mockReturnValue(enabled)
  vi.mocked(useWorkshopEnabledSettled).mockReturnValue(enabled)
  vi.mocked(useWorkshopWorkflowsEnabled).mockReturnValue(enabled)
  vi.mocked(useWorkshopAppsEnabled).mockReturnValue(enabled)
  const session = useWorkshopSession()
  const signedIn = credential(workspace)
  session.session = computed(() => signedIn)
  vi.mocked(session.ensureFresh).mockResolvedValue({
    status: 'ok',
    session: signedIn
  })
}

function firebaseHolds(credits: number) {
  useWorkshopCredits().balance = computed(() => ({
    status: 'ok' as const,
    credits
  }))
  vi.mocked(useWorkshopCredits).mockClear()
  return useWorkshopCredits
}

function mountPlayground() {
  const model = workflowDetailsBySlug.get('workflows/remove-background')
  assert(model)
  render(WorkflowPlayground, {
    props: { model, scope: JSON.stringify(['uid-1', 'workspace-1']) }
  })
  return async () => ({
    canRun:
      (await screen.findByTestId('workflow-run')).textContent.trim() === 'Run'
  })
}

async function mountStudio() {
  render(CinematicStudio, {
    props: { models: runnableCinematicModels(getRouterWorkshopModelDetail) }
  })
  await userEvent.setup().type(screen.getByLabelText('Scene'), 'A diner')
  return async () => ({
    canRun: screen.queryByTestId('cinematic-generate') !== null
  })
}

function mountCreditAction() {
  render(CinematicCreditAction, { props: { retryLabel: 'Retry' } })
  return async () => ({ canRun: false })
}

const CALLERS = [
  { caller: 'WorkflowPlayground', mount: mountPlayground },
  { caller: 'CinematicStudio', mount: mountStudio },
  { caller: 'CinematicCreditAction', mount: mountCreditAction }
]

const RUN_GATES = CALLERS.slice(0, 2)

beforeEach(() => {
  vi.stubEnv('PUBLIC_WORKSHOP_ROUTER_RUN', '1')
  signIn()
})

afterEach(() => {
  cleanup()
  resetWorkshopSessionBalance()
  resetWorkshopAccountSource()
  resetUnifiedWebSessionEnabled()
})

describe('balance callers', () => {
  it.for(CALLERS)(
    '$caller, session mode, personal workspace: one cookie balance read, no minted token, no Firebase balance',
    async ({ mount }) => {
      const sent = stubCloud({ ...SESSION_FLAGS })
      const firebase = firebaseHolds(0)
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
      const firebase = firebaseHolds(0)
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
      firebaseHolds(0)
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
      const firebase = firebaseHolds(0)
      const gate = await mount()

      await vi.waitFor(() => expect(firebase).toHaveBeenCalled())
      expect(await gate()).toEqual({ canRun: false })
    }
  )
  it.for(RUN_GATES)(
    '$caller, session mode, team workspace: the personal cookie balance does not gate the run',
    async ({ mount }) => {
      signIn('team')
      const sent = stubCloud({
        ...SESSION_FLAGS,
        balance: EMPTY_COOKIE_BALANCE
      })
      firebaseHolds(0)
      const gate = await mount()

      await vi.waitFor(() =>
        expect(sent.filter(({ url }) => url === BALANCE)).toEqual([
          SESSION_BALANCE_READ
        ])
      )
      expect(await gate()).toEqual({ canRun: true })
    }
  )
})
