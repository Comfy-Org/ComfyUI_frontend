import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, test } from 'vitest'

import {
  checkCatalogPinnedBySha,
  checkFile,
  checkFollowerFiles,
  checkNoHardcodedEndpoint,
  checkNoOutboundUpdateB64
} from './check-follower-invariants'

const FOLLOWER_FILE = 'src/workbench/extensions/agent/crdt/follower.ts'

describe('checkNoOutboundUpdateB64', () => {
  test('fails a forbidden mutation fixture: constructing an outbound update_b64 frame', () => {
    const fixture = `
      function sendUpdate(encoded: string) {
        socket.send(JSON.stringify({ type: 'doc_update', update_b64: encoded }))
      }
    `
    const violations = checkNoOutboundUpdateB64(FOLLOWER_FILE, fixture)
    expect(violations).toEqual([
      expect.objectContaining({
        file: FOLLOWER_FILE,
        line: 3,
        rule: 'no-outbound-update-b64'
      })
    ])
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

  test.for([
    { source: 'let update_b64; ({ update_b64 } = data)', expected: 0 },
    {
      source: 'let update_b64; ({ payload: { update_b64 } } = data)',
      expected: 0
    },
    { source: 'let update_b64; [{ update_b64 }] = data', expected: 0 },
    {
      source:
        'let update_b64; for ({ update_b64 } of frames) consume(update_b64)',
      expected: 0
    },
    {
      source: 'let update_b64; [...[{ update_b64 }]] = frames',
      expected: 0
    },
    {
      source: 'for (const frame of [{ update_b64: encoded }]) consume(frame)',
      expected: 1
    },
    {
      source: 'let payload; ({ payload = { update_b64: encoded } } = data)',
      expected: 1
    }
  ])('classifies assignment pattern $source', ({ source, expected }) => {
    expect(checkNoOutboundUpdateB64(FOLLOWER_FILE, source)).toHaveLength(
      expected
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
    'widget catalog https://github.com/Org/repo/blob/feature/0123456789abcdef0123456789abcdef01234567/catalog.json',
    'widget catalog https://github.com/Org/repo/blob/release-0123456789abcdef0123456789abcdef01234567/catalog.json'
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

describe('checkFile', () => {
  test('passes a realistic allowed follower projection', () => {
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

  test('reports every selected rule from one violating file', () => {
    const fixture = `
      // catalog fetched from @main
      const frame = { update_b64: encoded }
      const socket = 'wss://agent.comfy.org/ws'
    `
    const rules = checkFile(FOLLOWER_FILE, fixture).map(({ rule }) => rule)
    expect(rules).toHaveLength(3)
    expect(rules).toEqual(
      expect.arrayContaining([
        'catalog-pinned-by-sha',
        'no-hardcoded-endpoint',
        'no-outbound-update-b64'
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

  test('analyzes discovered CRDT and Agent transport production files', () => {
    const crdtDirectory = join(root, 'src/workbench/extensions/agent/crdt')
    const transportDirectory = join(
      root,
      'src/workbench/extensions/agent/services/agent'
    )
    mkdirSync(crdtDirectory, { recursive: true })
    mkdirSync(transportDirectory, { recursive: true })
    writeFileSync(
      join(crdtDirectory, 'follower.ts'),
      "const endpoint = 'wss://example.com/ws'"
    )
    writeFileSync(
      join(transportDirectory, 'transport.ts'),
      "const endpoint = 'wss://example.com/ws'"
    )
    writeFileSync(
      join(crdtDirectory, 'follower.test.ts'),
      "const endpoint = 'wss://example.com/ws'"
    )
    expect(
      checkFollowerFiles(root).map(({ file, rule }) => ({ file, rule }))
    ).toEqual([
      {
        file: 'src/workbench/extensions/agent/crdt/follower.ts',
        rule: 'no-hardcoded-endpoint'
      },
      {
        file: 'src/workbench/extensions/agent/services/agent/transport.ts',
        rule: 'no-hardcoded-endpoint'
      }
    ])
  })

  test('scans exactly the files it is given, never a rediscovered set', () => {
    const files = [
      'src/workbench/extensions/agent/crdt/first.ts',
      'src/workbench/extensions/agent/crdt/second.ts'
    ]
    expect(
      checkFollowerFiles(root, files).map(({ file, rule }) => ({ file, rule }))
    ).toEqual([
      {
        file: 'src/workbench/extensions/agent/crdt/first.ts',
        rule: 'declared-file-unreadable'
      },
      {
        file: 'src/workbench/extensions/agent/crdt/second.ts',
        rule: 'declared-file-unreadable'
      }
    ])
  })

  test('an empty discovered scope fails closed', () => {
    expect(checkFollowerFiles(root)).toEqual([
      expect.objectContaining({ rule: 'follower-scope-empty' })
    ])
  })
})
