import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import {
  applySuppressions,
  checkCatalogPinnedBySha,
  checkFile,
  checkFollowerFiles,
  checkNoHardcodedEndpoint,
  checkNoOpIdRegeneration,
  checkNoOutboundUpdateB64,
  checkNoScatteredDistributionChecks,
  checkOpLayerManifest,
  checkOpLayerPurity,
  checkOpLayerRuntimeImports,
  findFollowerFiles
} from './check-follower-invariants'

const FOLLOWER_FILE = 'src/workbench/extensions/agent/crdt/follower.ts'

function withPackageRoot(
  files: readonly { name: string; source: string }[],
  assert: (root: string) => void
): void {
  const root = mkdtempSync(join(tmpdir(), 'follower-invariants-'))
  try {
    const packageRoot = join(root, 'node_modules/@comfyorg/comfy-multi-player')
    mkdirSync(packageRoot, { recursive: true })
    for (const file of files) {
      const target = join(packageRoot, file.name)
      mkdirSync(join(target, '..'), { recursive: true })
      writeFileSync(target, file.source)
    }
    assert(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

describe('checkNoOutboundUpdateB64', () => {
  test('fails a forbidden mutation fixture: constructing an outbound update_b64 frame', () => {
    const fixture = `
      function sendUpdate(encoded: string) {
        socket.send(JSON.stringify({ type: 'doc_update', update_b64: encoded }))
      }
    `
    const violations = checkNoOutboundUpdateB64(FOLLOWER_FILE, fixture)
    expect(violations).toHaveLength(1)
    expect(violations[0].rule).toBe('no-outbound-update-b64')
  })

  test('passes the allowed follower projection: decoding an inbound update_b64', () => {
    const fixture = `
      if (typeof data.update_b64 === 'string') {
        const update = decodeBase64(data.update_b64)
        followerDoc.applyRemoteUpdate(update)
      }
    `
    expect(checkNoOutboundUpdateB64(FOLLOWER_FILE, fixture)).toEqual([])
  })

  test('passes a type/interface member declaration named update_b64', () => {
    const fixture = `
      interface DocUpdateFrame {
        update_b64?: unknown
      }
    `
    expect(checkNoOutboundUpdateB64(FOLLOWER_FILE, fixture)).toEqual([])
  })

  test.for([
    '{ update_b64: data.update_b64 }',
    '{ update_b64: stringValue }',
    '{ update_b64: stringify(update) }',
    '{ update_b64 }',
    "{ ['update_b64']: encoded }",
    'Object.assign(frame, { update_b64: encoded })',
    'frame.update_b64 = encoded',
    "frame['update_b64'] = encoded"
  ])('fails outbound expression %s', (expression) => {
    expect(
      checkNoOutboundUpdateB64(
        FOLLOWER_FILE,
        `socket.send(JSON.stringify(${expression}))`
      )
    ).toHaveLength(1)
  })

  test('passes an inbound destructuring assignment', () => {
    expect(
      checkNoOutboundUpdateB64(
        FOLLOWER_FILE,
        'let update_b64; ({ update_b64 } = data)'
      )
    ).toEqual([])
  })
})

describe('checkNoOpIdRegeneration', () => {
  test('fails a forbidden mutation fixture: re-minting op_id on retry outside opEnvelope.ts', () => {
    const fixture = `
      function retrySend(op: Op) {
        return { ...op, op_id: createUuidv4() }
      }
    `
    const violations = checkNoOpIdRegeneration(
      'src/workbench/extensions/agent/crdt/opSender.ts',
      fixture
    )
    expect(violations).toHaveLength(1)
    expect(violations[0].rule).toBe('no-op-id-regeneration')
  })

  test('passes the allowed follower projection: minting once in opEnvelope.ts', () => {
    const fixture = `
      function withEnvelope(operation, context) {
        return { ...operation, op_id: mintOpId(), actor: context.actor }
      }
    `
    expect(
      checkNoOpIdRegeneration(
        'src/workbench/extensions/agent/crdt/opEnvelope.ts',
        fixture
      )
    ).toEqual([])
  })

  test('passes a resend that reuses the same minted ops without reassigning op_id', () => {
    const fixture = `
      function resend(ops: Op[]) {
        return ops.map((op) => ({ ...op }))
      }
    `
    expect(checkNoOpIdRegeneration(FOLLOWER_FILE, fixture)).toEqual([])
  })

  test('fails a multiline op_id assignment', () => {
    const fixture = `
      const retried = {
        ...op,
        op_id:
          crypto.randomUUID()
      }
    `
    expect(checkNoOpIdRegeneration(FOLLOWER_FILE, fixture)).toHaveLength(1)
  })

  test('fails an op_id field assignment', () => {
    const fixture = `operation.op_id = mintOpId()`
    expect(checkNoOpIdRegeneration(FOLLOWER_FILE, fixture)).toHaveLength(1)
  })

  test.for([
    {
      name: 'transformed UUID expression',
      fixture: "const retry = { op_id: createUuidv4().replaceAll('-', '') }",
      expected: 1
    },
    {
      name: 'global crypto UUID expression',
      fixture: 'const retry = { op_id: globalThis.crypto.randomUUID() }',
      expected: 1
    },
    {
      name: 'string-wrapped UUID expression',
      fixture: 'const retry = { op_id: String(uuid()) }',
      expected: 1
    },
    {
      name: 'bracketed op_id assignment',
      fixture: "operation['op_id'] = mintOpId()",
      expected: 1
    },
    {
      name: 'indirect op_id property',
      fixture: 'const fresh = mintOpId(); const retry = { op_id: fresh }',
      expected: 1
    },
    {
      name: 'shorthand op_id property',
      fixture: 'const op_id = mintOpId(); const retry = { op_id }',
      expected: 1
    }
  ])('fails $name', ({ fixture, expected }) => {
    expect(checkNoOpIdRegeneration(FOLLOWER_FILE, fixture)).toHaveLength(
      expected
    )
  })

  test.for([
    {
      name: 'an arrow helper',
      fixture: [
        'const nextOpId = () => crypto.randomUUID()',
        'const env = { op_id: nextOpId() }'
      ].join('\n')
    },
    {
      name: 'a function declaration helper',
      fixture: [
        'function nextOpId() { return crypto.randomUUID() }',
        'const env = { op_id: nextOpId() }'
      ].join('\n')
    },
    {
      name: 'a chain of helpers',
      fixture: [
        'const mint = () => crypto.randomUUID()',
        'const nextOpId = () => mint()',
        'const env = { op_id: nextOpId() }'
      ].join('\n')
    },
    {
      name: 'a helper reached as a member',
      fixture: [
        'const minters = { nextOpId: () => createUuidv4() }',
        'const env = { op_id: minters.nextOpId() }'
      ].join('\n')
    },
    {
      name: 'a helper with an early return',
      fixture: [
        'function nextOpId(existing?: string) {',
        '  if (existing) return existing',
        '  return uuidv4()',
        '}',
        'const env = { op_id: nextOpId() }'
      ].join('\n')
    }
  ])('fails a mint extracted into $name', ({ fixture }) => {
    const violations = checkNoOpIdRegeneration(FOLLOWER_FILE, fixture)
    expect(violations).toHaveLength(1)
    expect(violations[0].rule).toBe('no-op-id-regeneration')
  })

  test.for([
    {
      name: 'defines a minter without minting an op_id with it',
      fixture: [
        'const nextOpId = () => crypto.randomUUID()',
        'export { nextOpId }'
      ].join('\n')
    },
    {
      name: 'passes an existing id through a helper',
      fixture: [
        'function keepOpId(op: Op) { return op.op_id }',
        'const env = { op_id: keepOpId(op) }'
      ].join('\n')
    },
    {
      name: 'reads the id off the envelope it is resending',
      fixture: 'const env = { ...op, op_id: op.op_id }'
    }
  ])('passes a file that $name', ({ fixture }) => {
    expect(checkNoOpIdRegeneration(FOLLOWER_FILE, fixture)).toEqual([])
  })

  test('ignores op_id examples in comments', () => {
    const fixture = `
      /* retry = { op_id: createUuidv4() } */
      const retried = { ...op }
    `
    expect(checkNoOpIdRegeneration(FOLLOWER_FILE, fixture)).toEqual([])
  })

  test.for([
    {
      name: 'a returned wrapper around a minted local',
      fixture: [
        'function next() { const id = crypto.randomUUID(); return String(id) }',
        'const op = { op_id: next() }'
      ].join('\n')
    },
    {
      name: 'a bound callable alias',
      fixture: [
        'const next = crypto.randomUUID.bind(crypto)',
        'const op = { op_id: next() }'
      ].join('\n')
    },
    {
      name: 'a plain callable alias',
      fixture: [
        'const next = crypto.randomUUID',
        'const op = { op_id: next() }'
      ].join('\n')
    }
  ])('fails a mint reached through $name', ({ fixture }) => {
    const violations = checkNoOpIdRegeneration(FOLLOWER_FILE, fixture)
    expect(violations).toHaveLength(1)
    expect(violations[0].rule).toBe('no-op-id-regeneration')
  })

  test.for([
    {
      name: 'a same-named local in another function that preserves the identity',
      fixture:
        'function debug() { const id = crypto.randomUUID(); return id }; function retry(op) { const id = op.op_id; return { op_id: id } }'
    },
    {
      name: 'a same-named local in a sibling block',
      fixture:
        '{ const id = mintOpId(); send(id) }\n{ const id = op.op_id; resend({ op_id: id }) }'
    },
    {
      name: 'a parameter shadowing a minted outer name',
      fixture:
        'const id = mintOpId()\nfunction resend(id: string) { return { op_id: id } }'
    },
    {
      name: 'a wrapper around an existing id',
      fixture: 'const op = { op_id: String(existing.op_id) }'
    }
  ])('passes $name', ({ fixture }) => {
    expect(checkNoOpIdRegeneration(FOLLOWER_FILE, fixture)).toEqual([])
  })

  test('keeps type names out of minted-value provenance', () => {
    const fixture = [
      'type id = string',
      'const id = mintOpId()',
      'const retry = { op_id: id }'
    ].join('\n')
    expect(checkNoOpIdRegeneration(FOLLOWER_FILE, fixture)).toHaveLength(1)
  })

  test('does not acquire minted-value provenance through a type reference', () => {
    const fixture = [
      'const id = mintOpId()',
      'type id = string',
      'const retry = { op_id: previous as id }'
    ].join('\n')
    expect(checkNoOpIdRegeneration(FOLLOWER_FILE, fixture)).toEqual([])
  })
})

describe('op-layer purity', () => {
  test('passes a manifest whose only runtime dependency is yjs', () => {
    expect(
      checkOpLayerManifest(
        'node_modules/@comfyorg/comfy-multi-player/package.json',
        JSON.stringify({ dependencies: { yjs: '^13.6.27' } })
      )
    ).toEqual([])
  })

  test.for([
    {
      name: 'production dependency',
      manifest: { dependencies: { yjs: '^13.6.27', vue: '^3.5.0' } },
      expected: 'vue'
    },
    {
      name: 'optional dependency',
      manifest: { optionalDependencies: { ws: '^8.0.0' } },
      expected: 'ws'
    },
    {
      name: 'peer dependency',
      manifest: { peerDependencies: { react: '^19.0.0' } },
      expected: 'react'
    }
  ])('fails an extra $name', ({ manifest, expected }) => {
    expect(
      checkOpLayerManifest('package.json', JSON.stringify(manifest))
    ).toEqual([
      expect.objectContaining({
        rule: 'op-layer-yjs-only',
        message: expect.stringContaining(expected)
      })
    ])
  })

  test('passes built runtime imports from yjs and internal modules', () => {
    const fixture = `
      import * as Y from 'yjs'
      export { applyOps } from './applier.js'
    `
    expect(checkOpLayerRuntimeImports('dist/index.js', fixture)).toEqual([])
  })

  test.for([
    {
      name: 'framework import',
      fixture: "import { ref } from 'vue'",
      expected: 'vue'
    },
    {
      name: 'server-only import',
      fixture: "import { createHash } from 'node:crypto'",
      expected: 'node:crypto'
    },
    {
      name: 'dynamic external import',
      fixture: "const runtime = import('@comfyorg/runtime')",
      expected: '@comfyorg/runtime'
    }
  ])('fails a built $name', ({ fixture, expected }) => {
    expect(checkOpLayerRuntimeImports('dist/index.js', fixture)).toEqual([
      expect.objectContaining({
        rule: 'op-layer-yjs-only',
        message: expect.stringContaining(expected)
      })
    ])
  })

  test.for([
    {
      name: 'a CommonJS require',
      fixture: "const crypto = require('node:crypto')",
      expected: 'node:crypto'
    },
    {
      name: 'an import of a resolvable local constant',
      fixture: "const name = 'node:crypto'; const crypto = await import(name)",
      expected: 'node:crypto'
    },
    {
      name: 'an import this classifier cannot resolve',
      fixture: 'const crypto = await import(pickModule())',
      expected: 'an unverifiable runtime load'
    },
    {
      name: 'a require this classifier cannot resolve',
      fixture: 'const crypto = require(names[index])',
      expected: 'an unverifiable runtime load'
    }
  ])('fails $name', ({ fixture, expected }) => {
    expect(checkOpLayerRuntimeImports('dist/index.js', fixture)).toEqual([
      expect.objectContaining({
        rule: 'op-layer-yjs-only',
        message: expect.stringContaining(expected)
      })
    ])
  })

  test.for([
    "const Y = require('yjs')",
    "const applier = require('./applier.js')",
    "const name = 'yjs'; const Y = await import(name)"
  ])('passes a permitted runtime load: %s', (fixture) => {
    expect(checkOpLayerRuntimeImports('dist/index.js', fixture)).toEqual([])
  })

  test.for([
    {
      name: 'an unrelated inner declaration with the same spelling',
      fixture:
        "const name = 'node:crypto'; function unrelated() { const name = 'yjs' }; await import(name)",
      expected: 'node:crypto'
    },
    {
      name: 'a parameter shadowing an allowed outer constant',
      fixture:
        "const name = 'yjs'; async function load(name) { return import(name) }",
      expected: 'an unverifiable runtime load'
    },
    {
      name: 'a mutable specifier initialized to an allowed package',
      fixture: "let name = 'yjs'; name = 'node:crypto'; await import(name)",
      expected: 'an unverifiable runtime load'
    }
  ])('fails $name', ({ fixture, expected }) => {
    expect(checkOpLayerRuntimeImports('dist/index.js', fixture)).toEqual([
      expect.objectContaining({
        rule: 'op-layer-yjs-only',
        message: expect.stringContaining(expected)
      })
    ])
  })

  test('fails a forbidden import in the manifest entry, not just under dist/**/*.js', () => {
    withPackageRoot(
      [
        {
          name: 'package.json',
          source: JSON.stringify({
            name: '@comfyorg/comfy-multi-player',
            version: '0.0.0',
            main: './runtime/entry.mjs',
            dependencies: { yjs: '*' }
          })
        },
        {
          name: 'runtime/entry.mjs',
          source: "import { createHash } from 'node:crypto'\n"
        },
        { name: 'dist/unrelated.js', source: "import * as Y from 'yjs'\n" }
      ],
      (root) => {
        expect(checkOpLayerPurity(root)).toEqual([
          expect.objectContaining({
            rule: 'op-layer-yjs-only',
            message: expect.stringContaining('node:crypto')
          })
        ])
      }
    )
  })

  test('fails closed on an entry whose extension it cannot inspect', () => {
    withPackageRoot(
      [
        {
          name: 'package.json',
          source: JSON.stringify({
            exports: { '.': './dist/runtime.wasm' },
            dependencies: { yjs: '*' }
          })
        },
        { name: 'dist/index.js', source: "import * as Y from 'yjs'\n" }
      ],
      (root) => {
        expect(checkOpLayerPurity(root)).toEqual([
          expect.objectContaining({
            rule: 'op-layer-yjs-only',
            message: expect.stringContaining('unsupported runtime layout')
          })
        ])
      }
    )
  })

  test('scans a browser-map replacement target', () => {
    withPackageRoot(
      [
        {
          name: 'package.json',
          source: JSON.stringify({
            main: './dist/index.js',
            browser: { './dist/index.js': './browser/index.js' },
            dependencies: { yjs: '*' }
          })
        },
        { name: 'dist/index.js', source: "import * as Y from 'yjs'\n" },
        {
          name: 'browser/index.js',
          source: "import { createHash } from 'node:crypto'\n"
        }
      ],
      (root) => {
        expect(checkOpLayerPurity(root)).toEqual([
          expect.objectContaining({
            rule: 'op-layer-yjs-only',
            message: expect.stringContaining('node:crypto')
          })
        ])
      }
    )
  })

  test('rejects a manifest entry outside the package', () => {
    withPackageRoot(
      [
        {
          name: 'package.json',
          source: JSON.stringify({
            main: '../forbidden.js',
            dependencies: { yjs: '*' }
          })
        },
        { name: 'dist/index.js', source: "import * as Y from 'yjs'\n" }
      ],
      (root) => {
        expect(checkOpLayerPurity(root)).toEqual([
          expect.objectContaining({
            rule: 'op-layer-yjs-only',
            message: expect.stringContaining('points outside the package')
          })
        ])
      }
    )
  })

  test('scans local modules reachable from a manifest entry', () => {
    withPackageRoot(
      [
        {
          name: 'package.json',
          source: JSON.stringify({
            main: './runtime/index.js',
            dependencies: { yjs: '*' }
          })
        },
        { name: 'runtime/index.js', source: "export * from './hidden.js'\n" },
        {
          name: 'runtime/hidden.js',
          source: "import { createHash } from 'node:crypto'\n"
        }
      ],
      (root) => {
        expect(checkOpLayerPurity(root)).toEqual([
          expect.objectContaining({
            rule: 'op-layer-yjs-only',
            message: expect.stringContaining('node:crypto')
          })
        ])
      }
    )
  })

  test.for([
    { name: 'missing manifest', files: [], problem: 'unreadable manifest' },
    {
      name: 'missing runtime',
      files: [{ name: 'package.json', source: '{"dependencies":{"yjs":"*"}}' }],
      problem: 'no built runtime files'
    }
  ])('fails closed for $name', ({ files, problem }) => {
    withPackageRoot(files, (root) => {
      expect(checkOpLayerPurity(root)).toEqual([
        expect.objectContaining({
          rule: 'op-layer-yjs-only',
          message: expect.stringContaining(problem)
        })
      ])
    })
  })

  test('passes a complete yjs-only installation under a temporary root', () => {
    withPackageRoot(
      [
        {
          name: 'package.json',
          source: JSON.stringify({
            main: './dist/index.js',
            dependencies: { yjs: '*' }
          })
        },
        { name: 'dist/index.js', source: "import * as Y from 'yjs'\n" }
      ],
      (root) => {
        expect(checkOpLayerPurity(root)).toEqual([])
      }
    )
  })
})

describe('checkCatalogPinnedBySha', () => {
  test.for([
    'widget catalog @main',
    'widget catalog https://github.com/Comfy-Org/repo/blob/main/catalog.json',
    'widget vocabulary https://github.com/Comfy-Org/repo/tree/develop/spec',
    'widget catalog https://raw.githubusercontent.com/Comfy-Org/repo/main/catalog.json',
    'widget vocabulary https://example.com/spec?ref=HEAD',
    'widget catalog\nhttps://github.com/Comfy-Org/repo/blob/master/catalog.json',
    'widget catalog https://github.com/Comfy-Org/repo/commits/latest/catalog.json',
    'widget catalog https://github.com/Org/repo/blob/feature/0123456789abcdef0123456789abcdef01234567/catalog.json'
  ])('fails an unpinned catalog citation: %s', (fixture) => {
    const violations = checkCatalogPinnedBySha(FOLLOWER_FILE, fixture)
    expect(violations).toHaveLength(1)
    expect(violations[0].rule).toBe('catalog-pinned-by-sha')
  })

  test('passes the allowed follower projection: citing the catalog by SHA', () => {
    const fixture =
      'catalog https://github.com/Comfy-Org/repo/blob/0123456789abcdef0123456789abcdef01234567/catalog.json'
    expect(checkCatalogPinnedBySha(FOLLOWER_FILE, fixture)).toEqual([])
  })

  test.for([
    '// https://github.com/Org/repo/blob/main/catalog.json',
    '// https://raw.githubusercontent.com/Org/repo/main/catalog.json',
    '// widget vocabulary at https://github.com/Org/repo/tree/HEAD/spec.json',
    '// see https://github.com/Org/repo/blob/main/widget-catalog.json for shapes'
  ])('fails a bare unpinned citation: %s', (fixture) => {
    const violations = checkCatalogPinnedBySha(FOLLOWER_FILE, fixture)
    expect(violations).toHaveLength(1)
    expect(violations[0].rule).toBe('catalog-pinned-by-sha')
  })

  test.for([
    '// https://raw.githubusercontent.com/Org/repo/0123456789abcdef0123456789abcdef01234567/catalog.json',
    '// unrelated link https://example.com/docs/main/index.html',
    '// catalog pinned at meta.catalog_version, cited by sha256 8d062714'
  ])('passes %s', (fixture) => {
    expect(checkCatalogPinnedBySha(FOLLOWER_FILE, fixture)).toEqual([])
  })
})

describe('checkNoScatteredDistributionChecks', () => {
  test('fails a forbidden mutation fixture: DISTRIBUTION conditional inside follower core', () => {
    const fixture = `
      const endpoint = isCloud ? cloudEndpoint : localEndpoint
    `
    const violations = checkNoScatteredDistributionChecks(
      FOLLOWER_FILE,
      fixture
    )
    expect(violations).toHaveLength(1)
    expect(violations[0].rule).toBe('no-scattered-distribution-checks')
  })

  test('passes the allowed follower projection: no distribution reference in follower core', () => {
    const fixture = `
      const endpoint = resolveAgentBaseUrl()
    `
    expect(checkNoScatteredDistributionChecks(FOLLOWER_FILE, fixture)).toEqual(
      []
    )
  })

  test.for([
    'const endpoint = __DISTRIBUTION__ === "cloud" ? cloud : local',
    'const endpoint = isNightly ? nightly : stable',
    'const endpoint = import.meta.env.VITE_AGENT_ENDPOINT',
    "const endpoint = distribution['isCloud'] ? cloud : local"
  ])('fails another distribution expression: %s', (fixture) => {
    expect(
      checkNoScatteredDistributionChecks(FOLLOWER_FILE, fixture)
    ).not.toEqual([])
  })

  test('passes the explicit agentAuth credential-branch exemption', () => {
    expect(
      checkNoScatteredDistributionChecks(
        'src/workbench/extensions/agent/services/agent/agentAuth.ts',
        'const auth = isCloud ? cloudAuth : localAuth'
      )
    ).toEqual([])
  })

  test.for([
    {
      name: 'a type-only interface property',
      fixture: 'export interface AgentFlags { isCloud: boolean }'
    },
    {
      name: 'a locally declared boolean',
      fixture: "const isDesktop = session.kind === 'desktop'"
    },
    {
      name: 'a type alias member',
      fixture: 'type Flags = { isNightly: boolean; DISTRIBUTION: string }'
    },
    {
      name: 'a declared class property',
      fixture: 'class Session { isCloud = false }'
    },
    {
      name: 'a field read off an unrelated object',
      fixture: 'const target = flags.isCloud'
    },
    {
      name: 'an object literal key',
      fixture: 'const flags = { isCloud: false, isDesktop: false }'
    },
    {
      name: 'a destructured local binding',
      fixture: 'const { isCloud } = props; const target = isCloud'
    },
    {
      name: 'a parameter named after a flag',
      fixture: 'function render(isDesktop: boolean) { return isDesktop }'
    }
  ])('passes $name — a name is not a branch', ({ fixture }) => {
    expect(checkNoScatteredDistributionChecks(FOLLOWER_FILE, fixture)).toEqual(
      []
    )
  })

  test('still fails the real import, which is the case the rule is for', () => {
    const violations = checkNoScatteredDistributionChecks(
      FOLLOWER_FILE,
      "import { isCloud } from '@/platform/distribution/types'"
    )
    expect(violations).toHaveLength(1)
    expect(violations[0].rule).toBe('no-scattered-distribution-checks')
    expect(violations[0].message).toContain('imports the distribution module')
  })

  test('fails both the import and the branch it feeds', () => {
    const fixture = [
      "import { isCloud } from '@/platform/distribution/types'",
      '',
      'const endpoint = isCloud ? cloudEndpoint : localEndpoint'
    ].join('\n')
    expect(
      checkNoScatteredDistributionChecks(FOLLOWER_FILE, fixture).map(
        ({ line }) => line
      )
    ).toEqual([1, 3])
  })

  test('fails a namespaced distribution import and its member read', () => {
    const fixture = [
      "import * as distribution from '@/platform/distribution/types'",
      '',
      'const endpoint = distribution.isCloud ? cloudEndpoint : localEndpoint'
    ].join('\n')
    expect(
      checkNoScatteredDistributionChecks(FOLLOWER_FILE, fixture)
    ).toHaveLength(2)
  })

  test.for([
    {
      name: 'an imported flag shadowed by a parameter',
      importStatement:
        "import { isCloud } from '@/platform/distribution/types'",
      branch: 'function unrelated(isCloud: boolean) { return isCloud ? 1 : 0 }'
    },
    {
      name: 'an imported namespace shadowed by a parameter',
      importStatement:
        "import * as distribution from '@/platform/distribution/types'",
      branch:
        "function unrelated(distribution: Flags) { return distribution['isCloud'] }"
    }
  ])('passes $name', ({ importStatement, branch }) => {
    const fixture = [
      '// follower-invariant-allow-next-line no-scattered-distribution-checks',
      '// owner: @christian-byrne; rationale: isolate imported binding identity; sunset: 2099-01-01; removalCriteria: when this test is removed',
      importStatement,
      branch
    ].join('\n')
    expect(checkNoScatteredDistributionChecks(FOLLOWER_FILE, fixture)).toEqual(
      []
    )
  })

  test('fails the ambient flag a local alias would be derived from', () => {
    const violations = checkNoScatteredDistributionChecks(
      FOLLOWER_FILE,
      "const isCloud = DISTRIBUTION === 'cloud'"
    )
    expect(violations).toHaveLength(1)
    expect(violations[0].message).toContain('DISTRIBUTION')
  })

  test('fails an ambient flag that only an out-of-scope declaration would cover', () => {
    const violations = checkNoScatteredDistributionChecks(
      FOLLOWER_FILE,
      [
        'function render(__DISTRIBUTION__: string) { return __DISTRIBUTION__ }',
        "const cloud = __DISTRIBUTION__ === 'cloud'"
      ].join('\n')
    )
    expect(violations).toHaveLength(1)
    expect(violations[0].line).toBe(2)
    expect(violations[0].message).toContain('ambient distribution flag')
  })

  test.for([
    {
      name: 'a type alias with the same name',
      fixture:
        "type __DISTRIBUTION__ = string; const cloud = __DISTRIBUTION__ === 'cloud'"
    },
    {
      name: 'a function type parameter with the same name',
      fixture:
        "function unrelated<__DISTRIBUTION__>() {}; const cloud = __DISTRIBUTION__ === 'cloud'"
    }
  ])('fails an ambient flag hidden by $name', ({ fixture }) => {
    expect(checkNoScatteredDistributionChecks(FOLLOWER_FILE, fixture)).toEqual([
      expect.objectContaining({
        rule: 'no-scattered-distribution-checks',
        message: expect.stringContaining('ambient distribution flag')
      })
    ])
  })

  test('passes a renamed destructuring field', () => {
    expect(
      checkNoScatteredDistributionChecks(
        FOLLOWER_FILE,
        'const { isCloud: cloud } = flags'
      )
    ).toEqual([])
  })

  test('still fails a computed destructuring key', () => {
    expect(
      checkNoScatteredDistributionChecks(
        FOLLOWER_FILE,
        'const { [isCloud]: cloud } = flags'
      )
    ).toHaveLength(1)
  })

  test.for([
    {
      name: 'a dynamic distribution module import',
      fixture:
        "const flags = await import('@/platform/distribution/types'); const enabled = flags.isCloud",
      detail: 'imports the distribution module'
    },
    {
      name: 'a bracketed build-environment read',
      fixture: "const enabled = import.meta['env'].DEV",
      detail: 'build-time environment flag'
    },
    {
      name: 'a re-export of the distribution module',
      fixture: "export { isCloud } from '@/platform/distribution/types'",
      detail: 'imports the distribution module'
    }
  ])('fails $name', ({ fixture, detail }) => {
    const violations = checkNoScatteredDistributionChecks(
      FOLLOWER_FILE,
      fixture
    )
    expect(violations).not.toEqual([])
    expect(violations[0].message).toContain(detail)
  })

  test.for([
    "const flags = { isCloud: false }; const enabled = flags['isCloud']",
    "function read(flags: Flags) { return flags['isDesktop'] }",
    "const { distribution } = props; const enabled = distribution['isCloud']"
  ])('passes a bracket read of a locally bound object: %s', (fixture) => {
    expect(checkNoScatteredDistributionChecks(FOLLOWER_FILE, fixture)).toEqual(
      []
    )
  })

  test('still fails a bracket read with no local binding behind it', () => {
    expect(
      checkNoScatteredDistributionChecks(
        FOLLOWER_FILE,
        "const enabled = globalThis['__DISTRIBUTION__'] === 'cloud'"
      )
    ).toHaveLength(1)
  })

  test('ignores distribution names in comments and strings', () => {
    const fixture = `
      // isCloud ? cloudEndpoint : localEndpoint
      const note = 'DISTRIBUTION is selected in agentAuth.ts'
    `
    expect(checkNoScatteredDistributionChecks(FOLLOWER_FILE, fixture)).toEqual(
      []
    )
  })
})

describe('checkNoHardcodedEndpoint', () => {
  test('fails a forbidden mutation fixture: a hardcoded wss:// literal in follower core', () => {
    const fixture = `
      const socket = new WebSocket('wss://agent.comfy.org/ws')
    `
    const violations = checkNoHardcodedEndpoint(FOLLOWER_FILE, fixture)
    expect(violations).toHaveLength(1)
    expect(violations[0].rule).toBe('no-hardcoded-endpoint')
  })

  test('passes the allowed follower projection: resolving through the centralized seam', () => {
    const fixture = `
      const socket = api.socket(resolveAgentBaseUrl())
    `
    expect(checkNoHardcodedEndpoint(FOLLOWER_FILE, fixture)).toEqual([])
  })

  test('passes an endpoint literal mentioned only in a comment', () => {
    const fixture = `
      // legacy endpoint was wss://old.example.com/ws, now resolved dynamically
      const socket = api.socket(resolveAgentBaseUrl())
    `
    expect(checkNoHardcodedEndpoint(FOLLOWER_FILE, fixture)).toEqual([])
  })

  test('passes an endpoint literal inside a block comment', () => {
    const fixture = `
      /*
       * Never reconnect to wss://old.example.com/ws.
       */
      const socket = api.socket(api.apiURL('/api/agent/events'))
    `
    expect(checkNoHardcodedEndpoint(FOLLOWER_FILE, fixture)).toEqual([])
  })

  test.for([
    "const socket = new WebSocket('WSS://agent.comfy.org/ws')",
    "const socket = new WebSocket('//agent.comfy.org/ws')",
    'const socket = new WebSocket(`wss://${host}/ws`)',
    "const socket = new WebSocket(api.apiURL('/ws'))",
    "const options = { endpoint: api.apiURL('/other-events') }"
  ])('fails an alternate endpoint form: %s', (fixture) => {
    expect(checkNoHardcodedEndpoint(FOLLOWER_FILE, fixture)).toHaveLength(1)
  })

  test.for([
    "const socket = new WebSocket(api.apiURL('/agent/events'))",
    "const socket = new WebSocket(api.apiURL('/api/agent/events'))"
  ])('passes the shared event endpoint: %s', (fixture) => {
    expect(checkNoHardcodedEndpoint(FOLLOWER_FILE, fixture)).toEqual([])
  })
})

describe('suppression path', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-05-31T12:00:00Z') })
    return () => vi.useRealTimers()
  })

  const BRANCH = 'const endpoint = isCloud ? cloudEndpoint : localEndpoint'
  const directive = (fields: string) =>
    [
      '// follower-invariant-allow-next-line no-scattered-distribution-checks',
      `// ${fields}`,
      BRANCH
    ].join('\n')
  const COMPLETE =
    'owner: @christian-byrne; rationale: measured false positive; sunset: 2099-01-01; removalCriteria: when the rule models this shape'

  test('a complete, unexpired directive suppresses the violation it names', () => {
    expect(
      checkNoScatteredDistributionChecks(FOLLOWER_FILE, directive(COMPLETE))
    ).toEqual([])
  })

  test('does not suppress a matching violation after the target line', () => {
    const source = directive(COMPLETE).replace(
      BRANCH,
      `const harmless = 1\n${BRANCH}`
    )
    expect(checkFile(FOLLOWER_FILE, source).map(({ rule }) => rule)).toEqual([
      'no-scattered-distribution-checks',
      'suppression-unused'
    ])
  })

  test.for([
    {
      name: 'ordinary string',
      opening:
        "const note = 'follower-invariant-allow-next-line no-scattered-distribution-checks '",
      expected: ['no-scattered-distribution-checks']
    },
    {
      name: 'template literal',
      opening:
        'const note = `follower-invariant-allow-next-line no-scattered-distribution-checks `',
      expected: ['no-scattered-distribution-checks']
    }
  ])('ignores a directive marker inside an $name', ({ opening, expected }) => {
    const source = [opening, `// ${COMPLETE}`, BRANCH].join('\n')
    expect(checkFile(FOLLOWER_FILE, source).map(({ rule }) => rule)).toEqual(
      expected
    )
  })

  test.for([
    {
      name: 'an expired sunset',
      fields:
        'owner: @christian-byrne; rationale: stale; sunset: 2020-01-01; removalCriteria: already due',
      problem: 'expired on 2020-01-01'
    },
    {
      name: 'a missing removal criterion',
      fields:
        'owner: @christian-byrne; rationale: measured false positive; sunset: 2099-01-01',
      problem: 'missing required field(s) removalCriteria'
    },
    {
      name: 'a missing owner',
      fields:
        'rationale: measured false positive; sunset: 2099-01-01; removalCriteria: later',
      problem: 'missing required field(s) owner'
    },
    {
      name: 'an owner that is not a handle',
      fields:
        'owner: christian-byrne; rationale: x; sunset: 2099-01-01; removalCriteria: later',
      problem: 'not an @handle'
    },
    {
      name: 'an unparsable sunset',
      fields:
        'owner: @christian-byrne; rationale: x; sunset: someday; removalCriteria: later',
      problem: 'not a YYYY-MM-DD date'
    },
    {
      name: 'a sunset that is not a real calendar date',
      fields:
        'owner: @christian-byrne; rationale: x; sunset: 2099-02-31; removalCriteria: later',
      problem: 'not a YYYY-MM-DD date'
    }
  ])(
    'does not suppress with $name, and reports itself',
    ({ fields, problem }) => {
      const violations = checkNoScatteredDistributionChecks(
        FOLLOWER_FILE,
        directive(fields)
      )
      expect(violations.map(({ rule }) => rule)).toEqual([
        'no-scattered-distribution-checks',
        'suppression-invalid'
      ])
      expect(violations[1].message).toContain(problem)
    }
  )

  test('reports a directive naming a rule that does not exist', () => {
    const fixture = [
      '// follower-invariant-allow-next-line no-such-rule',
      `// ${COMPLETE}`,
      BRANCH
    ].join('\n')
    const violations = checkNoScatteredDistributionChecks(
      FOLLOWER_FILE,
      fixture
    )
    expect(violations.map(({ rule }) => rule)).toEqual([
      'no-scattered-distribution-checks',
      'suppression-invalid'
    ])
    expect(violations[1].message).toContain('names unknown rule "no-such-rule"')
  })

  test('reports a marker that names no rule', () => {
    const fixture = [
      '// follower-invariant-allow-next-line',
      `// ${COMPLETE}`,
      'const harmless = resolveAgentBaseUrl()'
    ].join('\n')
    const violations = checkNoScatteredDistributionChecks(
      FOLLOWER_FILE,
      fixture
    )
    expect(violations.map(({ rule }) => rule)).toEqual(['suppression-invalid'])
    expect(violations[0].message).toContain('does not name a rule')
  })

  test('reports a valid directive that matches no violation', () => {
    const fixture = [
      '// follower-invariant-allow-next-line no-scattered-distribution-checks',
      `// ${COMPLETE}`,
      'const endpoint = resolveAgentBaseUrl()'
    ].join('\n')
    const violations = checkNoScatteredDistributionChecks(
      FOLLOWER_FILE,
      fixture
    )
    expect(violations).toHaveLength(1)
    expect(violations[0].rule).toBe('suppression-unused')
  })

  test('rejects duplicate directive fields instead of choosing one', () => {
    const fixture = directive(`${COMPLETE}; sunset: broken`)
    expect(
      checkNoScatteredDistributionChecks(FOLLOWER_FILE, fixture).map(
        ({ rule }) => rule
      )
    ).toEqual(['no-scattered-distribution-checks', 'suppression-invalid'])
  })

  test('a directive for one rule does not suppress another', () => {
    const fixture = [
      '// follower-invariant-allow-next-line no-hardcoded-endpoint',
      `// ${COMPLETE}`,
      BRANCH
    ].join('\n')
    expect(checkFile(FOLLOWER_FILE, fixture).map(({ rule }) => rule)).toEqual([
      'no-scattered-distribution-checks',
      'suppression-unused'
    ])
  })

  test('suppresses through checkFile, the path CI runs', () => {
    expect(checkFile(FOLLOWER_FILE, directive(COMPLETE))).toEqual([])
  })

  test('judges the sunset against the date it is given, not the clock', () => {
    const violations = [
      {
        file: FOLLOWER_FILE,
        line: 3,
        rule: 'no-hardcoded-endpoint',
        message: ''
      }
    ]
    const fixture = [
      '// follower-invariant-allow-next-line no-hardcoded-endpoint',
      '// owner: @christian-byrne; rationale: x; sunset: 2026-06-01; removalCriteria: later',
      "const socket = new WebSocket('wss://agent.comfy.org/ws')"
    ].join('\n')
    expect(
      applySuppressions(
        FOLLOWER_FILE,
        fixture,
        violations,
        undefined,
        '2026-05-31'
      )
    ).toEqual([])
    expect(
      applySuppressions(
        FOLLOWER_FILE,
        fixture,
        violations,
        undefined,
        '2026-06-02'
      ).map(({ rule }) => rule)
    ).toEqual(['no-hardcoded-endpoint', 'suppression-invalid'])
  })
})

