import { describe, expect, it } from 'vitest'

import type { PackedPackage, PublishedManifest } from './publishableTarball'
import {
  findPublishableViolations,
  formatViolations
} from './publishableTarball'

const PUBLISHABLE: PackedPackage = {
  files: [
    'package.json',
    'LICENSE',
    'README.md',
    'dist/index.js',
    'dist/index.d.ts'
  ],
  manifest: {
    name: '@comfyorg/example',
    version: '1.0.0',
    exports: {
      '.': { types: './dist/index.d.ts', import: './dist/index.js' },
      './package.json': './package.json'
    },
    dependencies: { zod: '^4.0.0' },
    peerDependencies: { firebase: '^11.6.0' }
  }
}

function packedWith({
  files = [],
  manifest = {}
}: {
  files?: string[]
  manifest?: Partial<PublishedManifest>
} = {}): PackedPackage {
  return {
    files: [...PUBLISHABLE.files, ...files],
    manifest: { ...PUBLISHABLE.manifest, ...manifest }
  }
}

function titles(packed: PackedPackage): string[] {
  return findPublishableViolations(packed).map(({ title }) => title)
}

function detailsFor(packed: PackedPackage, title: string): string[] {
  return findPublishableViolations(packed)
    .filter((violation) => violation.title === title)
    .flatMap(({ details }) => details)
}

describe('findPublishableViolations', () => {
  it.for([
    ['a dist-only tarball', PUBLISHABLE],
    [
      'a pattern export with a matching packed file',
      packedWith({
        files: ['dist/vue/Button.js'],
        manifest: { exports: { './vue/*': './dist/vue/*' } }
      })
    ],
    [
      'an export nested under runtime conditions',
      packedWith({
        manifest: {
          exports: {
            '.': {
              node: { types: './dist/index.d.ts', import: './dist/index.js' },
              default: './dist/index.js'
            }
          }
        }
      })
    ],
    [
      'an export subpath explicitly blocked with null',
      packedWith({ manifest: { exports: { './internal': null } } })
    ],
    [
      'a manifest with no dependency groups at all',
      packedWith({
        manifest: { dependencies: undefined, peerDependencies: undefined }
      })
    ]
  ] as const)('accepts %s', ([, packed]) => {
    expect(findPublishableViolations(packed)).toEqual([])
  })

  it.for([
    [
      'a stray config file at the tarball root',
      packedWith({ files: ['tsconfig.json'] }),
      'Unexpected files in tarball',
      'tsconfig.json'
    ],
    [
      'a directory outside dist',
      packedWith({ files: ['scripts/smokePack.ts'] }),
      'Unexpected files in tarball',
      'scripts/smokePack.ts'
    ],
    [
      'a README under an unexpected name',
      packedWith({ files: ['README'] }),
      'Unexpected files in tarball',
      'README'
    ],
    [
      'a compiled test that survived the build',
      packedWith({ files: ['dist/session.test.js'] }),
      'Source files in tarball',
      'dist/session.test.js'
    ],
    [
      'the declaration emitted beside a compiled test',
      packedWith({ files: ['dist/session.test.d.ts'] }),
      'Source files in tarball',
      'dist/session.test.d.ts'
    ],
    [
      'a test authored as ESM that survived the build',
      packedWith({ files: ['dist/session.test.mjs'] }),
      'Source files in tarball',
      'dist/session.test.mjs'
    ],
    [
      'a test source that survived the build',
      packedWith({ files: ['dist/session.test.ts'] }),
      'Source files in tarball',
      'dist/session.test.ts'
    ],
    [
      'a fixture directory under dist',
      packedWith({ files: ['dist/core/__fixtures__/user.js'] }),
      'Source files in tarball',
      'dist/core/__fixtures__/user.js'
    ],
    [
      'an export target that ships but sits outside dist',
      packedWith({ manifest: { exports: { '.': './README.md' } } }),
      'Exports escape dist',
      './README.md'
    ],
    [
      'an export target nested under a condition and pointing at src',
      packedWith({
        manifest: {
          exports: {
            '.': { types: './src/index.d.ts', import: './dist/index.js' }
          }
        }
      }),
      'Exports escape dist',
      './src/index.d.ts'
    ],
    [
      'an export target the tarball does not contain',
      packedWith({ manifest: { exports: { '.': './dist/missing.js' } } }),
      'Exports missing from tarball',
      './dist/missing.js'
    ],
    [
      'a pattern export no packed file matches',
      packedWith({ manifest: { exports: { './vue/*': './dist/vue/*' } } }),
      'Exports missing from tarball',
      './dist/vue/*'
    ],
    [
      'a catalog: range in dependencies',
      packedWith({ manifest: { dependencies: { zod: 'catalog:' } } }),
      'Unresolved workspace specifiers',
      'dependencies.zod: catalog:'
    ],
    [
      'a workspace: range in peerDependencies',
      packedWith({
        manifest: { peerDependencies: { '@comfyorg/x': 'workspace:^' } }
      }),
      'Unresolved workspace specifiers',
      'peerDependencies.@comfyorg/x: workspace:^'
    ],
    [
      'a catalog: range in optionalDependencies',
      packedWith({ manifest: { optionalDependencies: { sharp: 'catalog:' } } }),
      'Unresolved workspace specifiers',
      'optionalDependencies.sharp: catalog:'
    ],
    [
      'a catalog: range shadowed by a resolved peer of the same name',
      packedWith({
        manifest: {
          dependencies: { zod: 'catalog:' },
          peerDependencies: { zod: '^4.0.0' }
        }
      }),
      'Unresolved workspace specifiers',
      'dependencies.zod: catalog:'
    ]
  ] as const)('rejects %s', ([, packed, title, detail]) => {
    expect(titles(packed)).toContain(title)
    expect(detailsFor(packed, title)).toContain(detail)
  })

  it.for([
    ['a number', 1],
    ['a boolean', false]
  ] as const)('rejects an export leaf that is %s', ([, leaf]) => {
    expect(() =>
      findPublishableViolations(
        packedWith({ manifest: { exports: { '.': leaf } } })
      )
    ).toThrow(String(leaf))
  })

  it('reports a source file under src as both stray and non-public', () => {
    expect(titles(packedWith({ files: ['src/index.ts'] }))).toEqual([
      'Unexpected files in tarball',
      'Source files in tarball'
    ])
  })

  it('reports each offending export target once', () => {
    const packed = packedWith({
      manifest: {
        exports: {
          '.': { types: './dist/missing.js', import: './dist/missing.js' },
          './alias': './dist/missing.js'
        }
      }
    })
    expect(detailsFor(packed, 'Exports missing from tarball')).toEqual([
      './dist/missing.js'
    ])
  })
})

describe('formatViolations', () => {
  const violations = findPublishableViolations(
    packedWith({ files: ['tsconfig.json'] })
  )

  it('lists the message above its offending entries', () => {
    expect(formatViolations(violations)).toBe(
      'Packed tarball contains files outside dist:\ntsconfig.json'
    )
  })

  it('prefixes a GitHub Actions error annotation when asked', () => {
    expect(formatViolations(violations, { annotate: true })).toBe(
      '::error title=Unexpected files in tarball::Packed tarball contains files outside dist:\ntsconfig.json'
    )
  })
})
