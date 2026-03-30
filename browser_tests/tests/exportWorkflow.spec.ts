import { readFileSync } from 'fs'

import { expect } from '@playwright/test'

import type {
  ComfyApiWorkflow,
  ComfyWorkflowJSON
} from '../../src/platform/workflow/validation/schemas/workflowSchema'
import { comfyPageFixture as test } from '../fixtures/ComfyPage'

const EXPECTED_NODE_TYPES = [
  'CheckpointLoaderSimple',
  'CLIPTextEncode',
  'CLIPTextEncode',
  'EmptyLatentImage',
  'KSampler',
  'SaveImage',
  'VAEDecode'
]

test.describe('Export workflow', () => {
  test('Export downloads workflow JSON with correct structure', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('default')

    const downloadPromise = comfyPage.page.waitForEvent('download')
    await comfyPage.menu.topbar.exportWorkflow('test_export.json')
    const download = await downloadPromise

    expect(download.suggestedFilename()).toBe('test_export.json')

    const filePath = await download.path()
    expect(filePath).toBeTruthy()
    const parsed: ComfyWorkflowJSON = JSON.parse(
      readFileSync(filePath!, 'utf-8')
    )

    expect(parsed.version).toBe(0.4)
    expect(parsed.nodes).toHaveLength(7)
    expect(parsed.links).toHaveLength(9)
    expect(parsed.extra).toBeDefined()

    const nodeTypes = parsed.nodes.map((n) => n.type).sort()
    expect(nodeTypes).toEqual([...EXPECTED_NODE_TYPES].sort())

    for (const node of parsed.nodes) {
      expect(node.id).toBeGreaterThan(0)
      expect(node.type).toBeTruthy()
      expect(node.pos).toBeDefined()

      for (const slot of node.inputs ?? []) {
        expect(slot).not.toHaveProperty('localized_name')
        expect(slot).not.toHaveProperty('label')
      }
      for (const slot of node.outputs ?? []) {
        expect(slot).not.toHaveProperty('localized_name')
        expect(slot).not.toHaveProperty('label')
      }
    }
  })

  test('Export (API) downloads API JSON with correct structure', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('default')

    const downloadPromise = comfyPage.page.waitForEvent('download')
    await comfyPage.menu.topbar.exportWorkflowApi('test_api_export.json')
    const download = await downloadPromise

    expect(download.suggestedFilename()).toBe('test_api_export.json')

    const filePath = await download.path()
    expect(filePath).toBeTruthy()
    const parsed: ComfyApiWorkflow = JSON.parse(
      readFileSync(filePath!, 'utf-8')
    )

    // Node ID keys must be numeric or colon-separated numeric paths
    // e.g. "3", "48:9", "65:35:76"
    const nodeIdPattern = /^\d+(?::\d+)*$/
    const keys = Object.keys(parsed)
    expect(keys).toHaveLength(7)
    for (const key of keys) {
      expect(key).toMatch(nodeIdPattern)
    }

    const entries = Object.values(parsed)
    const classTypes = entries.map((e) => e.class_type).sort()
    expect(classTypes).toEqual([...EXPECTED_NODE_TYPES].sort())

    // Each entry must have exactly 3 keys with correct types
    for (const entry of entries) {
      expect(Object.keys(entry).sort()).toEqual(
        ['_meta', 'class_type', 'inputs'].sort()
      )
      expect(typeof entry.class_type).toBe('string')
      expect(entry.class_type.length).toBeGreaterThan(0)
      expect(typeof entry.inputs).toBe('object')
      expect(entry.inputs).not.toBeNull()
      expect(entry._meta).toEqual({ title: expect.any(String) })
    }

    // No visual/UI properties should leak into the API format
    for (const entry of entries) {
      for (const uiProp of ['pos', 'size', 'flags', 'order', 'mode']) {
        expect(entry).not.toHaveProperty(uiProp)
      }
    }

    // Verify connection tuples: [stringNodeId, numberSlotIndex]
    const ksampler = entries.find((e) => e.class_type === 'KSampler')
    expect(ksampler).toBeDefined()
    for (const inputName of ['model', 'positive', 'negative', 'latent_image']) {
      const value = ksampler!.inputs[inputName]
      expect(Array.isArray(value)).toBe(true)
      expect(value).toHaveLength(2)
      expect(value[0]).toMatch(nodeIdPattern)
      expect(typeof value[1]).toBe('number')
    }

    // Verify widget values are plain scalars, not connection tuples
    expect(typeof ksampler!.inputs['steps']).toBe('number')
    expect(typeof ksampler!.inputs['cfg']).toBe('number')
    expect(typeof ksampler!.inputs['sampler_name']).toBe('string')
    expect(typeof ksampler!.inputs['scheduler']).toBe('string')
    expect(typeof ksampler!.inputs['denoise']).toBe('number')
  })
})
