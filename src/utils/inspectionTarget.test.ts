import { describe, expect, it } from 'vitest'

import type { JobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'
import type { ResultItemType } from '@/schemas/apiSchema'
import { ResultItemImpl, TaskItemImpl } from '@/stores/queueStore'
import {
  canAttemptTaskInspection,
  getInspectionKindForFilename,
  getInspectionTarget,
  getInspectionTargets,
  getLightboxOutputs,
  getPreferredInspectionTarget
} from '@/utils/inspectionTarget'

function createResultItem({
  filename,
  mediaType = 'images',
  type = 'output',
  format
}: {
  filename: string
  mediaType?: string
  type?: ResultItemType
  format?: string
}): ResultItemImpl {
  return new ResultItemImpl({
    filename,
    subfolder: '',
    type,
    nodeId: 'node-1',
    mediaType,
    format
  })
}

function createTask(
  flatOutputs: ResultItemImpl[],
  outputsCount = flatOutputs.length
): TaskItemImpl {
  const job: JobListItem = {
    id: 'job-1',
    status: 'completed',
    create_time: 0,
    priority: 0,
    preview_output: null,
    outputs_count: outputsCount
  }
  return new TaskItemImpl(job, {}, flatOutputs)
}

describe('inspectionTarget', () => {
  it('routes image, video, and audio outputs to the lightbox', () => {
    const image = createResultItem({ filename: 'image.png' })
    const video = createResultItem({
      filename: 'clip.webm',
      mediaType: 'video'
    })
    const audio = createResultItem({
      filename: 'recording',
      mediaType: 'audio',
      format: 'audio/wav'
    })

    expect(getInspectionTarget(image)).toEqual({
      kind: 'lightbox',
      output: image
    })
    expect(getInspectionTarget(video)).toEqual({
      kind: 'lightbox',
      output: video
    })
    expect(getInspectionTarget(audio)).toEqual({
      kind: 'lightbox',
      output: audio
    })
  })

  it('routes loadable 3D outputs to load3d', () => {
    const output = createResultItem({
      filename: 'scan.ply',
      mediaType: '3D'
    })

    expect(getInspectionTarget(output)).toEqual({
      kind: 'load3d',
      output
    })
  })

  it('rejects non-loadable 3D outputs even when backend mediaType is stale', () => {
    const output = createResultItem({
      filename: 'asset.usdz',
      mediaType: 'images'
    })

    expect(output.is3D).toBe(true)
    expect(getInspectionTarget(output)).toBeNull()
  })

  it('filters inspection targets and lightbox outputs independently', () => {
    const image = createResultItem({ filename: 'image.png' })
    const model = createResultItem({ filename: 'model.ply', mediaType: '3D' })
    const text = createResultItem({ filename: 'note.txt', mediaType: 'text' })

    const targets = getInspectionTargets([image, model, text])

    expect(targets).toEqual([
      { kind: 'lightbox', output: image },
      { kind: 'load3d', output: model }
    ])
    expect(getLightboxOutputs(targets)).toEqual([image])
  })

  it('prefers the last saved output target over temp targets', () => {
    const temp = createResultItem({ filename: 'temp.png', type: 'temp' })
    const firstOutput = createResultItem({ filename: 'first.png' })
    const lastOutput = createResultItem({ filename: 'last.png' })

    expect(
      getPreferredInspectionTarget(
        getInspectionTargets([temp, firstOutput, lastOutput])
      )?.output
    ).toBe(lastOutput)
  })

  it('exposes filename-level inspection kind for asset callers', () => {
    expect(getInspectionKindForFilename('image.png')).toBe('lightbox')
    expect(getInspectionKindForFilename('clip.mp4')).toBe('lightbox')
    expect(getInspectionKindForFilename('recording.wav')).toBe('lightbox')
    expect(getInspectionKindForFilename('scan.ply')).toBe('load3d')
    expect(getInspectionKindForFilename('asset.usdz')).toBeNull()
    expect(getInspectionKindForFilename('metadata.json')).toBeNull()
  })

  it('allows multi-output tasks to attempt inspection before full outputs load', () => {
    const task = createTask([], 2)

    expect(canAttemptTaskInspection(task)).toBe(true)
  })
})
