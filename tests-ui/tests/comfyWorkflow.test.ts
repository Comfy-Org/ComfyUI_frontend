// @ts-strict-ignore
import fs from 'fs'

import { ComfyWorkflowJSON, validateComfyWorkflow } from '@/types/comfyWorkflow'

const WORKFLOW_DIR = 'tests-ui/workflows'

const createGraph = (): ComfyWorkflowJSON => ({
  config: {},
  extra: {},
  groups: [],
  last_link_id: 0,
  last_node_id: 0,
  links: [] as any,
  models: [],
  nodes: [
    {
      flags: {},
      id: 1,
      inputs: [],
      mode: 0,
      order: 0,
      outputs: [],
      pos: [0, 0],
      properties: {},
      size: [200, 200],
      type: 'KSampler',
      widgets_values: []
    }
  ],
  version: 0.4
})

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
    const workflow = createGraph()
    workflow.nodes = undefined
    expect(await validateComfyWorkflow(workflow)).toBeNull()

    workflow.nodes = null
    expect(await validateComfyWorkflow(workflow)).toBeNull()

    workflow.nodes = []
    expect(await validateComfyWorkflow(workflow)).not.toBeNull()
  })

  it('workflow.version', async () => {
    const workflow = createGraph()
    workflow.version = undefined
    expect(await validateComfyWorkflow(workflow)).toBeNull()

    // @ts-expect-error - Invalid format (string)
    workflow.version = '1.0.1' // Invalid format (string)
    expect(await validateComfyWorkflow(workflow)).toBeNull()

    // 2018-2024 schema: 0.4
    workflow.version = 0.4
    expect(await validateComfyWorkflow(workflow)).not.toBeNull()
  })

  it('workflow.extra', async () => {
    const workflow = createGraph()
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
    const workflow = createGraph()

    workflow.nodes[0].pos = [1, 2, 3]
    expect(await validateComfyWorkflow(workflow)).toBeNull()

    workflow.nodes[0].pos = [1, 2]
    expect(await validateComfyWorkflow(workflow)).not.toBeNull()

    // Should automatically transform the legacy format object to array.
    // @ts-expect-error - Invalid format (object)
    workflow.nodes[0].pos = { '0': 3, '1': 4 }
    let validatedWorkflow = await validateComfyWorkflow(workflow)
    expect(validatedWorkflow.nodes[0].pos).toEqual([3, 4])

    // @ts-expect-error - Invalid format (object)
    workflow.nodes[0].pos = { 0: 3, 1: 4 }
    validatedWorkflow = await validateComfyWorkflow(workflow)
    expect(validatedWorkflow.nodes[0].pos).toEqual([3, 4])

    // Should accept the legacy bugged format object.
    // https://github.com/Comfy-Org/ComfyUI_frontend/issues/710
    // @ts-expect-error - Invalid format (object)
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
    expect(validatedWorkflow.nodes[0].pos).toEqual([600, 340])
  })

  it('workflow.nodes.widget_values', async () => {
    const workflow = createGraph()
    workflow.nodes[0].widgets_values = ['foo', 'bar']
    expect(await validateComfyWorkflow(workflow)).not.toBeNull()

    // @ts-expect-error - Invalid format (string)
    workflow.nodes[0].widgets_values = 'foo'
    expect(await validateComfyWorkflow(workflow)).toBeNull()

    workflow.nodes[0].widgets_values = undefined
    expect(await validateComfyWorkflow(workflow)).not.toBeNull()

    // The object format of widgets_values is used by VHS nodes to perform
    // dynamic widgets display.
    workflow.nodes[0].widgets_values = { foo: 'bar' }
    const validatedWorkflow = await validateComfyWorkflow(workflow)
    expect(validatedWorkflow.nodes[0].widgets_values).toEqual({ foo: 'bar' })
  })

  it('workflow.links', async () => {
    const workflow = createGraph()

    workflow.links = [
      // @ts-expect-error - Invalid format
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
})
