import { describe, expect, it, vi } from 'vitest'

import { TaskItemImpl } from '@/stores/queueStore'
import { buildJobDisplay } from '@/utils/queueDisplay'

describe('buildJobDisplay', () => {
  it('forwards clock preference locale for queued times', () => {
    const createTime = new Date(2024, 5, 15, 14, 5, 6).getTime()
    const task = new TaskItemImpl({
      id: 'queued',
      status: 'pending',
      create_time: createTime,
      priority: 1
    })
    const formatClockTimeFn = vi.fn<
      (ts: number, locale: string, clockPreferenceLocale?: string) => string
    >(() => '2:05:06 PM')

    const display = buildJobDisplay(task, 'pending', {
      t: (key: string) => key,
      locale: 'es',
      clockPreferenceLocale: 'en-US',
      formatClockTimeFn,
      isActive: false
    })

    expect(formatClockTimeFn).toHaveBeenCalledWith(createTime, 'es', 'en-US')
    expect(display.secondary).toBe('2:05:06 PM')
  })
})
