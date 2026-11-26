import { describe, expect, it } from 'vitest'

import { readFrameMessage } from './platformFrameMessages'

describe('readFrameMessage', () => {
  it.for([
    { type: 'ready', signedIn: false },
    { type: 'ready', signedIn: true, userId: 'uid-ana' },
    { type: 'ready', signedIn: true, userId: null },
    { type: 'token-wanted', userId: 'uid-ana' },
    { type: 'content-height', height: 304 },
    { type: 'content-height', height: null },
    {
      type: 'build-started',
      kind: 'update',
      buildId: 'b-1',
      releaseId: 'r-2',
      version: 2,
      deploymentId: 'd-1',
      deploymentName: 'portrait-upscale'
    },
    {
      type: 'build-progress',
      releaseId: 'r-2',
      step: 3,
      of: 5,
      label: 'Installing nodes'
    },
    { type: 'build-failed', releaseId: 'r-2', reason: 'pip failed' },
    { type: 'deploy-sent', releaseId: 'r-2', deploymentId: 'd-1' },
    { type: 'deployment-ready', releaseId: 'r-2', deploymentId: 'd-1' },
    {
      type: 'deploy-failed',
      releaseId: 'r-2',
      deploymentId: 'd-1',
      reason: 'timed_out'
    }
  ])('takes $type as Platform sends it (case %$)', (message) => {
    expect(readFrameMessage(message)).toEqual(message)
  })

  it.for([
    { label: 'a string', data: 'ready' },
    { label: 'null', data: null },
    { label: 'an array', data: [{ type: 'ready', signedIn: false }] },
    { label: 'an unknown type', data: { type: 'close' } },
    { label: 'ready with no signedIn', data: { type: 'ready' } },
    {
      label: 'ready with a numeric userId',
      data: { type: 'ready', signedIn: true, userId: 7 }
    },
    { label: 'token-wanted with no userId', data: { type: 'token-wanted' } },
    {
      label: 'content-height as a string',
      data: { type: 'content-height', height: '304px' }
    },
    {
      label: 'content-height of no pixels',
      data: { type: 'content-height', height: 0 }
    },
    {
      label: 'build-started with an unknown kind',
      data: {
        type: 'build-started',
        kind: 'delete',
        buildId: 'b-1',
        releaseId: 'r-2',
        version: 2,
        deploymentId: 'd-1',
        deploymentName: 'portrait-upscale'
      }
    },
    {
      label: 'build-progress with a step that is not a number',
      data: {
        type: 'build-progress',
        releaseId: 'r-2',
        step: '3',
        of: 5,
        label: 'Installing nodes'
      }
    },
    {
      label: 'deploy-failed with no reason',
      data: { type: 'deploy-failed', releaseId: 'r-2', deploymentId: 'd-1' }
    },
    {
      label: 'build-waiting, which Platform does not send',
      data: { type: 'build-waiting', releaseId: 'r-2', deploymentId: 'd-1' }
    },
    {
      label: 'deployment-ready with no deployment',
      data: { type: 'deployment-ready', releaseId: 'r-2' }
    }
  ])('drops $label', ({ data }) => {
    expect(readFrameMessage(data)).toBeNull()
  })

  it('keeps only the fields of the contract', () => {
    expect(
      readFrameMessage({
        type: 'deploy-sent',
        releaseId: 'r-2',
        deploymentId: 'd-1',
        run: 'rm -rf /'
      })
    ).toEqual({ type: 'deploy-sent', releaseId: 'r-2', deploymentId: 'd-1' })
  })
})
