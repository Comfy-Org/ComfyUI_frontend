import { describe, expect, it } from 'vitest'

import {
  buildCloudManifest,
  sourceFromSupportedNodesHeader,
  validateCuratedCloudOverlay,
  validateSupportedNodesDoc
} from './cloud-manifest'

const sourceHeader = `# Source: https://github.com/Comfy-Org/cloud/blob/${'a'.repeat(40)}/comfy-complete/supported_nodes.yaml
# Imported: 2026-08-14
`

describe('cloud manifest provenance', () => {
  it('binds the generated manifest to the vendored yaml revision', () => {
    const source = sourceFromSupportedNodesHeader(sourceHeader)
    const manifest = buildCloudManifest(
      {
        labels: [],
        node_packs: [
          { name: 'example-pack', version: '1.2.3', web_directory: 'web' }
        ]
      },
      {
        ExampleNode: { python_module: 'custom_nodes.example-pack' }
      },
      source
    )

    expect(manifest.source).toEqual(source)
    expect(manifest.packs).toHaveLength(1)
    expect(manifest.packs[0].deployRef).toBe('example-pack@1.2.3')
    expect(manifest.packs[0].webDirectory).toBe('web')
  })

  it('rejects a snapshot without an immutable source header', () => {
    expect(() =>
      sourceFromSupportedNodesHeader('# Imported: 2026-08-14')
    ).toThrow(/Source/)
    expect(() =>
      sourceFromSupportedNodesHeader(
        `# Source: https://github.com/Comfy-Org/cloud/blob/${'a'.repeat(40)}/supported_nodes.yaml\n# Imported: 2026-02-31`
      )
    ).toThrow(/real ISO date/)
  })

  it('rejects a web directory that can escape the pack root', () => {
    expect(() =>
      validateSupportedNodesDoc({
        labels: [],
        node_packs: [
          {
            name: 'example-pack',
            version: '1.2.3',
            web_directory: '../web'
          }
        ]
      })
    ).toThrow(/safe relative path/)
  })
})

describe('cloud run overlay', () => {
  it('requires a calibrated runnable corpus for every run-tier row', () => {
    expect(() =>
      validateCuratedCloudOverlay({
        pack: {
          workflow: 'assets/customNodes/example.json',
          tiers: ['load', 'run']
        }
      })
    ).toThrow(/expectedRunnableCount/)
  })

  it.each([
    '/tmp/workflow.json',
    'C:\\tmp\\workflow.json',
    '../workflow.json',
    'assets/../../workflow.json',
    'assets\\..\\workflow.json'
  ])('rejects workflow paths outside browser_tests: %s', (workflow) => {
    expect(() =>
      validateCuratedCloudOverlay({
        pack: {
          workflow,
          tiers: ['load', 'run'],
          expectedRunnableCount: 1
        }
      })
    ).toThrow(/inside browser_tests/)
  })
})
