import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { JobDetail, JobListItem } from '@comfyorg/api-client/jobs/jobTypes'
import { useTelemetry } from '@comfyorg/telemetry'
import { TelemetryEvents } from '@comfyorg/telemetry/types'

import { LOCAL_MCP_USAGE_SOURCE } from '@/platform/localMcp/localMcpConnection'
import { useLocalMcpStore } from '@/platform/localMcp/useLocalMcpStore'
import { getJobDetail } from '@/platform/queue/services/jobOutputCache'
import { TaskItemImpl } from '@comfyorg/api-client/jobs/taskItem'
import { useQueueStore } from '@/platform/queue/stores/queueStore'

vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/platform/queue/services/jobOutputCache'), { spy: true })

const NOW = 1_000_000

const task = (id: string, createTime = NOW + 10) =>
  new TaskItemImpl({
    id,
    status: 'completed',
    create_time: createTime,
    outputs_count: 0,
    previewable_outputs_count: 0,
    priority: 1
  } satisfies JobListItem)

const detailWithSource = (source?: string) =>
  ({
    id: 'x',
    status: 'completed',
    create_time: NOW + 10,
    outputs_count: 0,
    previewable_outputs_count: 0,
    workflow: { extra_data: source ? { comfy_usage_source: source } : {} }
  }) as JobDetail

