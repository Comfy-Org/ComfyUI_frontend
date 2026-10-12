/**
 * Where the model page's balance comes from, per rollout state: the cookie
 * balance the header already reads when the web session knows the visitor,
 * the Firebase balance otherwise.
 */
import { render, screen } from '@testing-library/vue'
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, readonly, ref } from 'vue'

import { centsToCredits } from '@comfyorg/shared-frontend-utils/creditsUtil'

import { ACCOUNT_SOURCE_CAP_MS } from './workshop-account-source'
import {
  BALANCE,
  FEATURES,
  SESSION,
  SESSION_BALANCE_READ,
  SESSION_FLAGS,
  TOKEN,
  credential,
  refusal,
  stubCloud
} from './__fixtures__/workshopCloudRecorder'
import type { WorkshopSession } from './workshop-session-state'

const firebaseEvaluated = vi.hoisted(() => vi.fn())

vi.mock(import('@/scripts/posthog'))
vi.mock(import('./workshop-session-state'))
vi.mock(import('./workshop-credits'))
vi.mock(import('./workshop-billing-sdk'))
vi.mock(import('./workshop-features'))
vi.mock(import('./workshop-firebase'), async () => {
  firebaseEvaluated()
  return import('./__mocks__/workshop-firebase')
})

async function mountBalance({
  authEnabled = true,
  scope = effectScope(true)
}: {
  authEnabled?: boolean
  scope?: ReturnType<typeof effectScope>
} = {}) {
  const posthog = await import('@/scripts/posthog')
  vi.mocked(posthog.useWorkshopAuthFlag).mockReturnValue(
    readonly(ref(authEnabled))
  )
  vi.mocked(posthog.useWorkshopEnabled).mockReturnValue(readonly(ref(true)))
  const credits = await import('./workshop-credits')
  vi.mocked(credits.useWorkshopCredits).mockReturnValue({
    balance: computed(() => ({ status: 'ok', credits: 5 })),
    session: computed(() => undefined)
  })
  const { useWorkshopModelBalance } = await import('./workshop-model-balance')
  const session = ref<WorkshopSession>(credential('personal'))
  const balance = scope.run(() => useWorkshopModelBalance(session))
  assert.exists(balance)
  return { balance, session, credits }
}

beforeEach(() => {
  vi.resetModules()
  firebaseEvaluated.mockClear()
})

afterEach(async () => {
  const { stopWorkshopAccountSource } =
    await import('./workshop-account-source')
  stopWorkshopAccountSource()
})

