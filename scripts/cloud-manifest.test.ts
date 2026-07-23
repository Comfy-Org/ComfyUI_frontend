import { describe, expect, it } from 'vitest'

import { assertCloudEntry } from '../browser_tests/fixtures/customNode/manifest'
import syntheticSnapshot from './__fixtures__/cloudObjectInfoSyntheticSnapshot.json'
import supportedNodesExtract from './__fixtures__/cloudSupportedNodesExtract.json'
import {
  buildCloudManifest,
  renderCloudManifest,
  validateObjectInfoSnapshot,
  validateSupportedNodesDoc
} from './cloud-manifest'

// cloudSupportedNodesExtract.json holds five REAL entries copied from the
// vendored supported_nodes.yaml (core, a URL@sha pack, two registry packs
// with labels, one without); cloudObjectInfoSyntheticSnapshot.json is a
// synthetic /object_info capture shaped like the real endpoint.
function fixtureDoc() {
  return validateSupportedNodesDoc(structuredClone(supportedNodesExtract))
}

function fixtureSnapshot() {
  return validateObjectInfoSnapshot(structuredClone(syntheticSnapshot))
}

const KJ_DEPLOY_REF =
  'https://github.com/kijai/ComfyUI-KJNodes@377ed49f540da1c5e419cd2fc494ccc79543d3c4'

describe('buildCloudManifest', () => {
  const manifest = buildCloudManifest(fixtureDoc(), fixtureSnapshot())

  it('emits one row per joined yaml pack, sorted by snapshot dirname', () => {
    expect(manifest.packs.map((row) => row.pack)).toEqual([
      'ComfyUI-KJNodes',
      'ComfyUI-VideoHelperSuite',
      'ComfyUI-WanVideoWrapper',
      'ComfyUI_essentials'
    ])
  })

  it('excludes the core entry from pack rows and routes its nodes to coreDisabledNodes', () => {
    expect(manifest.packs.some((row) => row.pack === 'core')).toBe(false)
    expect(Object.keys(manifest.coreDisabledNodes)).toHaveLength(14)
    expect(manifest.coreDisabledNodes['ModelSaveKJ']).toEqual([
      'CreatesLargeOutputs'
    ])
    expect(manifest.coreDisabledNodes['VAESave']).toEqual(['WritesToDisk'])
  })

  it('ignores snapshot packs absent from the yaml (devtools on the test instance)', () => {
    expect(manifest.packs.some((row) => row.pack === 'ComfyUI_devtools')).toBe(
      false
    )
  })

  it('derives deployRef from either pin style', () => {
    const refs = Object.fromEntries(
      manifest.packs.map((row) => [row.pack, row.deployRef])
    )
    expect(refs['ComfyUI-KJNodes']).toBe(KJ_DEPLOY_REF)
    expect(refs['ComfyUI-VideoHelperSuite']).toBe(
      'comfyui-videohelpersuite@1.7.9'
    )
    expect(refs['ComfyUI-WanVideoWrapper']).toBe(
      'ComfyUI-WanVideoWrapper@1.4.7'
    )
    expect(refs['ComfyUI_essentials']).toBe('comfyui_essentials@1.1.0')
  })

  it('counts expected nodes as snapshot nodes minus label-disabled nodes', () => {
    const counts = Object.fromEntries(
      manifest.packs.map((row) => [row.pack, row.expectedNodeCount])
    )
    // KJNodes: 4 snapshot nodes, CameraPoseVisualizer labeled and present.
    expect(counts['ComfyUI-KJNodes']).toBe(3)
    // VHS: only enabled nodes present (its labeled nodes vanished).
    expect(counts['ComfyUI-VideoHelperSuite']).toBe(2)
    // WanVideo: 5 snapshot nodes, two labeled and present.
    expect(counts['ComfyUI-WanVideoWrapper']).toBe(3)
    // essentials: no labels at all.
    expect(counts['ComfyUI_essentials']).toBe(3)
  })

  it('picks sentinels from the enabled set only, in sorted order', () => {
    const sentinels = Object.fromEntries(
      manifest.packs.map((row) => [row.pack, row.expectedNodes])
    )
    expect(sentinels['ComfyUI-KJNodes']).toEqual([
      'FloatConstant',
      'INTConstant'
    ])
    expect(sentinels['ComfyUI-VideoHelperSuite']).toEqual([
      'VHS_LoadVideo',
      'VHS_VideoInfo'
    ])
    expect(sentinels['ComfyUI-WanVideoWrapper']).toEqual([
      'WanVideoDecode',
      'WanVideoSampler'
    ])
    expect(sentinels['ComfyUI_essentials']).toEqual([
      'DisplayAny',
      'ImageResize+'
    ])
  })

  it('carries every disabled node with its labels, sorted', () => {
    const disabled = Object.fromEntries(
      manifest.packs.map((row) => [row.pack, row.disabledNodes])
    )
    expect(disabled['ComfyUI-VideoHelperSuite']?.['VHS_LoadVideoPath']).toEqual(
      ['ReadsArbitraryFile']
    )
    expect(disabled['ComfyUI-VideoHelperSuite']?.['VHS_BatchManager']).toEqual([
      'DisabledOnCloud'
    ])
    expect(
      Object.keys(disabled['ComfyUI-VideoHelperSuite'] ?? {})
    ).toHaveLength(8)
    expect(
      disabled['ComfyUI-WanVideoWrapper']?.['DownloadAndLoadNLFModel']
    ).toEqual(['DisabledOnCloud', 'NetworkAccess'])
    expect(disabled['ComfyUI-KJNodes']?.['EndRecordCUDAMemoryHistory']).toEqual(
      ['Stateful', 'WritesToDisk']
    )
    expect(disabled['ComfyUI_essentials']).toEqual({})
  })

  it('emits rows the cloud loader validation accepts', () => {
    manifest.packs.forEach((row, index) =>
      expect(() => assertCloudEntry(row, index)).not.toThrow()
    )
  })

  it('fails loudly when a yaml pack has no snapshot pack to join', () => {
    const doc = fixtureDoc()
    doc.node_packs.push({ name: 'comfyui-not-deployed', version: '1.0.0' })
    expect(() => buildCloudManifest(doc, fixtureSnapshot())).toThrow(
      /comfyui-not-deployed/
    )
  })

  it('fails loudly when every snapshot node of a pack is disabled', () => {
    const snapshot = fixtureSnapshot()
    snapshot['VHS_Stub'] = { ...snapshot['VHS_LoadVideo'] }
    for (const key of ['VHS_LoadVideo', 'VHS_VideoInfo']) delete snapshot[key]
    const doc = fixtureDoc()
    const vhs = doc.node_packs.find(
      (pack) => pack.name === 'comfyui-videohelpersuite'
    )
    vhs!.node_labels = { ...vhs!.node_labels, VHS_Stub: ['DisabledOnCloud'] }
    expect(() => buildCloudManifest(doc, snapshot)).toThrow(
      /every snapshot node is label-disabled/
    )
  })
})

