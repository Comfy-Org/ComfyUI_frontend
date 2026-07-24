import { existsSync, readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

import { assertCloudEntry } from '../browser_tests/fixtures/customNode/manifest'
import syntheticSnapshot from './__fixtures__/cloudObjectInfoSyntheticSnapshot.json'
import supportedNodesExtract from './__fixtures__/cloudSupportedNodesExtract.json'
import type { CuratedCloudOverlay } from './cloud-manifest'
import {
  buildCloudManifest,
  renderCloudManifest,
  validateCuratedCloudOverlay,
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

function fixtureOverlay(): CuratedCloudOverlay {
  return {
    'ComfyUI-VideoHelperSuite': {
      workflow: 'assets/customNodes/vhs_video_pipeline_cloud_run.json',
      tiers: ['load', 'connectivity', 'run']
    }
  }
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

  it('fails loudly when the yaml contains no joinable non-core packs', () => {
    const doc = fixtureDoc()
    doc.node_packs = doc.node_packs.filter((pack) => pack.name === 'core')
    expect(() => buildCloudManifest(doc, fixtureSnapshot())).toThrow(
      /no pack rows/
    )
  })

  it('joins a .git-suffixed URL pack to its snapshot dirname', () => {
    const doc = fixtureDoc()
    const kj = doc.node_packs.find((pack) => pack.name === KJ_DEPLOY_REF)
    kj!.name = KJ_DEPLOY_REF.replace('@', '.git@')
    const manifest = buildCloudManifest(doc, fixtureSnapshot())
    expect(manifest.packs.some((row) => row.pack === 'ComfyUI-KJNodes')).toBe(
      true
    )
  })

  it('fails loudly when two yaml packs collide on one join key', () => {
    const doc = fixtureDoc()
    doc.node_packs.push({ name: 'ComfyUI-KJNODES', version: '9.9.9' })
    expect(() => buildCloudManifest(doc, fixtureSnapshot())).toThrow(
      /collide on join key/
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

describe('curated overlay', () => {
  it('attaches workflow and tiers to the keyed row and leaves every other row generated', () => {
    const manifest = buildCloudManifest(
      fixtureDoc(),
      fixtureSnapshot(),
      fixtureOverlay()
    )
    const vhs = manifest.packs.find(
      (row) => row.pack === 'ComfyUI-VideoHelperSuite'
    )
    expect(vhs?.tiers).toEqual(['load', 'connectivity', 'run'])
    expect(vhs?.workflow).toBe(
      'assets/customNodes/vhs_video_pipeline_cloud_run.json'
    )
    expect(vhs?.timeoutMs).toBe(30_000)
    for (const row of manifest.packs.filter((row) => row !== vhs)) {
      expect(row.tiers).toEqual(['load', 'connectivity'])
      expect(row.workflow).toBe('')
    }
  })

  it('applies an overlay timeoutMs override', () => {
    const overlay = fixtureOverlay()
    overlay['ComfyUI-VideoHelperSuite'].timeoutMs = 90_000
    const manifest = buildCloudManifest(
      fixtureDoc(),
      fixtureSnapshot(),
      overlay
    )
    expect(
      manifest.packs.find((row) => row.pack === 'ComfyUI-VideoHelperSuite')
        ?.timeoutMs
    ).toBe(90_000)
  })

  it('emits merged rows the cloud loader validation accepts', () => {
    const manifest = buildCloudManifest(
      fixtureDoc(),
      fixtureSnapshot(),
      fixtureOverlay()
    )
    manifest.packs.forEach((row, index) =>
      expect(() => assertCloudEntry(row, index)).not.toThrow()
    )
  })

  it('fails loudly on an overlay key with no generated row, listing known packs', () => {
    const overlay = fixtureOverlay()
    overlay['comfyui-videohelpersuite'] = overlay['ComfyUI-VideoHelperSuite']
    delete overlay['ComfyUI-VideoHelperSuite']
    expect(() =>
      buildCloudManifest(fixtureDoc(), fixtureSnapshot(), overlay)
    ).toThrow(/comfyui-videohelpersuite.*ComfyUI-VideoHelperSuite/s)
  })

  it('validateCuratedCloudOverlay rejects malformed shapes and accepts valid ones', () => {
    const valid = fixtureOverlay()
    expect(validateCuratedCloudOverlay(structuredClone(valid))).toEqual(valid)
    const withTimeout = fixtureOverlay()
    withTimeout['ComfyUI-VideoHelperSuite'].timeoutMs = 90_000
    expect(validateCuratedCloudOverlay(structuredClone(withTimeout))).toEqual(
      withTimeout
    )
    expect(() => validateCuratedCloudOverlay(null)).toThrow(/curated overlay/)
    expect(() => validateCuratedCloudOverlay([])).toThrow(/curated overlay/)
    expect(() => validateCuratedCloudOverlay({ Pack: 'nope' })).toThrow(
      /must be an object/
    )
    expect(() =>
      validateCuratedCloudOverlay({
        Pack: { workflow: 'a.json', tiers: ['run'], timeout: 5 }
      })
    ).toThrow(/unknown key.*timeout/)
    expect(() =>
      validateCuratedCloudOverlay({ Pack: { workflow: '', tiers: ['run'] } })
    ).toThrow(/workflow/)
    expect(() =>
      validateCuratedCloudOverlay({ Pack: { workflow: 'a.json', tiers: [] } })
    ).toThrow(/tiers/)
    expect(() =>
      validateCuratedCloudOverlay({
        Pack: { workflow: 'a.json', tiers: ['load', 'connectivity'] }
      })
    ).toThrow(/must include 'run'/)
    expect(() =>
      validateCuratedCloudOverlay({
        Pack: { workflow: 'a.json', tiers: 'run' }
      })
    ).toThrow(/tiers/)
    for (const bad of [0, -1, Number.NaN, 'soon'])
      expect(() =>
        validateCuratedCloudOverlay({
          Pack: { workflow: 'a.json', tiers: ['run'], timeoutMs: bad }
        })
      ).toThrow(/timeoutMs/)
  })

  it('the vendored overlay validates and every workflow it references exists', () => {
    const vendored = validateCuratedCloudOverlay(
      JSON.parse(
        readFileSync(
          'browser_tests/fixtures/data/cloud/curatedCloudWorkflows.json',
          'utf-8'
        )
      )
    )
    expect(Object.keys(vendored).length).toBeGreaterThan(0)
    for (const [pack, entry] of Object.entries(vendored)) {
      expect(
        existsSync(`browser_tests/${entry.workflow}`),
        `${pack}: overlay workflow ${entry.workflow} is not on disk`
      ).toBe(true)
      expect(
        entry.tiers,
        `${pack}: overlay must enroll the run tier`
      ).toContain('run')
    }
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

  it('holds with the curated overlay applied', () => {
    const first = renderCloudManifest(
      buildCloudManifest(fixtureDoc(), fixtureSnapshot(), fixtureOverlay())
    )
    const second = renderCloudManifest(
      buildCloudManifest(fixtureDoc(), fixtureSnapshot(), fixtureOverlay())
    )
    expect(second).toBe(first)
    expect(first).not.toBe(
      renderCloudManifest(buildCloudManifest(fixtureDoc(), fixtureSnapshot()))
    )
  })
})

describe('validateSupportedNodesDoc', () => {
  it('accepts the real vendored entries', () => {
    expect(() => fixtureDoc()).not.toThrow()
  })

  it('parses and validates the full vendored yaml end to end', () => {
    // Resolved from the repo root (vitest's cwd): under happy-dom
    // import.meta.url is not a file: URL, so URL-relative resolution crashes.
    const vendored = readFileSync(
      'browser_tests/fixtures/data/cloud/supported_nodes.yaml',
      'utf-8'
    )
    const doc = validateSupportedNodesDoc(parse(vendored))
    expect(doc.node_packs.length).toBeGreaterThan(80)
    expect(doc.node_packs.some((pack) => pack.name === 'core')).toBe(true)
  })

  it('rejects a node carrying a duplicate label', () => {
    const doc = fixtureDoc()
    const kj = doc.node_packs.find((pack) => pack.name === KJ_DEPLOY_REF)
    kj!.node_labels!['CameraPoseVisualizer'] = [
      'DisabledOnCloud',
      'DisabledOnCloud'
    ]
    expect(() => validateSupportedNodesDoc(doc)).toThrow(/duplicate label/)
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
