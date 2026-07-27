import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { referencedRunMedia } from '@e2e/fixtures/customNode/cloudMedia'
import { assetPath } from '@e2e/fixtures/utils/paths'

function readAsset(name: string): ComfyWorkflowJSON {
  return JSON.parse(
    readFileSync(resolve(assetPath(name)), 'utf-8')
  ) as ComfyWorkflowJSON
}

test.describe('referencedRunMedia', () => {
  test('detects the upload-form filename and ignores path-form and media-free workflows', () => {
    expect(
      referencedRunMedia(
        readAsset('customNodes/vhs_video_pipeline_cloud_run.json')
      )
    ).toEqual(['plain_video.mp4'])
    expect(
      referencedRunMedia(readAsset('customNodes/vhs_video_pipeline_run.json'))
    ).toEqual([])
    expect(
      referencedRunMedia(readAsset('customNodes/core_smoke.json'))
    ).toEqual([])
  })
})

test('the VHS cloud variant differs from the core workflow only by the node swap', () => {
  const core = readAsset('customNodes/vhs_video_pipeline_run.json')
  const cloud = readAsset('customNodes/vhs_video_pipeline_cloud_run.json')
  const loader = core.nodes[0]
  expect(loader.type).toBe('VHS_LoadVideoPath')
  expect(loader.properties['Node name for S&R']).toBe('VHS_LoadVideoPath')
  expect(loader.widgets_values).toEqual([
    'input/plain_video.mp4',
    0,
    0,
    0,
    0,
    0,
    1
  ])
  loader.type = 'VHS_LoadVideo'
  loader.properties['Node name for S&R'] = 'VHS_LoadVideo'
  loader.widgets_values = ['plain_video.mp4', 0, 0, 0, 0, 0, 1]
  expect(cloud).toEqual(core)
})
