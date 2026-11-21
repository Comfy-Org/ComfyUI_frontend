import { createEventHook } from '@vueuse/core'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import type { AgentRunModeValue } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { useAutoModeRunApprovals } from './useAutoModeRunApprovals'

function setup(initialAsks: string[] = []) {
  const saved = createEventHook<{ mode: AgentRunModeValue }>()
  const asks = ref<string[]>(initialAsks)
  const approve = vi.fn()
  useAutoModeRunApprovals({
    onUserSaved: saved.on,
    pendingRunApprovalAskIds: () => asks.value,
    approve
  })
  const save = async (mode: AgentRunModeValue) => {
    await saved.trigger({ mode })
    await nextTick()
  }
  return { save, asks, approve }
}

describe('useAutoModeRunApprovals', () => {
  it('approves the open card and every later one after the user saves Auto', async () => {
    const { save, asks, approve } = setup(['ask-1'])

    await save('auto')
    expect(approve.mock.calls).toEqual([['ask-1']])

    asks.value = []
    await nextTick()
    asks.value = ['ask-2']
    await nextTick()
    expect(approve.mock.calls).toEqual([['ask-1'], ['ask-2']])
  })

  it('leaves cards alone until the user saves Auto', async () => {
    const { asks, approve } = setup(['ask-1'])

    asks.value = ['ask-1', 'ask-2']
    await nextTick()
    expect(approve).not.toHaveBeenCalled()
  })

  it.for<AgentRunModeValue>(['auto_limited', 'ask_approval'])(
    'does not arm on a save of %s',
    async (mode) => {
      const { save, approve } = setup(['ask-1'])

      await save(mode)
      expect(approve).not.toHaveBeenCalled()
    }
  )

  it('stops answering once the user saves another mode', async () => {
    const { save, asks, approve } = setup()

    await save('auto')
    await save('ask_approval')
    asks.value = ['ask-1']
    await nextTick()
    expect(approve).not.toHaveBeenCalled()
  })

  it('answers each card at most once', async () => {
    const { save, asks, approve } = setup(['ask-1'])

    await save('auto')
    asks.value = ['ask-1', 'ask-2']
    await nextTick()
    await save('auto')
    expect(approve.mock.calls).toEqual([['ask-1'], ['ask-2']])
  })
})