describe('useWorkshopModelBalance', () => {
  it('flag on, live session, personal workspace: reads the cookie balance and never starts Firebase', async () => {
    const sent = stubCloud({ ...SESSION_FLAGS })
    const { balance } = await mountBalance()

    await vi.waitFor(() =>
      expect(balance.value).toEqual({
        status: 'ok',
        credits: centsToCredits(211)
      })
    )
    expect(
      sent.filter(({ url }) => url === BALANCE),
      'one read, on the cookie: no Authorization, no workspace header'
    ).toEqual([SESSION_BALANCE_READ])
    expect(sent.map(({ url }) => url)).not.toContain(TOKEN)
    expect(firebaseEvaluated).not.toHaveBeenCalled()
  })

  it('flag on, session balance 401: leaves ok and does not retry with a Bearer token', async () => {
    const sent = stubCloud({
      ...SESSION_FLAGS,
      balance: refusal(401, 'session_revoked')
    })
    const { balance } = await mountBalance()

    await vi.waitFor(() =>
      expect(balance.value).toEqual({ status: 'session_ended' })
    )
    expect(sent.filter(({ url }) => url === BALANCE)).toEqual([
      SESSION_BALANCE_READ
    ])
    expect(sent.some(({ authorization }) => authorization)).toBe(false)
  })

  it.for([
    {
      state: 'flag off (probe false)',
      answers: { anonymous: { web_session_probe: false } },
      requests: [FEATURES]
    },
    {
      state: 'flag on, session answers no_session',
      answers: {
        anonymous: { web_session_probe: true },
        perUser: { unified_web_session: true }
      },
      requests: [FEATURES, FEATURES, SESSION]
    }
  ])(
    '$state: follows the Firebase balance and reads no cookie balance',
    async ({ answers, requests }) => {
      const sent = stubCloud(answers)
      const { balance } = await mountBalance()

      await vi.waitFor(() =>
        expect(balance.value).toEqual({ status: 'ok', credits: 5 })
      )
      expect(sent.map(({ url }) => url)).toEqual(requests)
    }
  )

  it('probe hangs past the cap: follows the Firebase balance', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    const cloud = Promise.withResolvers<void>()
    stubCloud({ ...SESSION_FLAGS, answered: cloud.promise })
    const { balance } = await mountBalance()

    await vi.advanceTimersByTimeAsync(ACCOUNT_SOURCE_CAP_MS - 1)
    expect(balance.value).toEqual({ status: 'unknown' })

    await vi.advanceTimersByTimeAsync(1)
    await vi.waitFor(() =>
      expect(balance.value).toEqual({ status: 'ok', credits: 5 })
    )
  })

  it('auth flag off: sends nothing and stays unknown', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    const sent = stubCloud({ ...SESSION_FLAGS })
    const { balance } = await mountBalance({ authEnabled: false })

    await vi.advanceTimersByTimeAsync(ACCOUNT_SOURCE_CAP_MS)
    expect(sent).toEqual([])
    expect(balance.value).toEqual({ status: 'unknown' })
  })

  it('session source with a team workspace: unknown, not the personal balance', async () => {
    stubCloud({ ...SESSION_FLAGS })
    const { balance, session } = await mountBalance()
    await vi.waitFor(() =>
      expect(balance.value).toEqual({
        status: 'ok',
        credits: centsToCredits(211)
      })
    )

    session.value = credential('team')
    expect(balance.value).toEqual({ status: 'unknown' })
  })

  it('shares one balance request with the header on the same page', async () => {
    const sent = stubCloud({ ...SESSION_FLAGS })
    const { balance } = await mountBalance()
    const { default: HeaderMain } =
      await import('@/components/common/HeaderMain/HeaderMain.vue')
    render(HeaderMain, { props: { workshopInBuild: true } })

    expect(await screen.findAllByTestId('header-session-credits')).toHaveLength(
      2
    )
    await vi.waitFor(() =>
      expect(balance.value).toEqual({
        status: 'ok',
        credits: centsToCredits(211)
      })
    )
    expect(sent.filter(({ url }) => url === BALANCE)).toEqual([
      SESSION_BALANCE_READ
    ])
  })

  it.for([
    { state: 'session source', answers: SESSION_FLAGS },
    {
      state: 'firebase source',
      answers: { anonymous: { web_session_probe: false } }
    }
  ])(
    '$state: a scope stopped before the source answers binds nothing',
    async ({ answers }) => {
      const cloud = Promise.withResolvers<void>()
      const sent = stubCloud({ ...answers, answered: cloud.promise })
      const scope = effectScope(true)
      const { balance, credits } = await mountBalance({ scope })

      scope.stop()
      cloud.resolve()
      await vi.dynamicImportSettled()
      await new Promise((resolve) => setTimeout(resolve))

      expect(sent.map(({ url }) => url)).not.toContain(BALANCE)
      expect(credits.useWorkshopCredits).not.toHaveBeenCalled()
      expect(balance.value).toEqual({ status: 'unknown' })
    }
  )

  it('stopping the account source ends the cookie session and a restart boots it again', async () => {
    const sent = stubCloud({ ...SESSION_FLAGS })
    const { balance } = await mountBalance()
    await vi.waitFor(() => expect(balance.value.status).toBe('ok'))
    const { stopWorkshopAccountSource, resolveWorkshopAccountSource } =
      await import('./workshop-account-source')
    const { useWorkshopWebSession } =
      await import('./workshop-web-session-identity')
    const balanceReads = () => sent.filter(({ url }) => url === BALANCE)

    stopWorkshopAccountSource()
    window.dispatchEvent(new Event('focus'))

    expect(useWorkshopWebSession().value).toBeUndefined()
    expect(balanceReads()).toHaveLength(1)

    await expect(resolveWorkshopAccountSource()).resolves.toBe('session')
    await vi.waitFor(() => expect(balanceReads()).toHaveLength(2))
  })
})
