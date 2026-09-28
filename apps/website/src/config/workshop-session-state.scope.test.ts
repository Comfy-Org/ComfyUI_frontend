import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope, nextTick, readonly, ref } from 'vue'

let { useWorkshopAuthFlag } = await import('../scripts/posthog')
let { workshopIdentity } = await import('./workshop-account')

vi.mock(import('../scripts/posthog'))
vi.mock(import('./workshop-account'))

beforeEach(async () => {
  vi.resetModules()
  ;({ useWorkshopAuthFlag } = await import('../scripts/posthog'))
  ;({ workshopIdentity } = await import('./workshop-account'))
})

describe('useWorkshopSession scope ownership', () => {
  it('does NOT strand a still-mounted island when the first caller unmounts', async () => {
    const flag = ref(true)
    vi.mocked(useWorkshopAuthFlag).mockReturnValue(readonly(flag))
    onTestFinished(async () => {
      flag.value = false
      await nextTick()
    })
    const mod = await import('./workshop-session-state')

    const firstCallerScope = effectScope()
    firstCallerScope.run(() => mod.useWorkshopSession())
    await vi.waitFor(() =>
      expect(workshopIdentity.activate).toHaveBeenCalledOnce()
    )

    firstCallerScope.stop()
    flag.value = false
    await Promise.resolve()
    flag.value = true

    await vi.waitFor(() =>
      expect(
        workshopIdentity.activate,
        'the shared flag watcher must survive its first caller unmounting, or every other island silently freezes'
      ).toHaveBeenCalledTimes(2)
    )
  })
})
