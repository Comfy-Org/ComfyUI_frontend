import { describe, expect, it, vi } from 'vitest'

import { startTemplateInputDownloadGraphSync } from '@/platform/workflow/templates/composables/useTemplateInputDownloadGraphSync'

function completed(filename: string) {
  return {
    downloadId: `dl-${filename}`,
    filename,
    status: 'completed' as const,
    progress: 1,
    templateInputs: []
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('template input download graph sync', () => {
  it('awaits a rerun requested while a sync is in flight', async () => {
    const first = deferred<void>()
    const second = deferred<void>()
    const refreshGraphBindings = vi
      .fn<(names: string[]) => Promise<void>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const referenced = new Set(['a.png', 'b.png'])
    const sync = startTemplateInputDownloadGraphSync({
      getReferencedInputNames: () => referenced,
      refreshGraphBindings,
      reportError: vi.fn()
    })

    sync.handleProgress(completed('a.png'))
    const run = sync.syncCurrentGraph()
    let settled = false
    void run.then(() => {
      settled = true
    })
    await vi.waitFor(() => expect(refreshGraphBindings).toHaveBeenCalledOnce())

    sync.handleProgress(completed('b.png'))
    void sync.syncCurrentGraph()
    first.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(settled).toBe(false)
    await vi.waitFor(() =>
      expect(refreshGraphBindings).toHaveBeenCalledTimes(2)
    )
    expect(settled).toBe(false)

    second.resolve()
    await run
    expect(settled).toBe(true)
    sync.dispose()
  })

  it.for([
    { name: 'the view disposed', replace: false },
    { name: 'a replacement sync took over', replace: true }
  ])('abandons a queued rerun once $name', async ({ replace }) => {
    const first = deferred<void>()
    const refreshGraphBindings = vi
      .fn<(names: string[]) => Promise<void>>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(undefined)
    const referenced = new Set(['a.png'])
    const sync = startTemplateInputDownloadGraphSync({
      getReferencedInputNames: () => referenced,
      refreshGraphBindings,
      reportError: vi.fn()
    })

    sync.handleProgress(completed('a.png'))
    const inFlight = sync.syncCurrentGraph()
    void sync.syncCurrentGraph()

    // Starting a replacement disposes the previous sync, so both paths leave
    // the queued rerun with no graph it is entitled to refresh.
    const replacement = replace
      ? startTemplateInputDownloadGraphSync({
          getReferencedInputNames: () => referenced,
          refreshGraphBindings: vi.fn(async () => undefined),
          reportError: vi.fn()
        })
      : (sync.dispose(), null)

    // Fail the first attempt so the name survives and the rerun has work to
    // do; without that the guard never runs and this case proves nothing.
    first.reject(new Error('reload failed'))
    await inFlight

    expect(refreshGraphBindings).toHaveBeenCalledOnce()
    replacement?.dispose()
    sync.dispose()
  })

  it('retries an input whose rebind failed on the next sync', async () => {
    const reportError = vi.fn()
    const refreshGraphBindings = vi
      .fn<(names: string[]) => Promise<void>>()
      .mockRejectedValueOnce(new Error('reload failed'))
      .mockResolvedValue(undefined)
    const referenced = new Set(['a.png'])
    const sync = startTemplateInputDownloadGraphSync({
      getReferencedInputNames: () => referenced,
      refreshGraphBindings,
      reportError
    })

    sync.handleProgress(completed('a.png'))
    await sync.syncCurrentGraph()
    expect(reportError).toHaveBeenCalledOnce()

    // Cleared only once a rebind succeeds.
    await sync.syncCurrentGraph()
    await sync.syncCurrentGraph()
    expect(refreshGraphBindings).toHaveBeenCalledTimes(2)
    sync.dispose()
  })
})
