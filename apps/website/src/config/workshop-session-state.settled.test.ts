import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readonly, ref } from 'vue'

let { useWorkshopAuthFlag } = await import('../scripts/posthog')
let { workshopIdentity, workshopSessionClient } =
  await import('./workshop-account')

vi.mock(import('../scripts/posthog'))
vi.mock(import('./workshop-account'))

beforeEach(async () => {
  vi.resetModules()
  ;({ useWorkshopAuthFlag } = await import('../scripts/posthog'))
  ;({ workshopIdentity, workshopSessionClient } =
    await import('./workshop-account'))
})

describe('useWorkshopSession settled', () => {
  it('mirrors the client: settled only once Firebase has delivered the restored user or none', async () => {
    const flag = ref(true)
    vi.mocked(useWorkshopAuthFlag).mockReturnValue(readonly(flag))
    let publish: Parameters<
      typeof workshopSessionClient.subscribe
    >[0] = () => {}
    vi.mocked(workshopSessionClient.subscribe).mockImplementation(
      (listener) => {
        publish = listener
        listener({ phase: 'pending', user: null, session: undefined })
        return () => {}
      }
    )
    const mod = await import('./workshop-session-state')
    const s = mod.useWorkshopSession()
    await vi.waitFor(() =>
      expect(workshopIdentity.activate).toHaveBeenCalledOnce()
    )

    expect(
      s.settled.value,
      'before Firebase answers, nobody knows whether a user is signed in'
    ).toBe(false)

    publish({
      phase: 'signed-out',
      user: null,
      session: undefined
    })
    expect(s.settled.value).toBe(true)

    flag.value = false
    await vi.waitFor(() => expect(s.settled.value).toBe(false))
  })
})
