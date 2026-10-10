import { describe, expect, it } from 'vitest'

import type { DarkroomJob } from './feed'
import {
  doneSlots,
  downloadName,
  formatTokens,
  jobsFromStore,
  pendingCount,
  promptHistory,
  usageSummary,
  withoutItems,
  withSlot
} from './feed'
import { planSheets, sheetGrid } from './moodboard'
import type { DarkroomRequest } from './request'
import type { DarkroomItem, DarkroomPending } from './store'

function settings(over: Partial<DarkroomRequest> = {}): DarkroomRequest {
  return {
    prompt: 'a fox reading a map',
    model: 'vertexai/gemini-nano-banana-2.1',
    aspectRatio: '16:9',
    imageSize: '2K',
    mimeType: 'image/png',
    temperature: 1,
    seed: 100,
    jobId: 'job-a',
    run: 0,
    runs: 2,
    inputCount: 0,
    ...over
  }
}

function item(
  id: string,
  over: Partial<DarkroomRequest> = {},
  rest: Partial<DarkroomItem> = {}
): DarkroomItem {
  return {
    id,
    created: 1_000,
    mime: 'image/png',
    settings: settings(over),
    stats: { finishReasons: ['STOP'], totalTokens: 1200 },
    text: [],
    ...rest
  }
}

function pending(over: Partial<DarkroomRequest> = {}): DarkroomPending {
  return {
    requestId: '18655193-3f73-4abf-b49c-1c6a058355bc',
    settings: settings(over),
    created: 2_000,
    imageCount: 0
  }
}

describe('jobsFromStore', () => {
  it('groups saved images into rows by job, newest row first', () => {
    const jobs = jobsFromStore(
      [
        item('a1', { run: 1, seed: 101 }),
        item('a0'),
        item(
          'b0',
          { jobId: 'job-b', prompt: 'a lighthouse' },
          { created: 5_000 }
        )
      ],
      []
    )
    expect(jobs.map((job) => job.jobId)).toEqual(['job-b', 'job-a'])
    expect(jobs[1].slots.map((slot) => slot.seed)).toEqual([100, 101])
    expect(jobs[1].settings.seed).toBe(100)
  })

  it('puts a request Router still holds back in its row', () => {
    const [job] = jobsFromStore([item('a0')], [pending({ run: 1, seed: 101 })])
    expect(job.slots.map((slot) => slot.status)).toEqual(['done', 'pending'])
    expect(job.slots[1]).toMatchObject({
      phase: 'queued',
      requestId: '18655193-3f73-4abf-b49c-1c6a058355bc'
    })
    expect(pendingCount([job])).toBe(1)
  })

  it('does not show a request twice once its image is saved', () => {
    const [job] = jobsFromStore([item('a0')], [pending()])
    expect(job.slots).toHaveLength(1)
    expect(job.slots[0].status).toBe('done')
  })
})

describe('feed changes', () => {
  const jobs = jobsFromStore(
    [item('a0'), item('a1', { run: 1 }), item('b0', { jobId: 'job-b' })],
    []
  )

  it('replaces one slot and leaves the other rows untouched', () => {
    const next = withSlot(jobs, 'job-a:1', (slot) => ({
      key: slot.key,
      run: slot.run,
      seed: slot.seed,
      status: 'error',
      failure: 'generic',
      detail: ''
    }))
    expect(next[0].slots[1].status).toBe('error')
    expect(next[1]).toBe(jobs[1])
  })

  it('drops deleted images, and a row once nothing is left of it', () => {
    const next = withoutItems(jobs, new Set(['a0', 'b0']))
    expect(next.map((job) => job.jobId)).toEqual(['job-a'])
    expect(doneSlots(next).map((slot) => slot.item.id)).toEqual(['a1'])
  })

  it('drops a row left with only failed tiles', () => {
    const failed: DarkroomJob[] = withSlot(jobs, 'job-a:1', (slot) => ({
      key: slot.key,
      run: slot.run,
      seed: slot.seed,
      status: 'error',
      failure: 'generic',
      detail: ''
    }))
    expect(
      withoutItems(failed, new Set(['a0'])).map((job) => job.jobId)
    ).toEqual(['job-b'])
  })

  it('lists earlier prompts once each', () => {
    expect(promptHistory(jobs)).toEqual(['a fox reading a map'])
  })
})

describe('downloadName', () => {
  it('names a download from the prompt and seed', () => {
    expect(
      downloadName(
        item('a', { prompt: 'A Fox, reading a map in a lantern-lit forest!' })
      )
    ).toBe('a-fox-reading-a-map-in_s100.png')
  })

  it('falls back when the prompt has no plain letters', () => {
    expect(
      downloadName(item('a', { prompt: '狐狸' }, { mime: 'image/jpeg' }))
    ).toBe('darkroom_s100.jpg')
  })
})

describe('usage', () => {
  it('counts the images made today apart from the total', () => {
    const now = new Date(2026, 9, 10, 15)
    const today = new Date(2026, 9, 10, 9).getTime()
    const earlier = new Date(2026, 9, 8, 9).getTime()
    const jobs = jobsFromStore(
      [
        item('a0', {}, { created: today }),
        item('b0', { jobId: 'job-b' }, { created: earlier })
      ],
      []
    )
    expect(usageSummary(jobs, now)).toEqual({
      todayImages: 1,
      todayTokens: 1200,
      totalTokens: 2400
    })
  })

  it.for([
    [950, '950'],
    [1200, '1.2k'],
    [2_500_000, '2.5M']
  ] as const)('writes %s tokens as %s', ([count, text]) => {
    expect(formatTokens(count)).toBe(text)
  })
})

describe('planSheets', () => {
  const sizes = (count: number) =>
    planSheets(Array.from({ length: count }, (_, index) => index)).map(
      (sheet) => sheet.length
    )

  it.for([
    [0, []],
    [5, [5]],
    [7, [4, 3]],
    [25, [5, 5, 5, 5, 5]],
    [30, [6, 6, 6, 6, 6]],
    [36, [6, 6, 6, 6, 6, 6]]
  ] as const)('spreads %s images as %j', ([count, expected]) => {
    expect(sizes(count)).toEqual(expected)
  })

  it('samples a board past 36 images evenly down to 36', () => {
    const sheets = planSheets(Array.from({ length: 72 }, (_, index) => index))
    expect(sheets).toHaveLength(6)
    expect(sheets.flat()).toEqual(
      Array.from({ length: 36 }, (_, index) => index * 2)
    )
  })

  it('lays four images two by two and the rest three across', () => {
    expect(sheetGrid(4)).toEqual({ cols: 2, rows: 2 })
    expect(sheetGrid(5)).toEqual({ cols: 3, rows: 2 })
    expect(sheetGrid(2)).toEqual({ cols: 2, rows: 1 })
  })
})
