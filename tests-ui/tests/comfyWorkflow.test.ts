import fs from 'fs'
import { describe, expect, it } from 'vitest'

import { validateComfyWorkflow } from '@/schemas/comfyWorkflowSchema'
import { defaultGraph } from '@/scripts/defaultGraph'

const WORKFLOW_DIR = 'tests-ui/workflows'

describe('parseComfyWorkflow', () => {
  it('parses valid workflow', async () => {
    fs.readdirSync(WORKFLOW_DIR).forEach(async (file) => {
      if (file.endsWith('.json')) {
        const data = fs.readFileSync(`${WORKFLOW_DIR}/${file}`, 'utf-8')
        expect(await validateComfyWorkflow(JSON.parse(data))).not.toBeNull()
      }
    })
  })

  it('workflow.nodes', async () => {
    const workflow = JSON.parse(JSON.stringify(defaultGraph))
    workflow.nodes = undefined
    expect(await validateComfyWorkflow(workflow)).toBeNull()

    workflow.nodes = null
    expect(await validateComfyWorkflow(workflow)).toBeNull()

    workflow.nodes = []
    expect(await validateComfyWorkflow(workflow)).not.toBeNull()
  })

  it('workflow.version', async () => {
    const workflow = JSON.parse(JSON.stringify(defaultGraph))
    workflow.version = undefined
    expect(await validateComfyWorkflow(workflow)).toBeNull()

    workflow.version = '1.0.1' // Invalid format (string)
    expect(await validateComfyWorkflow(workflow)).toBeNull()

    // 2018-2024 schema: 0.4
    workflow.version = 0.4
    expect(await validateComfyWorkflow(workflow)).not.toBeNull()
  })

  it('workflow.extra', async () => {
    const workflow = JSON.parse(JSON.stringify(defaultGraph))
    workflow.extra = undefined
    expect(await validateComfyWorkflow(workflow)).not.toBeNull()

    workflow.extra = null
    expect(await validateComfyWorkflow(workflow)).not.toBeNull()

    workflow.extra = {}
    expect(await validateComfyWorkflow(workflow)).not.toBeNull()

    workflow.extra = { foo: 'bar' } // Should accept extra fields.
    expect(await validateComfyWorkflow(workflow)).not.toBeNull()
  })

  it('workflow.nodes.pos', async () => {
    const workflow = JSON.parse(JSON.stringify(defaultGraph))
    workflow.nodes[0].pos = [1, 2, 3]
    expect(await validateComfyWorkflow(workflow)).toBeNull()

    workflow.nodes[0].pos = [1, 2]
    expect(await validateComfyWorkflow(workflow)).not.toBeNull()

    // Should automatically transform the legacy format object to array.
    workflow.nodes[0].pos = { '0': 3, '1': 4 }
    let validatedWorkflow = await validateComfyWorkflow(workflow)
    // @ts-expect-error fixme ts strict error
    expect(validatedWorkflow.nodes[0].pos).toEqual([3, 4])

    workflow.nodes[0].pos = { 0: 3, 1: 4 }
    validatedWorkflow = await validateComfyWorkflow(workflow)
    // @ts-expect-error fixme ts strict error
    expect(validatedWorkflow.nodes[0].pos).toEqual([3, 4])

    // Should accept the legacy bugged format object.
    // https://github.com/Comfy-Org/ComfyUI_frontend/issues/710
    workflow.nodes[0].pos = {
      '0': 600,
      '1': 340,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
      '6': 0,
      '7': 0,
      '8': 0,
      '9': 0
    }
    validatedWorkflow = await validateComfyWorkflow(workflow)
    // @ts-expect-error fixme ts strict error
    expect(validatedWorkflow.nodes[0].pos).toEqual([600, 340])
  })

  it('workflow.nodes.widget_values', async () => {
    const workflow = JSON.parse(JSON.stringify(defaultGraph))
    workflow.nodes[0].widgets_values = ['foo', 'bar']
    expect(await validateComfyWorkflow(workflow)).not.toBeNull()

    workflow.nodes[0].widgets_values = 'foo'
    expect(await validateComfyWorkflow(workflow)).toBeNull()

    workflow.nodes[0].widgets_values = undefined
    expect(await validateComfyWorkflow(workflow)).not.toBeNull()

    // The object format of widgets_values is used by VHS nodes to perform
    // dynamic widgets display.
    workflow.nodes[0].widgets_values = { foo: 'bar' }
    const validatedWorkflow = await validateComfyWorkflow(workflow)
    // @ts-expect-error fixme ts strict error
    expect(validatedWorkflow.nodes[0].widgets_values).toEqual({ foo: 'bar' })
  })

  it('workflow.links', async () => {
    const workflow = JSON.parse(JSON.stringify(defaultGraph))

    workflow.links = [
      [
        1, // Link id
        '100:1', // Node id of source node
        '12', // Output slot# of source node
        '100:2', // Node id of destination node
        15, // Input slot# of destination node
        'INT' // Data type
      ]
    ]
    expect(await validateComfyWorkflow(workflow)).not.toBeNull()
  })

  describe('workflow.nodes.properties.aux_id', () => {
    const validAuxIds = [
      'valid/valid',
      'valid-username-with-dash/valid_github-repo-name-with-underscore'
    ]
    it.each(validAuxIds)('valid aux_id: %s', async (aux_id) => {
      const workflow = JSON.parse(JSON.stringify(defaultGraph))
      workflow.nodes[0].properties.aux_id = aux_id
      expect(await validateComfyWorkflow(workflow)).not.toBeNull()
    })
    const invalidAuxIds = [
      'invalid spaces in username/repo',
      'invalid-chars-name-$/repo',
      'github-name/invalid spaces in repo',
      'not-both-names-with-slash'
    ]
    it.each(invalidAuxIds)('invalid aux_id: %s', async (aux_id) => {
      const workflow = JSON.parse(JSON.stringify(defaultGraph))
      workflow.nodes[0].properties.aux_id = aux_id
      expect(await validateComfyWorkflow(workflow)).toBeNull()
    })
  })

  describe('workflow.nodes.properties.cnr_id', () => {
    const validCnrIds = ['valid', 'valid-with-dash', 'valid_with_underscores']
    it.each(validCnrIds)('valid cnr_id: %s', async (cnr_id) => {
      const workflow = JSON.parse(JSON.stringify(defaultGraph))
      workflow.nodes[0].properties.cnr_id = cnr_id
      expect(await validateComfyWorkflow(workflow)).not.toBeNull()
    })

    const invalidCnrIds = ['invalid cnr-id', 'invalid^cnr-id', 'invalid cnr id']
    it.each(invalidCnrIds)('invalid cnr_id: %s', async (cnr_id) => {
      const workflow = JSON.parse(JSON.stringify(defaultGraph))
      workflow.nodes[0].properties.cnr_id = cnr_id
      expect(await validateComfyWorkflow(workflow)).toBeNull()
    })
  })

  describe('workflow.nodes.properties.ver', () => {
    const validVersionStrings = [
      // Semver
      '0.1.0',
      '0.1.0-alpha',
      '0.1.0-alpha.1',
      '1.3.321',
      // Git hash
      '080e6d4af809a46852d1c4b7ed85f06e8a3a72be',
      // Special case
      'unknown',
      // Git describe
      'v0.3.9-7-g1419dee',
      'v0.3.9-7-g1419dee-dirty'
    ]
    it.each(validVersionStrings)('valid version: %s', async (ver) => {
      const workflow = JSON.parse(JSON.stringify(defaultGraph))
      workflow.nodes[0].properties.ver = ver
      expect(await validateComfyWorkflow(workflow)).not.toBeNull()
    })

    const invalidVersionStrings = [
      // Semver
      '0.1-alpha',
      '0. 1.0',
      '0.0.0.0',
      // Git hash
      '080e6d4af809a46852d1c4b7ed85f06e8a3a72be-invalid'
    ]
    it.each(invalidVersionStrings)('invalid version: %s', async (ver) => {
      const workflow = JSON.parse(JSON.stringify(defaultGraph))
      workflow.nodes[0].properties.ver = ver
      expect(await validateComfyWorkflow(workflow)).toBeNull()
    })
  })
})
