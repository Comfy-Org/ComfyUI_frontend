import { describe, expect, it, vi } from 'vitest'
import { computed, nextTick, readonly, ref } from 'vue'

import { useWorkshopCredits } from '../config/workshop-credits'
import { useWorkshopSession } from '../config/workshop-session-state'
import { useWorkshopAccountWhen } from './useWorkshopAccount'

vi.mock(import('../config/workshop-session-state'))
vi.mock(import('../config/workshop-credits'))

describe('useWorkshopAccountWhen', () => {
  it('asks for neither the session nor the credits while Workshop is off', async () => {
    const account = useWorkshopAccountWhen(readonly(ref(false)))

    expect(useWorkshopSession).not.toHaveBeenCalled()
    expect(useWorkshopCredits).not.toHaveBeenCalled()
    expect(account.user.value).toBeNull()
    expect(account.session.value).toBeUndefined()
    expect(account.settled.value).toBe(false)
    expect(account.balance.value).toEqual({ status: 'unknown' })
    await expect(account.ensureFresh()).rejects.toThrow('not enabled')
    await expect(account.remint()).rejects.toThrow('not enabled')
  })

  it('starts both the moment Workshop turns on and mirrors them from then on', async () => {
    const session = useWorkshopSession()
    session.settled = computed(() => true)
    useWorkshopCredits().balance = computed(() => ({
      status: 'ok',
      credits: 42
    }))
    vi.mocked(useWorkshopSession).mockClear()
    const enabled = ref(false)
    const account = useWorkshopAccountWhen(readonly(enabled))
    expect(account.settled.value).toBe(false)

    enabled.value = true
    await nextTick()

    expect(useWorkshopSession).toHaveBeenCalledOnce()
    expect(account.settled.value).toBe(true)
    expect(account.balance.value).toEqual({ status: 'ok', credits: 42 })
    await account.ensureFresh()
    expect(session.ensureFresh).toHaveBeenCalledOnce()

    enabled.value = false
    await nextTick()
    expect(account.settled.value, 'a started account stays started').toBe(true)
  })
})
