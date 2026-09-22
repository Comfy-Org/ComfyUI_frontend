import { describe, expect, it } from 'vitest'
import { workflows } from './workflow-catalogue'
import { workflowGraphSchema } from './workflow-execution'

const graphs = import.meta.glob('../data/workflows/*.json', {
  eager: true,
  import: 'default'
})

describe('curated workflow contracts', () => {
  it('connects separate start and end frames to the correct video guides', () => {
    const graph = workflowGraphSchema.parse(
      graphs['../data/workflows/video_ltx2_3_flf2v.json']
    )
    expect(graph['129:124'].inputs.input).toEqual(['31', 0])
    expect(graph['129:125'].inputs.input).toEqual(['39', 0])
    expect(graph['129:104'].inputs.image).toEqual(['129:124', 0])
    expect(graph['129:99'].inputs.image).toEqual(['129:125', 0])
    expect(graph['129:115'].inputs).toMatchObject({
      frame_idx: 0,
      image: ['129:104', 0]
    })
    expect(graph['129:111'].inputs).toMatchObject({
      frame_idx: -1,
      image: ['129:99', 0]
    })
  })
  it.for(workflows)(
    '$slug exposes only inputs in its pinned execution graph',
    (workflow) => {
      const graph = workflowGraphSchema.parse(
        graphs[`../data/workflows/${workflow.template}.json`]
      )
      for (const field of workflow.fields) {
        expect(graph[field.node]).toBeDefined()
        expect(Object.hasOwn(graph[field.node].inputs, field.input)).toBe(true)
        const value = graph[field.node].inputs[field.input]
        expect(Array.isArray(value)).toBe(false)
        expect(typeof value).toBe(field.kind === 'number' ? 'number' : 'string')
      }
      for (const node of Object.values(graph)) {
        for (const input of Object.values(node.inputs)) {
          if (Array.isArray(input) && typeof input[0] === 'string')
            expect(graph[input[0]]).toBeDefined()
        }
      }
    }
  )
})