describe('renderCloudManifest determinism', () => {
  it('renders byte-identical output for identical inputs', () => {
    const first = renderCloudManifest(
      buildCloudManifest(fixtureDoc(), fixtureSnapshot())
    )
    const second = renderCloudManifest(
      buildCloudManifest(fixtureDoc(), fixtureSnapshot())
    )
    expect(second).toBe(first)
    expect(first.endsWith('\n')).toBe(true)
    expect(first.endsWith('\n\n')).toBe(false)
  })

  it('is insensitive to input key order', () => {
    const reversed = validateObjectInfoSnapshot(
      Object.fromEntries(
        Object.entries(structuredClone(syntheticSnapshot)).reverse()
      )
    )
    expect(
      renderCloudManifest(buildCloudManifest(fixtureDoc(), reversed))
    ).toBe(
      renderCloudManifest(buildCloudManifest(fixtureDoc(), fixtureSnapshot()))
    )
  })
})

describe('validateSupportedNodesDoc', () => {
  it('accepts the real vendored entries', () => {
    expect(() => fixtureDoc()).not.toThrow()
  })

  it('rejects labels missing from the declared list', () => {
    const doc = fixtureDoc()
    const kj = doc.node_packs.find((pack) => pack.name === KJ_DEPLOY_REF)
    kj!.node_labels!['CameraPoseVisualizer'] = ['MadeUpLabel']
    expect(() => validateSupportedNodesDoc(doc)).toThrow(/undeclared label/)
  })

  it('rejects registry packs without a version', () => {
    const doc = fixtureDoc()
    const essentials = doc.node_packs.find(
      (pack) => pack.name === 'comfyui_essentials'
    )
    delete essentials!.version
    expect(() => validateSupportedNodesDoc(doc)).toThrow(/no version/)
  })

  it('rejects URL packs without a 40-hex pin suffix', () => {
    const doc = fixtureDoc()
    const kj = doc.node_packs.find((pack) => pack.name === KJ_DEPLOY_REF)
    kj!.name = 'https://github.com/kijai/ComfyUI-KJNodes'
    expect(() => validateSupportedNodesDoc(doc)).toThrow(/no @<40-hex-sha>/)
  })

  it('rejects a document with two core entries', () => {
    const doc = fixtureDoc()
    doc.node_packs.push({ name: 'core' })
    expect(() => validateSupportedNodesDoc(doc)).toThrow(/more than one core/)
  })
})

describe('validateObjectInfoSnapshot', () => {
  it('rejects non-object snapshots and malformed defs', () => {
    expect(() => validateObjectInfoSnapshot([])).toThrow(/object_info/)
    expect(() => validateObjectInfoSnapshot({ Node: 'nope' })).toThrow(/Node/)
    expect(() =>
      validateObjectInfoSnapshot({ Node: { python_module: 42 } })
    ).toThrow(/python_module/)
  })
})
