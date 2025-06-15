import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { useTaskCompletionWatcher } from '@/composables/useTaskCompletionWatcher'
import { useQueueStore } from '@/stores/queueStore'

vi.mock('@/stores/queueStore')

describe('useTaskCompletionWatcher', () => {
  let mockHistoryTasks: any

  beforeEach(() => {
    mockHistoryTasks = ref([])
    vi.mocked(useQueueStore).mockReturnValue({
      get historyTasks() {
        return mockHistoryTasks.value
      }
    } as any)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should call onComplete when history count increases', async () => {
    const onComplete = vi.fn()
    const watcher = useTaskCompletionWatcher({ onComplete })

    watcher.start()
    expect(watcher.isWatching.value).toBe(true)

    // Simulate task completion by increasing history
    mockHistoryTasks.value = [{ id: 1 }]
    await nextTick()

    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('should not call onComplete when history count decreases', async () => {
    mockHistoryTasks.value = [{ id: 1 }, { id: 2 }]
    const onComplete = vi.fn()
    const watcher = useTaskCompletionWatcher({ onComplete })

    watcher.start()

    // Simulate task deletion by decreasing history
    mockHistoryTasks.value = [{ id: 1 }]
    await nextTick()

    expect(onComplete).not.toHaveBeenCalled()
  })

  it('should stop watching when stop is called', () => {
    const watcher = useTaskCompletionWatcher()

    watcher.start()
    expect(watcher.isWatching.value).toBe(true)

    watcher.stop()
    expect(watcher.isWatching.value).toBe(false)
  })

  it('should manually trigger onComplete when trigger is called', () => {
    const onComplete = vi.fn()
    const watcher = useTaskCompletionWatcher({ onComplete })

    watcher.trigger()

    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('should not start multiple watchers', () => {
    const watcher = useTaskCompletionWatcher()

    watcher.start()
    const firstWatchingState = watcher.isWatching.value

    watcher.start() // Try to start again
    expect(watcher.isWatching.value).toBe(firstWatchingState)
  })
})
