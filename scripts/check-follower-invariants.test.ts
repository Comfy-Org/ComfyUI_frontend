import { describe, expect, test } from 'vitest'

import {
  checkCatalogPinnedBySha,
  checkFile,
  checkFollowerFiles,
  checkNoHardcodedEndpoint,
  checkNoOpIdRegeneration,
  checkNoOutboundUpdateB64,
  checkNoScatteredDistributionChecks,
  checkSingleApplier,
  findFollowerFiles,
  FOLLOWER_CORE_FILES
} from './check-follower-invariants'

const FOLLOWER_FILE = FOLLOWER_CORE_FILES[0]

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
        return ops.map((op) => ({ ...op })) // same op_id, no re-mint
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

  test('ignores op_id examples in comments', () => {
    const fixture = `
      /* retry = { op_id: createUuidv4() } */
      const retried = { ...op }
    `
    expect(checkNoOpIdRegeneration(FOLLOWER_FILE, fixture)).toEqual([])
  })
})

describe('checkSingleApplier', () => {
  test('fails a forbidden mutation fixture: importing a local applier reimplementation', () => {
    const fixture = `
      import { applyOp } from './applier'
    `
    const violations = checkSingleApplier(FOLLOWER_FILE, fixture)
    expect(violations).toHaveLength(1)
    expect(violations[0].rule).toBe('single-applier')
  })

  test('passes the allowed follower projection: importing the pinned shared package', () => {
    const fixture = `
      import type { Op } from '@comfyorg/comfy-multi-player'
      import { BATCHABLE_OPS } from '@comfyorg/comfy-multi-player'
    `
    expect(checkSingleApplier(FOLLOWER_FILE, fixture)).toEqual([])
  })

  test('fails a multiline local applier import', () => {
    const fixture = `
      import {
        applyOp
      } from './opApplier'
    `
    expect(checkSingleApplier(FOLLOWER_FILE, fixture)).toHaveLength(1)
  })

  test('ignores local-applier examples in comments', () => {
    const fixture = `
      /* import { applyOp } from './applier' */
      import { applyOps } from '@comfyorg/comfy-multi-player'
    `
    expect(checkSingleApplier(FOLLOWER_FILE, fixture)).toEqual([])
  })

  test.for([
    `const m = await import('./applier')`,
    `void import('../crdt/docHost.ts')`,
    'const m = await import(`./opApplier`)',
    "export { applyOp } from './applier'",
    "export * from './docHost/index.ts'",
    "import applier = require('./opApplier.cts')"
  ])('fails a dynamic local applier import: %s', (fixture) => {
    const violations = checkSingleApplier(FOLLOWER_FILE, fixture)
    expect(violations).toHaveLength(1)
    expect(violations[0].rule).toBe('single-applier')
  })

  test('passes a dynamic import of the pinned shared package', () => {
    expect(
      checkSingleApplier(
        FOLLOWER_FILE,
        `const m = await import('@comfyorg/comfy-multi-player')`
      )
    ).toEqual([])
  })

  test('passes a shared-package subpath import', () => {
    expect(
      checkSingleApplier(
        FOLLOWER_FILE,
        `export { applyOps } from '@comfyorg/comfy-multi-player/applier'`
      )
    ).toEqual([])
  })

  test('passes a dynamic import of an unrelated seam module', () => {
    expect(
      checkSingleApplier(
        FOLLOWER_FILE,
        `const m = await import('./useAgentCrdtFollower')`
      )
    ).toEqual([])
  })

  test('ignores a dynamic local-applier import inside a comment', () => {
    const fixture = `
      /* import('./applier') */
      const applied = applyOps(ops)
    `
    expect(checkSingleApplier(FOLLOWER_FILE, fixture)).toEqual([])
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
    'widget catalog https://github.com/Comfy-Org/repo/commits/latest/catalog.json'
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
      import { applyOp } from './applier'
      // catalog fetched from @main
      const frame = { update_b64: encoded, op_id: mintOpId() }
      const endpoint = isCloud
      const socket = 'wss://agent.comfy.org/ws'
    `
    const rules = checkFile(FOLLOWER_FILE, fixture).map(({ rule }) => rule)
    expect(rules).toHaveLength(6)
    expect(rules).toEqual(
      expect.arrayContaining([
        'catalog-pinned-by-sha',
        'no-hardcoded-endpoint',
        'no-op-id-regeneration',
        'no-outbound-update-b64',
        'no-scattered-distribution-checks',
        'single-applier'
      ])
    )
  })

  test('unparsable TypeScript fails closed with a syntax-error violation', () => {
    expect(
      checkFile(FOLLOWER_FILE, 'const = {').map(({ rule }) => rule)
    ).toContain('syntax-error')
  })
})

describe('checkFile against the real follower-core sources', () => {
  test('every declared current-main seam file exists and passes', () => {
    expect(checkFollowerFiles(process.cwd())).toEqual([])
  })

  test('a missing declared seam file fails closed', () => {
    expect(
      checkFollowerFiles('/definitely-not-a-repository', [FOLLOWER_FILE])
    ).toEqual([
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
    const files = findFollowerFiles(process.cwd())
    expect(files).toContain(
      'src/workbench/extensions/agent/crdt/opCoalescer.ts'
    )
    expect(files).toContain(
      'src/workbench/extensions/agent/services/agent/agentEventSource.ts'
    )
    expect(files).not.toContain(
      'src/workbench/extensions/agent/crdt/opEnvelope.test.ts'
    )
  })

  test('an empty discovered scope fails closed', () => {
    expect(checkFollowerFiles('/definitely-not-a-repository')).toEqual([
      expect.objectContaining({ rule: 'follower-scope-empty' })
    ])
  })
})
