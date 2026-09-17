import { describe, expect, it } from 'vitest'

import type { WorkspaceRelease } from '@comfyorg/ingest-types'

import type { ReleasePickEvent, ReleasePickState } from './releasePickState'
import { reduceReleasePick } from './releasePickState'

const release: WorkspaceRelease = {
  release_id: 'r-1',
  build_name: 'Studio Build',
  version: 1,
  deployed: true,
  deployment_status: 'ready'
}

const loaded: ReleasePickEvent = {
  type: 'loaded',
  releases: [release],
  pickedReleaseId: 'r-1',
  buildsVisible: true
}

const ready: ReleasePickState = {
  phase: 'ready',
  releases: [release],
  pickedReleaseId: 'r-1',
  buildsVisible: true
}

describe('reduceReleasePick', () => {
  it('loads into ready, or into hidden or unavailable when refused or failed', () => {
    expect(
      reduceReleasePick({ phase: 'idle' }, { type: 'loadStarted' })
    ).toEqual({ phase: 'loading' })
    expect(reduceReleasePick({ phase: 'loading' }, loaded)).toEqual(ready)
    expect(
      reduceReleasePick({ phase: 'loading' }, { type: 'loadRefused' })
    ).toEqual({ phase: 'hidden' })
    expect(
      reduceReleasePick(
        { phase: 'loading' },
        { type: 'loadFailed', message: 'comfy-deploy is down' }
      )
    ).toEqual({ phase: 'unavailable', message: 'comfy-deploy is down' })
  })

  it('switches only from ready, and a failed switch returns to ready', () => {
    const switching = reduceReleasePick(ready, {
      type: 'switchStarted',
      target: null
    })
    expect(switching).toEqual({ ...ready, phase: 'switching', target: null })
    expect(reduceReleasePick(switching, { type: 'switchFailed' })).toEqual(
      ready
    )

    for (const state of [
      { phase: 'idle' },
      { phase: 'loading' },
      { phase: 'hidden' },
      { phase: 'unavailable', message: 'x' }
    ] satisfies ReleasePickState[]) {
      expect(
        reduceReleasePick(state, { type: 'switchStarted', target: 'r-1' })
      ).toBe(state)
    }
    expect(reduceReleasePick(ready, { type: 'switchFailed' })).toBe(ready)
  })

  it('does not drop an in-flight switch for a reload of the list', () => {
    const switching = reduceReleasePick(ready, {
      type: 'switchStarted',
      target: 'r-1'
    })
    expect(reduceReleasePick(switching, { type: 'loadStarted' })).toBe(
      switching
    )
  })
})
