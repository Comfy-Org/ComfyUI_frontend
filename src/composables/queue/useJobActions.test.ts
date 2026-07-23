import { fromPartial } from '@total-typescript/shoehorn'
import { createApp, h, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useJobActions } from '@/composables/queue/useJobActions'
import type { JobListItem } from '@/composables/queue/useJobList'
import type { TaskItemImpl } from '@/stores/queueStore'
import type { Ref } from 'vue'

const { cancelJob, removeFailedJob, wrapWithErrorHandlingAsync } = vi.hoisted(
  () => ({
    cancelJob: vi.fn(),
    removeFailedJob: vi.fn(),
    wrapWithErrorHandlingAsync: vi.fn(
      <T extends (...args: never[]) => Promise<unknown>>(fn: T) => fn
    )
  })
)

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({ wrapWithErrorHandlingAsync })
}))

vi.mock('@/composables/queue/useJobMenu', () => ({
  useJobMenu: () => ({ cancelJob, removeFailedJob })
}))

function mountJobActions(job: Ref<JobListItem | null | undefined>) {
  let result: ReturnType<typeof useJobActions> | undefined
  const app = createApp({
    setup() {
      result = useJobActions(job)
      return () => h('div')
    }
  })
  app.use(
    createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: {} }
    })
  )
  app.mount(document.createElement('div'))
  if (!result) throw new Error('useJobActions did not initialize')
  return {
    result,
    unmount: () => app.unmount()
  }
}

function job(overrides: Partial<JobListItem> = {}): JobListItem {
  return {
    id: 'job-1',
    title: 'Job 1',
    meta: '',
    state: 'pending',
    ...overrides
  }
}

beforeEach(() => {
  cancelJob.mockReset().mockResolvedValue(undefined)
  removeFailedJob.mockReset().mockResolvedValue(undefined)
  wrapWithErrorHandlingAsync.mockClear()
})

describe('useJobActions', () => {
  it('cancels active jobs unless clearing is hidden', async () => {
    const currentJob = ref(job({ state: 'running' }))
    const { result, unmount } = mountJobActions(currentJob)

    expect(result.canCancelJob.value).toBe(true)
    await result.runCancelJob()
    expect(cancelJob).toHaveBeenCalledWith(currentJob.value)

    currentJob.value = job({ state: 'pending', showClear: false })
    expect(result.canCancelJob.value).toBe(false)

    unmount()
  })

  it('ignores cancel and delete requests without a current job or task', async () => {
    const currentJob = ref<JobListItem | null>(null)
    const { result, unmount } = mountJobActions(currentJob)

    expect(result.canCancelJob.value).toBe(false)
    expect(result.canDeleteJob.value).toBe(false)
    await result.runCancelJob()
    await result.runDeleteJob()

    currentJob.value = job({ state: 'failed' })
    await result.runDeleteJob()

    expect(cancelJob).not.toHaveBeenCalled()
    expect(removeFailedJob).not.toHaveBeenCalled()

    unmount()
  })

  it('removes failed jobs through their queue task', async () => {
    const task = fromPartial<TaskItemImpl>({ job: { id: 'prompt-1' } })
    const { result, unmount } = mountJobActions(
      ref(job({ state: 'failed', taskRef: task }))
    )

    expect(result.canDeleteJob.value).toBe(true)
    await result.runDeleteJob()

    expect(removeFailedJob).toHaveBeenCalledWith(task)

    unmount()
  })
})
