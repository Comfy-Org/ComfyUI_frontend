import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'

import { useAgentWorkflowDraftArchiveStore } from './agentWorkflowDraftArchiveStore'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

const INDEX_KEY = 'Comfy.Workflow.AgentDraftArchiveIndex.v1:personal'
const PAYLOAD_PREFIX = 'Comfy.Workflow.AgentDraftArchive.v1:personal:'
const DAY_MS = 24 * 60 * 60 * 1000
const MAX_ARCHIVED_DRAFTS = 8

function storedIndex(): Record<
  string,
  { filename: string; archivedAt: number }
> {
  return JSON.parse(localStorage.getItem(INDEX_KEY) ?? '{}')
}

function draft(workflowId: string) {
  return {
    filename: `${workflowId}.json`,
    content: `{"graph":"${workflowId}"}`
  }
}

function rejectWrites(matches: (key: string) => boolean): void {
  const setItem = localStorage.setItem.bind(localStorage)
  const spy = vi
    .spyOn(localStorage, 'setItem')
    .mockImplementation((key, value) => {
      if (matches(key)) throw new DOMException('full', 'QuotaExceededError')
      setItem(key, value)
    })
  onTestFinished(() => spy.mockRestore())
}

function archiveAt(
  archive: ReturnType<typeof useAgentWorkflowDraftArchiveStore>,
  workflowId: string,
  minutesFromNow: number
): void {
  vi.setSystemTime(Date.now() + minutesFromNow * 60_000)
  archive.archive(workflowId, draft(workflowId))
}

describe('agentWorkflowDraftArchiveStore', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(reportError).mockClear()
  })

  it('round-trips an archived graph and forgets it once discarded', () => {
    const archive = useAgentWorkflowDraftArchiveStore()

    expect(archive.archive('wf-1', draft('wf-1'))).toBe(true)
    expect(archive.read('wf-1')).toMatchObject(draft('wf-1'))
    expect(archive.read('wf-absent')).toBeNull()

    archive.discard('wf-1')

    expect(archive.read('wf-1')).toBeNull()
    expect(localStorage.getItem(`${PAYLOAD_PREFIX}wf-1`)).toBeNull()
    expect(storedIndex()).toEqual({})
  })

  it('replaces an earlier archive of the same workflow', () => {
    const archive = useAgentWorkflowDraftArchiveStore()
    archive.archive('wf-1', { filename: 'first.json', content: '{"v":1}' })
    archive.archive('wf-1', { filename: 'second.json', content: '{"v":2}' })

    expect(archive.read('wf-1')).toMatchObject({
      filename: 'second.json',
      content: '{"v":2}'
    })
    expect(Object.keys(storedIndex())).toEqual(['wf-1'])
  })

  it.for([
    { label: 'expired entries', ageDays: 31, expected: null },
    { label: 'live entries', ageDays: 29, expected: '{"graph":"wf-old"}' }
  ])('applies the archive TTL to $label', ({ ageDays, expected }) => {
    const archive = useAgentWorkflowDraftArchiveStore()
    localStorage.setItem(
      INDEX_KEY,
      JSON.stringify({
        'wf-old': {
          filename: 'wf-old.json',
          archivedAt: Date.now() - ageDays * DAY_MS
        }
      })
    )
    localStorage.setItem(`${PAYLOAD_PREFIX}wf-old`, '{"graph":"wf-old"}')

    expect(archive.read('wf-old')?.content ?? null).toBe(expected)
    expect(localStorage.getItem(`${PAYLOAD_PREFIX}wf-old`)).toBe(expected)
  })

  it('evicts the least recently archived graph once the cap is reached', () => {
    const archive = useAgentWorkflowDraftArchiveStore()
    const ids = Array.from(
      { length: MAX_ARCHIVED_DRAFTS + 1 },
      (_, index) => `wf-${index}`
    )
    ids.forEach((id) => archiveAt(archive, id, 1))

    expect(archive.read('wf-0')).toBeNull()
    expect(localStorage.getItem(`${PAYLOAD_PREFIX}wf-0`)).toBeNull()
    expect(Object.keys(storedIndex()).sort()).toEqual(ids.slice(1).sort())
  })

  it('evicts only as many older graphs as a rejected write needs', () => {
    const archive = useAgentWorkflowDraftArchiveStore()
    archiveAt(archive, 'wf-oldest', 1)
    archiveAt(archive, 'wf-newer', 1)

    let rejected = false
    rejectWrites((key) => {
      if (key !== `${PAYLOAD_PREFIX}wf-new` || rejected) return false
      rejected = true
      return true
    })

    expect(archive.archive('wf-new', draft('wf-new'))).toBe(true)
    expect(archive.read('wf-new')).toMatchObject(draft('wf-new'))
    expect(archive.read('wf-oldest')).toBeNull()
    expect(archive.read('wf-newer')).toMatchObject(draft('wf-newer'))
  })

  it('reports and gives up rather than indexing a graph it could not store', () => {
    const archive = useAgentWorkflowDraftArchiveStore()
    archive.archive('wf-old', draft('wf-old'))
    rejectWrites((key) => key.startsWith(`${PAYLOAD_PREFIX}wf-new`))

    expect(archive.archive('wf-new', draft('wf-new'))).toBe(false)
    expect(archive.read('wf-new')).toBeNull()
    expect(storedIndex()).toEqual({})
    expect(vi.mocked(reportError)).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ errorType: 'storage_quota_exhausted' })
    )
  })

  it('drops an index entry whose payload went missing', () => {
    const archive = useAgentWorkflowDraftArchiveStore()
    archive.archive('wf-1', draft('wf-1'))
    localStorage.removeItem(`${PAYLOAD_PREFIX}wf-1`)

    expect(archive.read('wf-1')).toBeNull()
    expect(storedIndex()).toEqual({})
  })

  it('ignores a corrupt index instead of throwing', () => {
    const archive = useAgentWorkflowDraftArchiveStore()
    localStorage.setItem(INDEX_KEY, 'not json')

    expect(archive.read('wf-1')).toBeNull()
    expect(archive.archive('wf-1', draft('wf-1'))).toBe(true)
    expect(archive.read('wf-1')).toMatchObject(draft('wf-1'))
  })
})
