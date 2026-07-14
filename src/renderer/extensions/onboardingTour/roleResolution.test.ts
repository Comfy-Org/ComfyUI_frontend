import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

const resolveRoles = vi.hoisted(() => vi.fn())
vi.mock('./roleResolver', () => ({ resolveRoles }))

interface FakeNodeDef {
  output_node: boolean
  outputs: { type: string }[]
}
const nodeDefsByName = vi.hoisted(() => ({}) as Record<string, FakeNodeDef>)
vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => ({ nodeDefsByName })
}))

import { resolveTourRoles } from './roleResolution'

type Lookup = (
  type: string
) => { isOutputNode: boolean; producesVideo: boolean } | null

const workflow = {} as ComfyWorkflowJSON

function capturedLookup(): Lookup {
  return resolveRoles.mock.calls[0][2] as Lookup
}

describe('resolveTourRoles', () => {
  beforeEach(() => {
    resolveRoles.mockReset()
    for (const key of Object.keys(nodeDefsByName)) delete nodeDefsByName[key]
  })

  it('forwards the workflow and templateId to resolveRoles', () => {
    resolveTourRoles(workflow, 'image_z_image_turbo')

    expect(resolveRoles).toHaveBeenCalledWith(
      workflow,
      'image_z_image_turbo',
      expect.any(Function)
    )
  })

  it('injects a lookup that rejects prototype keys and maps registry defs', () => {
    // The lookup indexes `nodeDefsByName` by an attacker-craftable node type, so
    // it must reject prototype members and only report real registry defs.
    nodeDefsByName.SaveVideo = {
      output_node: true,
      outputs: [{ type: 'VIDEO' }]
    }
    nodeDefsByName.SaveImage = {
      output_node: true,
      outputs: [{ type: 'IMAGE' }]
    }

    resolveTourRoles(workflow)
    const lookup = capturedLookup()

    expect(lookup('toString')).toBeNull()
    expect(lookup('constructor')).toBeNull()
    expect(lookup('unregistered')).toBeNull()
    expect(lookup('SaveVideo')).toEqual({
      isOutputNode: true,
      producesVideo: true
    })
    expect(lookup('SaveImage')).toEqual({
      isOutputNode: true,
      producesVideo: false
    })
  })
})