const flush = async () => {
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

describe('useLocalMcpStore', () => {
  const trackLocalMcpEvent = vi.fn()

  beforeEach(() => {
    localStorage.clear()
    trackLocalMcpEvent.mockClear()
    vi.mocked(getJobDetail).mockReset()
    vi.mocked(useTelemetry).mockReturnValue({
      trackLocalMcpEvent
    } as unknown as ReturnType<typeof useTelemetry>)
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  it('tracks exposure once per session', () => {
    const store = useLocalMcpStore()
    store.trackExposed()
    store.trackExposed()

    expect(trackLocalMcpEvent).toHaveBeenCalledExactlyOnceWith({
      name: TelemetryEvents.LOCAL_MCP_EXPOSED,
      properties: {}
    })
  })

  it('tracks the panel opening once per session', () => {
    const store = useLocalMcpStore()
    store.trackOpened()
    store.trackOpened()

    expect(trackLocalMcpEvent).toHaveBeenCalledExactlyOnceWith({
      name: TelemetryEvents.LOCAL_MCP_OPENED,
      properties: {}
    })
  })

  it('tracks each path selection', () => {
    const store = useLocalMcpStore()
    store.trackPathSelected('cursor', 'copy_config')
    store.trackPathSelected(undefined, 'open_docs')

    expect(trackLocalMcpEvent).toHaveBeenNthCalledWith(1, {
      name: TelemetryEvents.LOCAL_MCP_PATH_SELECTED,
      properties: { client: 'cursor', action: 'copy_config' }
    })
    expect(trackLocalMcpEvent).toHaveBeenNthCalledWith(2, {
      name: TelemetryEvents.LOCAL_MCP_PATH_SELECTED,
      properties: { client: undefined, action: 'open_docs' }
    })
  })

  describe('connection watcher', () => {
    it('reports connected when a new job carries the MCP usage source', async () => {
      vi.mocked(getJobDetail).mockResolvedValue(
        detailWithSource(LOCAL_MCP_USAGE_SOURCE)
      )
      const store = useLocalMcpStore()
      store.trackOpened()
      trackLocalMcpEvent.mockClear()
      store.startWatching()

      useQueueStore().historyTasks = [task('job-1')]
      await flush()

      expect(store.connected).toBe(true)
      expect(trackLocalMcpEvent).toHaveBeenCalledExactlyOnceWith({
        name: TelemetryEvents.LOCAL_MCP_CONNECTED,
        properties: {
          usage_source: LOCAL_MCP_USAGE_SOURCE,
          panel_opened_this_session: true
        }
      })
    })

    it('ignores jobs from other sources', async () => {
      vi.mocked(getJobDetail).mockResolvedValue(
        detailWithSource('comfyui-frontend')
      )
      const store = useLocalMcpStore()
      store.startWatching()

      useQueueStore().historyTasks = [task('job-1')]
      await flush()

      expect(store.connected).toBe(false)
      expect(trackLocalMcpEvent).not.toHaveBeenCalled()
    })

    it('ignores jobs created before the watcher started', async () => {
      const store = useLocalMcpStore()
      store.startWatching()

      useQueueStore().historyTasks = [task('old', NOW - 1)]
      await flush()

      expect(getJobDetail).not.toHaveBeenCalled()
      expect(store.connected).toBe(false)
    })

    it('inspects each job once', async () => {
      vi.mocked(getJobDetail).mockResolvedValue(detailWithSource())
      const store = useLocalMcpStore()
      store.startWatching()

      useQueueStore().historyTasks = [task('job-1')]
      await flush()
      useQueueStore().historyTasks = [task('job-1'), task('job-2')]
      await flush()

      expect(getJobDetail).toHaveBeenCalledTimes(2)
    })

    it('reports success at most once', async () => {
      vi.mocked(getJobDetail).mockResolvedValue(
        detailWithSource(LOCAL_MCP_USAGE_SOURCE)
      )
      const store = useLocalMcpStore()
      store.startWatching()
      useQueueStore().historyTasks = [task('job-1')]
      await flush()
      useQueueStore().historyTasks = [task('job-1'), task('job-2')]
      await flush()
      expect(trackLocalMcpEvent).toHaveBeenCalledTimes(1)
    })

    it('never reports again once a previous session already connected', async () => {
      localStorage.setItem('Comfy.LocalMcp.Connected', 'true')
      vi.mocked(getJobDetail).mockResolvedValue(
        detailWithSource(LOCAL_MCP_USAGE_SOURCE)
      )
      const store = useLocalMcpStore()
      expect(store.connected).toBe(true)
      store.startWatching()
      useQueueStore().historyTasks = [task('job-3')]
      await flush()
      expect(trackLocalMcpEvent).not.toHaveBeenCalled()
    })

    it('retries a job whose detail was unavailable', async () => {
      vi.mocked(getJobDetail)
        .mockResolvedValueOnce(undefined)
        .mockImplementation(async (id) =>
          detailWithSource(id === 'job-1' ? LOCAL_MCP_USAGE_SOURCE : undefined)
        )
      const store = useLocalMcpStore()
      store.startWatching()

      useQueueStore().historyTasks = [task('job-1')]
      await flush()
      expect(store.connected).toBe(false)
      useQueueStore().historyTasks = [task('job-1'), task('job-2')]
      await flush()

      expect(getJobDetail).toHaveBeenCalledWith('job-1')
      expect(
        vi.mocked(getJobDetail).mock.calls.filter(([id]) => id === 'job-1')
      ).toHaveLength(2)
      expect(store.connected).toBe(true)
    })

    it('gives up on a job after repeated unavailable details', async () => {
      vi.mocked(getJobDetail).mockResolvedValue(undefined)
      const store = useLocalMcpStore()
      store.startWatching()

      useQueueStore().historyTasks = [task('job-1')]
      await flush()
      useQueueStore().historyTasks = [task('job-1')]
      await flush()
      useQueueStore().historyTasks = [task('job-1')]
      await flush()
      useQueueStore().historyTasks = [task('job-1')]
      await flush()

      expect(
        vi.mocked(getJobDetail).mock.calls.filter(([id]) => id === 'job-1')
      ).toHaveLength(3)
      expect(getJobDetail).toHaveBeenCalledTimes(3)
    })

    it('ignores an inspection that finishes after stopWatching', async () => {
      let resolveDetail: (detail: JobDetail) => void = () => {}
      vi.mocked(getJobDetail).mockReturnValue(
        new Promise<JobDetail>((resolve) => {
          resolveDetail = resolve
        })
      )
      const store = useLocalMcpStore()
      store.startWatching()
      useQueueStore().historyTasks = [task('job-1')]
      await flush()

      store.stopWatching()
      resolveDetail(detailWithSource(LOCAL_MCP_USAGE_SOURCE))
      await flush()

      expect(store.connected).toBe(false)
      expect(trackLocalMcpEvent).not.toHaveBeenCalled()
    })

    it('stops inspecting jobs after stopWatching', async () => {
      const store = useLocalMcpStore()
      store.startWatching()
      store.stopWatching()

      useQueueStore().historyTasks = [task('job-1')]
      await flush()

      expect(getJobDetail).not.toHaveBeenCalled()
    })
  })
})