describe('checkFile (combined) — allowed follower projection', () => {
  test('a realistic allowed follower projection passes every rule at once', () => {
    const fixture = `
      import type { Op } from '@comfyorg/comfy-multi-player'

      import { resolveAgentBaseUrl } from '@/platform/agent/agentBaseUrl'

      // catalog pinned at meta.catalog_version, cited by sha256 8d062714

      export function connect(): WebSocket {
        return new WebSocket(resolveAgentBaseUrl())
      }

      export function onFrame(data: { update_b64?: unknown }) {
        if (typeof data.update_b64 === 'string') {
          const update = decodeBase64(data.update_b64)
          followerDoc.applyRemoteUpdate(update)
        }
      }
    `
    expect(checkFile(FOLLOWER_FILE, fixture)).toEqual([])
  })

  test('a violating file reports every rule through checkFile', () => {
    const fixture = `
      // catalog fetched from @main
      const frame = { update_b64: encoded, op_id: mintOpId() }
      const endpoint = isCloud
      const socket = 'wss://agent.comfy.org/ws'
    `
    const rules = checkFile(FOLLOWER_FILE, fixture).map(({ rule }) => rule)
    expect(rules).toHaveLength(5)
    expect(rules).toEqual(
      expect.arrayContaining([
        'catalog-pinned-by-sha',
        'no-hardcoded-endpoint',
        'no-op-id-regeneration',
        'no-outbound-update-b64',
        'no-scattered-distribution-checks'
      ])
    )
  })

  test('unparsable TypeScript fails closed with a syntax-error violation', () => {
    expect(
      checkFile(FOLLOWER_FILE, 'const = {').map(({ rule }) => rule)
    ).toContain('syntax-error')
  })
})

