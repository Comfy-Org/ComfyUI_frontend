import { describe, expect, it } from 'vitest'

import {
  missingFromCloud,
  packsCloudLacks,
  workflowReach
} from './workflow-reach'

describe('packsCloudLacks', () => {
  // The registry, Cloud's listing and the pack's own README each spell the
  // same pack differently, and none of the three is canonical, so a match
  // that only accepts one spelling would report installs that are already
  // there.
  it.for([
    'comfyui_ipadapter_plus',
    'ComfyUI_IPAdapter_plus',
    'ComfyUI-IPAdapter-Plus',
    'comfyui ipadapter plus'
  ])('reads %s as the pack Cloud already carries', (spelling) => {
    expect(packsCloudLacks([spelling])).toEqual([])
  })

  it('names a pack nothing on Cloud carries', () => {
    expect(packsCloudLacks(['a-pack-nobody-published'])).toEqual([
      'a-pack-nobody-published'
    ])
  })

  it('names nothing when the workflow asks for nothing', () => {
    expect(packsCloudLacks([])).toEqual([])
  })
})

describe('workflowReach', () => {
  // Only two states change what a reader or a developer can do next: the page
  // runs it here, or nothing shared runs it at all. The shared endpoint is the
  // ordinary case and the one the launch list is mostly made of.
  it('sends a workflow with its own deployment to its own endpoint', () => {
    expect(
      workflowReach(
        'template_ltx2_3_obscura_remova_lora_remove_object_from_video',
        false
      )
    ).toBe('endpoint')
  })

  it('keeps a plain Cloud workflow on the shared endpoint', () => {
    expect(workflowReach('video_ltx2_3_i2v', false)).toBe('cloud')
  })

  it('says here when the page itself runs it', () => {
    expect(workflowReach('video_ltx2_3_i2v', true)).toBe('here')
  })

  // A workflow needing a pack Cloud does not carry cannot run on the shared
  // endpoint however it is opened, so running inline does not rescue it.
  it('will not call a workflow inline that Cloud cannot serve', () => {
    expect(
      workflowReach(
        'template_ltx2_3_obscura_remova_lora_remove_object_from_video',
        true
      )
    ).toBe('endpoint')
  })

  it('names no missing pack for a workflow the registry does not list', () => {
    expect(missingFromCloud('not-a-template')).toEqual([])
  })
})
