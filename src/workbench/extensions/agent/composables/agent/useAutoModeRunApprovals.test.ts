import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import type { AgentRunModeValue } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { useAutoModeRunApprovals } from './useAutoModeRunApprovals'

function setup(
  initialMode: AgentRunModeValue = 'ask_approval',
  initialAsks: string[] = []
) {
  const mode = ref<AgentRunModeValue>(initialMode)
  const asks = ref<string[]>(initialAsks)
  const approve = vi.fn()
  useAutoModeRunApprovals({
    mode: () => mode.value,
    pendingRunApprovalAskIds: () => asks.value,
    approve
  })
  return { mode, asks, approve }
}

describe('useAutoModeRunApprovals', () => {
  it('approves the open card and every later one after a switch to Auto', async () => {
    const { mode, asks, approve } = setup('ask_approval', ['ask-1'])

    mode.value = 'auto'
    await nextTick()
    expect(approve.mock.calls).toEqual([['ask-1']])

    asks.value = []
    await nextTick()
    asks.value = ['ask-2']
    await nextTick()
    expect(approve.mock.calls).toEqual([['ask-1'], ['ask-2']])
  })

  it('leaves cards alone while the mode stays Ask', async () => {
    const { asks, approve } = setup('ask_approval')

    asks.value = ['ask-1']
    await nextTick()
    expect(approve).not.toHaveBeenCalled()
  })

  it('does not answer a card that was open when the panel loaded in Auto', async () => {
    const { asks, approve } = setup('auto', ['ask-1'])

    asks.value = ['ask-1', 'ask-2']
    await nextTick()
    expect(approve).not.toHaveBeenCalled()
  })

  it.for<AgentRunModeValue>(['auto_limited', 'ask_approval'])(
    'does not arm on a switch to %s',
    async (next) => {
      const { mode, approve } = setup('auto', ['ask-1'])

      mode.value = next
      await nextTick()
      expect(approve).not.toHaveBeenCalled()
    }
  )

  it('stops answering once the user leaves Auto', async () => {
    const { mode, asks, approve } = setup('ask_approval')

    mode.value = 'auto'
    await nextTick()
    mode.value = 'ask_approval'
    await nextTick()
    asks.value = ['ask-1']
    await nextTick()
    expect(approve).not.toHaveBeenCalled()
  })

  it('tries each card once, even if it is still pending', async () => {
    const { mode, asks, approve } = setup('ask_approval', ['ask-1'])

    mode.value = 'auto'
    await nextTick()
    asks.value = ['ask-1', 'ask-2']
    await nextTick()
    expect(approve.mock.calls).toEqual([['ask-1'], ['ask-2']])
  })
})
