import { linksMap, nodesMap } from '@comfyorg/comfy-multi-player'
import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import type { TargetFrame } from '@/core/graph/document/detachedTargetSession'
import type {
  GraphMutations,
  SemanticLinkPayload
} from '@/core/graph/graphMutations'

import { createTargetFrameApplyPort } from './targetFrameProjection'

type GraphMutationBatch = Parameters<Parameters<GraphMutations['batch']>[1]>[0]

const frame: TargetFrame = {
  workflowId: 'wf',
  seq: 1,
  update: new Uint8Array()
}

function recordingMutations(): {
  mutations: GraphMutations
  links: SemanticLinkPayload[]
} {
  const links: SemanticLinkPayload[] = []
  const batch = {
    clearSemanticGraph: () => {},
    reconcileNode: () => {},
    connect: (link: SemanticLinkPayload) => {
      links.push(link)
    }
  } as unknown as GraphMutationBatch
  const mutations = {
    batch: (_context: unknown, define: (batch: GraphMutationBatch) => void) => {
      define(batch)
      return true
    }
  } as unknown as GraphMutations
  return { mutations, links }
}

function setNode(doc: Y.Doc, id: string, fields: Record<string, unknown>) {
  const node = nodesMap(doc).get(id) ?? new Y.Map<unknown>()
  if (!nodesMap(doc).has(id)) nodesMap(doc).set(id, node)
  for (const [key, value] of Object.entries(fields)) node.set(key, value)
  return node
}

describe('createTargetFrameApplyPort', () => {
  it('drops a slot array holding non-record entries instead of forwarding it', () => {
    const doc = new Y.Doc()
    const source = setNode(doc, '1', { type: 'Source' })
    const outputs = new Y.Array<unknown>()
    outputs.push(['not-a-slot'])
    source.set('outputs', outputs)
    setNode(doc, '2', { type: 'Sink' })
    linksMap(doc).set('9', [9, '1', 0, '2', 0, 'IMAGE'])

    const { mutations, links } = recordingMutations()
    createTargetFrameApplyPort(mutations).apply(frame, doc)

    expect(links[0]?.originOutputs).toEqual([])
    doc.destroy()
  })
})