describe('filesystem contract', () => {
  let root = ''

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'follower-scope-'))
    return () => rmSync(root, { recursive: true, force: true })
  })

  test('a missing declared seam file fails closed', () => {
    expect(checkFollowerFiles(root, [FOLLOWER_FILE])).toEqual([
      expect.objectContaining({
        file: FOLLOWER_FILE,
        line: 1,
        rule: 'declared-file-unreadable'
      })
    ])
  })

  test('a newly added CRDT seam file is in scope without an allowlist edit', () => {
    const file = 'src/workbench/extensions/agent/crdt/newFollowerSeam.ts'
    expect(
      checkFile(file, "const socket = new WebSocket('wss://example.com/ws')")
    ).toEqual([
      expect.objectContaining({
        file,
        rule: 'no-hardcoded-endpoint'
      })
    ])
  })

  test('discovers CRDT and Agent transport production files', () => {
    const files = [
      'src/workbench/extensions/agent/crdt/follower.ts',
      'src/workbench/extensions/agent/services/agent/transport.ts'
    ]
    for (const file of [...files, `${files[0]}.test.ts`]) {
      const target = join(root, file)
      mkdirSync(join(target, '..'), { recursive: true })
      writeFileSync(target, '')
    }
    expect(findFollowerFiles(root)).toEqual(files)
  })

  test('scans exactly the files it is given, never a rediscovered set', () => {
    const files = [
      'src/workbench/extensions/agent/crdt/first.ts',
      'src/workbench/extensions/agent/crdt/second.ts'
    ]
    expect(checkFollowerFiles(root, files)).toHaveLength(2)
  })

  test('an empty discovered scope fails closed', () => {
    expect(checkFollowerFiles(root)).toEqual([
      expect.objectContaining({ rule: 'follower-scope-empty' })
    ])
  })
})
