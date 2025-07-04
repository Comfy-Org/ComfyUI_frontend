import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useNodeCompatibilityStore } from '@/stores/nodeCompatibilityStore'

describe('useNodeCompatibilityStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should initialize with empty state', () => {
    const store = useNodeCompatibilityStore()

    expect(store.isChecking).toBe(false)
    expect(store.lastCheckTime).toBeNull()
    expect(store.checkError).toBeNull()
    expect(store.hasIncompatibleNodes).toBe(false)
    expect(store.totalIncompatibleCount).toBe(0)
    expect(store.shouldShowNotification).toBe(false)
  })

  it('should add incompatible nodes correctly', () => {
    const store = useNodeCompatibilityStore()

    store.addIncompatibleNode(
      'test-node',
      'Test Node',
      'banned',
      'Node is banned for testing'
    )

    expect(store.hasIncompatibleNodes).toBe(true)
    expect(store.totalIncompatibleCount).toBe(1)
    expect(store.hasNodeCompatibilityIssues('test-node')).toBe(true)

    const compatibilityInfo = store.getNodeCompatibilityInfo('test-node')
    expect(compatibilityInfo).toBeDefined()
    expect(compatibilityInfo?.disableReason).toBe('banned')
  })

  it('should remove incompatible nodes correctly', () => {
    const store = useNodeCompatibilityStore()

    store.addIncompatibleNode(
      'test-node',
      'Test Node',
      'banned',
      'Node is banned for testing'
    )

    expect(store.hasIncompatibleNodes).toBe(true)

    store.removeIncompatibleNode('test-node')

    expect(store.hasIncompatibleNodes).toBe(false)
    expect(store.hasNodeCompatibilityIssues('test-node')).toBe(false)
  })

  it('should handle notification modal state correctly', () => {
    const store = useNodeCompatibilityStore()

    // Add an incompatible node
    store.addIncompatibleNode(
      'test-node',
      'Test Node',
      'banned',
      'Node is banned for testing'
    )

    expect(store.shouldShowNotification).toBe(true)
    expect(store.pendingNotificationNodes).toHaveLength(1)

    store.markNotificationModalShown()

    expect(store.shouldShowNotification).toBe(false)
    expect(store.pendingNotificationNodes).toHaveLength(0)
  })

  it('should clear all results correctly', () => {
    const store = useNodeCompatibilityStore()

    store.addIncompatibleNode(
      'test-node',
      'Test Node',
      'banned',
      'Node is banned for testing'
    )
    store.recordCheckError('Test error')

    expect(store.hasIncompatibleNodes).toBe(true)
    expect(store.checkError).toBe('Test error')

    store.clearResults()

    expect(store.hasIncompatibleNodes).toBe(false)
    expect(store.checkError).toBeNull()
  })

  it('should track checking state correctly', () => {
    const store = useNodeCompatibilityStore()

    expect(store.isChecking).toBe(false)

    store.setCheckingState(true)
    expect(store.isChecking).toBe(true)

    store.recordCheckCompletion()
    expect(store.isChecking).toBe(false)
    expect(store.lastCheckTime).toBeDefined()
  })

  it('should provide compatibility summary', () => {
    const store = useNodeCompatibilityStore()

    store.addIncompatibleNode(
      'banned-node',
      'Banned Node',
      'banned',
      'Node is banned'
    )

    const summary = store.getCompatibilitySummary()

    expect(summary.incompatibleCount).toBe(1)
    expect(summary.bannedCount).toBe(0) // bannedNodes is separate from incompatibleNodes
    expect(summary.totalIssues).toBe(1)
    expect(summary.hasError).toBe(false)
  })
})
