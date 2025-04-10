import { describe, expect, it } from 'vitest'

import type { ComfyWorkflowJSON } from '@/schemas/comfyWorkflowSchema'
import { processWorkflowForExport } from '@/utils/executionUtil'

describe('processWorkflowForExport', () => {
  it('should remove localized_name from inputs and outputs', () => {
    const workflow = {
      nodes: [
        {
          id: 1,
          inputs: [
            { name: 'input1', type: 'INT', localized_name: 'Input One' },
            { name: 'input2', type: 'FLOAT', localized_name: 'Input Two' }
          ],
          outputs: [
            { name: 'output1', type: 'STRING', localized_name: 'Output One' },
            { name: 'output2', type: 'BOOLEAN', localized_name: 'Output Two' }
          ]
        }
      ],
      links: []
    } as unknown as ComfyWorkflowJSON

    const processed = processWorkflowForExport(workflow)

    // Check inputs
    expect(processed.nodes[0].inputs?.[0]).not.toHaveProperty('localized_name')
    expect(processed.nodes[0].inputs?.[1]).not.toHaveProperty('localized_name')
    // Check outputs
    expect(processed.nodes[0].outputs?.[0]).not.toHaveProperty('localized_name')
    expect(processed.nodes[0].outputs?.[1]).not.toHaveProperty('localized_name')
    // Verify other properties remain unchanged
    expect(processed.nodes[0].inputs?.[0].name).toBe('input1')
    expect(processed.nodes[0].outputs?.[0].name).toBe('output1')
  })

  it('should compress widget input slots', () => {
    const workflow: ComfyWorkflowJSON = {
      nodes: [
        {
          id: 1,
          inputs: [
            { widget: true, link: null },
            { widget: true, link: 2 },
            { widget: false, link: null },
            { widget: true, link: 3 }
          ],
          outputs: []
        }
      ],
      links: [
        [2, 2, 0, 1, 1],
        [3, 3, 0, 1, 3]
      ]
    } as unknown as ComfyWorkflowJSON

    const processed = processWorkflowForExport(workflow)

    // Check that unconnected widget inputs are removed
    expect(processed.nodes[0].inputs).toEqual([
      { widget: true, link: 2 },
      { widget: false, link: null },
      { widget: true, link: 3 }
    ])

    // Check that link target slots are updated
    expect(processed.links).toEqual([
      [2, 2, 0, 1, 0],
      [3, 3, 0, 1, 2]
    ])
  })

  it('should handle empty workflow', () => {
    const workflow: ComfyWorkflowJSON = {
      nodes: [],
      links: []
    } as unknown as ComfyWorkflowJSON

    const processed = processWorkflowForExport(workflow)

    expect(processed).toEqual({
      nodes: [],
      links: []
    })
  })

  it('should preserve other node properties', () => {
    const workflow: ComfyWorkflowJSON = {
      nodes: [
        {
          id: 1,
          type: 'TestNode',
          pos: [100, 100],
          size: [200, 150],
          flags: {},
          order: 0,
          mode: 0,
          inputs: [{ widget: true, link: 2 }],
          outputs: [{ name: 'output1', type: 'INT' }],
          properties: { customProp: 'value' }
        }
      ],
      links: [[2, 2, 0, 1, 0]]
    } as unknown as ComfyWorkflowJSON

    const processed = processWorkflowForExport(workflow)

    expect(processed.nodes[0]).toMatchObject({
      id: 1,
      type: 'TestNode',
      pos: [100, 100],
      size: [200, 150],
      flags: {},
      order: 0,
      mode: 0,
      properties: { customProp: 'value' }
    })
  })
})
