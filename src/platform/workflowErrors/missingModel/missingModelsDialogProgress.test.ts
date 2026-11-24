import { describe, expect, it } from 'vitest'

import type { MissingModelDownloadState } from '@/platform/workflowErrors/missingModel/missingModelDownloadStore'
import {
  missingModelsDialogPhase,
  missingModelsReceivedBytes
} from '@/platform/workflowErrors/missingModel/missingModelsDialogProgress'
import type { MissingModelDownload } from '@/platform/workflowErrors/missingModel/missingModelsDialogProgress'

const idle: MissingModelDownloadState = { status: 'idle' }
const pending: MissingModelDownloadState = { status: 'pending' }
const done: MissingModelDownloadState = { status: 'done' }
const failed: MissingModelDownloadState = { status: 'failed' }

function downloading(receivedBytes: number | null): MissingModelDownloadState {
  return {
    status: 'downloading',
    paused: false,
    receivedBytes,
    totalBytes: null,
    fraction: null
  }
}

function download(
  state: MissingModelDownloadState,
  size?: number
): MissingModelDownload {
  return { state, size }
}

describe(missingModelsDialogPhase, () => {
  it.for([
    { name: 'nothing started', states: [idle, idle], phase: 'offer' },
    { name: 'one queued', states: [pending, idle], phase: 'downloading' },
    {
      name: 'one running while another failed',
      states: [downloading(10), failed],
      phase: 'downloading'
    },
    { name: 'every model downloaded', states: [done, done], phase: 'ready' },
    {
      name: 'one failed, none running',
      states: [done, failed],
      phase: 'failed'
    },
    {
      name: 'one cancelled back to idle',
      states: [done, idle],
      phase: 'offer'
    },
    { name: 'no downloadable models', states: [], phase: 'offer' }
  ] as const)('is $phase when $name', ({ states, phase }) => {
    expect(
      missingModelsDialogPhase(states.map((state) => download(state)))
    ).toBe(phase)
  })
})

describe(missingModelsReceivedBytes, () => {
  it('adds finished files at their full size and running ones at what arrived', () => {
    expect(
      missingModelsReceivedBytes([
        download(done, 300),
        download(downloading(50), 200),
        download(idle, 500)
      ])
    ).toEqual({ received: 350, total: 1000 })
  })

  it('is unknown while any model has no known size', () => {
    expect(
      missingModelsReceivedBytes([download(done, 300), download(idle)])
    ).toBeUndefined()
  })

  it('never reports more than the total', () => {
    expect(
      missingModelsReceivedBytes([download(downloading(900), 100)])
    ).toEqual({ received: 100, total: 100 })
  })
})
