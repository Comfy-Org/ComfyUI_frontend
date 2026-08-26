import { describe, expect, it } from 'vitest'

import viteConfig from '../vite.config.mts'

type ChunkGroup = {
  name: string
  test: RegExp
}

const output = viteConfig.build?.rolldownOptions?.output
if (!output || Array.isArray(output)) {
  throw new Error('Expected one Rolldown output configuration')
}
const chunkGroups = (output as { codeSplitting?: { groups?: ChunkGroup[] } })
  .codeSplitting?.groups

function getChunkGroup(name: string): ChunkGroup {
  const group = chunkGroups?.find((candidate) => candidate.name === name)
  if (!group) throw new Error(`Missing chunk group: ${name}`)
  return group
}

describe('startup chunk boundary', () => {
  it.for([
    ['vendor-three', '/node_modules/three/src/Three.js'],
    ['vendor-three', '/node_modules/@sparkjsdev/spark/dist/index.js'],
    [
      'vendor-three',
      '/node_modules/@comfyorg/fbx-exporter-three/dist/index.js'
    ],
    ['vendor-three', '/node_modules/wwobjloader2/dist/index.js'],
    ['vendor-tiptap', '/node_modules/@tiptap/core/dist/index.js'],
    ['vendor-tiptap', '/node_modules/tiptap-markdown/dist/index.js']
  ])('$0 owns every package in its optional capability', ([groupName, id]) => {
    expect(getChunkGroup(groupName).test.test(id)).toBe(true)
  })
})
