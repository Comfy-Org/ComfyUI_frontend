import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'

import { reduceOutputsTray } from './agentOutputsTray'
import type { OutputsTrayEvent, OutputsTrayState } from './agentOutputsTray'

const NOTHING_SELECTED: ReadonlySet<string> = new Set()

export const useAgentOutputsTrayStore = defineStore('agentOutputsTray', () => {
  const state = shallowRef<OutputsTrayState>({ phase: 'closed' })

  const isOpen = computed(() => state.value.phase === 'open')
  const selectedKeys = computed(() =>
    state.value.phase === 'open' ? state.value.selected : NOTHING_SELECTED
  )

  function dispatch(event: OutputsTrayEvent): void {
    state.value = reduceOutputsTray(state.value, event)
  }

  return { state, isOpen, selectedKeys, dispatch }
})
