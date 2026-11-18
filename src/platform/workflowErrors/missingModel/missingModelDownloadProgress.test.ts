import { describe, expect, it } from 'vitest'

import { formatDownloadedBytes } from '@/platform/workflowErrors/missingModel/missingModelDownloadProgress'

const MB = 1024 * 1024

describe(formatDownloadedBytes, () => {
  it.for([
    {
      case: 'both counts',
      received: 256 * MB,
      total: 1024 * MB,
      label: '256 MB / 1 GB'
    },
    {
      case: 'an unknown total',
      received: 256 * MB,
      total: null,
      label: '256 MB'
    },
    { case: 'a zero total', received: 256 * MB, total: 0, label: '256 MB' },
    {
      case: 'more received than the total',
      received: 2048 * MB,
      total: 1024 * MB,
      label: '2 GB'
    },
    { case: 'no counts', received: null, total: null, label: undefined }
  ])('labels a download with $case as $label', ({ received, total, label }) => {
    expect(
      formatDownloadedBytes({
        status: 'downloading',
        paused: false,
        receivedBytes: received,
        totalBytes: total,
        fraction: null
      })
    ).toBe(label)
  })
})
