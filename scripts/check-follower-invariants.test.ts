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
    '{ update_b64 }'
  ])('fails outbound expression %s', (expression) => {
    expect(
      checkNoOutboundUpdateB64(
        FOLLOWER_FILE,
        `socket.send(JSON.stringify(${expression}))`
      )
    ).toHaveLength(1)
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
})

describe('checkCatalogPinnedBySha', () => {
  test('fails a forbidden mutation fixture: citing the catalog by moving branch', () => {
    const fixture = `
      // fetched from the widget catalog @main
    `
    const violations = checkCatalogPinnedBySha(FOLLOWER_FILE, fixture)
    expect(violations).toHaveLength(1)
    expect(violations[0].rule).toBe('catalog-pinned-by-sha')
  })

  test('passes the allowed follower projection: citing the catalog by SHA', () => {
    const fixture = `
      // catalog pinned at meta.catalog_version, cited by sha256 8d062714
    `
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

  test('passes a debug-report file reading DISTRIBUTION for display only', () => {
    const fixture = `
      lines.push(\`- **Distribution:** \${DISTRIBUTION}\`)
    `
    expect(
      checkNoScatteredDistributionChecks(
        'src/workbench/extensions/agent/crdt/crdtDebugReport.ts',
        fixture
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
})
