import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, test } from 'vitest'

import {
  FOLLOWER_REPLICA_OWNER,
  FOLLOWER_SESSION_OWNER,
  OP_PRODUCER_OWNER,
  PAGE_SESSION_OWNER,
  checkAgentSurfaceFiles,
  checkCatalogPinnedBySha,
  checkFile,
  checkFollowerFiles,
  checkNoHardcodedEndpoint,
  checkNoOutboundUpdateB64,
  checkOpProducersOutliveThePanel,
  checkPageSessionOwnsTransport,
  checkSessionOwnsFollowerLifetime,
  findAgentSurfaceFiles
} from './check-follower-invariants'

const FOLLOWER_FILE = 'src/workbench/extensions/agent/crdt/follower.ts'
const PANEL_FILE = 'src/workbench/extensions/agent/AgentPanelRoot.vue'
const REPOSITORY_ROOT = join(import.meta.dirname, '..')
const REPOSITORY_SCAN_TIMEOUT = 60_000

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

describe('checkSessionOwnsFollowerLifetime', () => {
  const OWNER = FOLLOWER_SESSION_OWNER
  const REPLICA_OWNER = FOLLOWER_REPLICA_OWNER

  test.for([
    'startAgentCrdtFollower(workflowId, { transport })',
    'new AgentCrdtProjection(getGraph, applierDeps)'
  ])('fails a component constructing %s', (expression) => {
    const fixture = `<script setup lang="ts">
const follower = ${expression}
onBeforeUnmount(() => follower.destroy())
</script>`
    expect(
      checkSessionOwnsFollowerLifetime(PANEL_FILE, fixture).map(
        ({ rule, line }) => ({ rule, line })
      )
    ).toEqual([{ rule: 'session-owns-follower-lifetime', line: 2 }])
  })

  test('fails a second replica minted outside the bridge', () => {
    const fixture = `const doc = new FollowerDoc()\n`
    expect(
      checkSessionOwnsFollowerLifetime(OWNER, fixture).map(({ rule }) => rule)
    ).toEqual(['session-owns-follower-lifetime'])
  })

  test('passes the owner constructing the bridge and the projection', () => {
    const fixture = `
      const bridge = new LayoutFollowerBridge(client)
      const projection = new AgentCrdtProjection(getGraph, applierDeps)
    `
    expect(checkSessionOwnsFollowerLifetime(OWNER, fixture)).toEqual([])
  })

  test('passes the bridge replacing its own replica on a lineage break', () => {
    const fixture = `this.followerDoc = new FollowerDoc()\n`
    expect(checkSessionOwnsFollowerLifetime(REPLICA_OWNER, fixture)).toEqual([])
  })

  test('passes a panel consuming the session through the composable', () => {
    const fixture = `<script setup lang="ts">
const crdt = useAgentCrdtFollower(boundWorkflowId, { transport: docTransport })
</script>`
    expect(checkSessionOwnsFollowerLifetime(PANEL_FILE, fixture)).toEqual([])
  })

  test('reports the line in the .vue file, not in the extracted script', () => {
    const fixture = `<template>\n  <div />\n</template>\n\n<script setup lang="ts">\nconst b = new LayoutFollowerBridge(client)\n</script>`
    expect(checkSessionOwnsFollowerLifetime(PANEL_FILE, fixture)).toEqual([
      expect.objectContaining({ line: 6 })
    ])
  })

  test('ignores a file outside the agent surface', () => {
    expect(
      checkSessionOwnsFollowerLifetime(
        'src/stores/workflowStore.ts',
        'const b = new LayoutFollowerBridge(client)\n'
      )
    ).toEqual([])
  })
})

describe('checkPageSessionOwnsTransport', () => {
  test('fails the regression it exists to catch: a component constructing the transport', () => {
    const fixture = `<script setup lang="ts">
const events = createAgentEventSource({ endpoint: api.apiURL('/agent/events') })
const docTransport = createAgentDocFrameTransport(events)
onBeforeUnmount(() => docTransport.destroy())
</script>`
    expect(
      checkPageSessionOwnsTransport(PANEL_FILE, fixture).map(
        ({ rule, line }) => ({ rule, line })
      )
    ).toEqual([
      { rule: 'page-session-owns-transport', line: 2 },
      { rule: 'page-session-owns-transport', line: 3 }
    ])
  })

  test('reports the line in the .vue file, not in the extracted script', () => {
    const fixture = `<template>\n  <div />\n</template>\n\n<script setup lang="ts">\nconst events = createAgentEventSource({})\n</script>`
    expect(checkPageSessionOwnsTransport(PANEL_FILE, fixture)).toEqual([
      expect.objectContaining({ line: 6 })
    ])
  })

  test('fails closed when a .vue script block does not parse', () => {
    const fixture = `<script setup lang="ts">\nconst events = createAgentEventSource({\n</script>`
    expect(
      checkPageSessionOwnsTransport(PANEL_FILE, fixture).map(({ rule }) => rule)
    ).toContain('syntax-error')
  })

  test('reports a parse failure against the .vue path, not the parser alias', () => {
    const fixture = `<script setup lang="ts">\nconst events = createAgentEventSource({\n</script>`
    for (const violation of checkPageSessionOwnsTransport(PANEL_FILE, fixture))
      expect(violation.file).toBe(PANEL_FILE)
  })

  test.for([
    'generic="T extends Array<string>"',
    "generic='T extends Array<string>'",
    'generic="T extends Record<string, () => void>"'
  ])('catches the forbidden call in an SFC opened with %s', (attribute) => {
    const fixture = `<script setup lang="ts" ${attribute}>\nconst events = createAgentEventSource({})\n</script>`
    expect(checkPageSessionOwnsTransport(PANEL_FILE, fixture)).toEqual([
      expect.objectContaining({
        file: PANEL_FILE,
        line: 2,
        rule: 'page-session-owns-transport'
      })
    ])
  })

  test('keeps real-line anchors when a generic opening tag spans lines', () => {
    const fixture = `<template>\n  <div />\n</template>\n\n<script\n  setup\n  lang="ts"\n  generic="T extends Array<string>"\n>\nconst events = createAgentEventSource({})\n</script>`
    expect(checkPageSessionOwnsTransport(PANEL_FILE, fixture)).toEqual([
      expect.objectContaining({ line: 10 })
    ])
  })
})

describe('checkPageSessionOwnsTransport allowed shapes', () => {
  test('passes the owner module itself', () => {
    const fixture = `
      const events = createAgentEventSource({ endpoint, getAuthParams })
      return { events, docTransport: createAgentDocFrameTransport(events) }
    `
    expect(checkPageSessionOwnsTransport(PAGE_SESSION_OWNER, fixture)).toEqual(
      []
    )
  })

  test('passes a component that consumes the page session', () => {
    const fixture = `<script setup lang="ts">
const { events, docTransport } = useAgentPageSession()
</script>`
    expect(checkPageSessionOwnsTransport(PANEL_FILE, fixture)).toEqual([])
  })

  test('passes the factory definitions, which declare rather than call', () => {
    const fixture = `
      export function createAgentDocFrameTransport(source: AgentEventSocket) {
        return { destroy() {} }
      }
    `
    expect(
      checkPageSessionOwnsTransport(
        'src/workbench/extensions/agent/crdt/agentDocFrameTransport.ts',
        fixture
      )
    ).toEqual([])
  })

  test('ignores a factory name that only appears in a comment or a string', () => {
    const fixture = `
      const label = 'createAgentDocFrameTransport'
    `
    expect(checkPageSessionOwnsTransport(FOLLOWER_FILE, fixture)).toEqual([])
  })

  test('ignores files outside the agent surface', () => {
    const fixture = 'const events = createAgentEventSource({})'
    expect(
      checkPageSessionOwnsTransport('src/scripts/app.ts', fixture)
    ).toEqual([])
  })
})

describe('checkOpProducersOutliveThePanel', () => {
  test('fails the regression it exists to catch: the panel owning the op producer', () => {
    const fixture = `<script setup lang="ts">
const docOpMinter = attachDocOpMinter({ isEnabled, isDocBound, enqueue })
onBeforeUnmount(() =>
  runPanelTeardown({
    detachDocOpMinter: () => {
      docOpMinter.detach()
    }
  })
)
</script>`
    expect(
      checkOpProducersOutliveThePanel(PANEL_FILE, fixture).map(
        ({ rule, line }) => ({ rule, line })
      )
    ).toEqual([
      { rule: 'op-producers-outlive-the-panel', line: 2 },
      { rule: 'op-producers-outlive-the-panel', line: 6 }
    ])
  })

  test('follows the thunk indirection a Vue-hook grep would miss', () => {
    const fixture = `
      onScopeDispose(() => {
        runFollowerTeardown([() => opSender.detach(), () => client.destroy()])
      })
    `
    expect(
      checkOpProducersOutliveThePanel(FOLLOWER_FILE, fixture).map(
        ({ rule, line }) => ({ rule, line })
      )
    ).toEqual([{ rule: 'op-producers-outlive-the-panel', line: 3 }])
  })

  test('catches a producer detached by a named callback handed to an unmount hook', () => {
    const fixture = `
      function releaseProducer() {
        opSender.detach()
      }
      onBeforeUnmount(releaseProducer)
    `
    expect(
      checkOpProducersOutliveThePanel(FOLLOWER_FILE, fixture).map(
        ({ rule, line }) => ({ rule, line })
      )
    ).toEqual([{ rule: 'op-producers-outlive-the-panel', line: 3 }])
  })

  test('catches a producer detach stored inside a named cleanup callback', () => {
    const fixture = `
      function releaseProducer() {
        const result = opSender.detach()
        return result
      }
      onBeforeUnmount(releaseProducer)
    `
    expect(
      checkOpProducersOutliveThePanel(FOLLOWER_FILE, fixture).map(
        ({ rule, line }) => ({ rule, line })
      )
    ).toEqual([{ rule: 'op-producers-outlive-the-panel', line: 3 }])
  })

  test.for([
    {
      name: 'a producer detached by a named arrow handed to a teardown list',
      fixture: `
      const releaseProducer = () => docOpMinter.detach()
      onScopeDispose(() => runFollowerTeardown([releaseProducer]))
    `
    },
    {
      name: 'whitespace before the call parenthesis',
      fixture: `onBeforeUnmount(() => opSender.detach ())`
    },
    {
      name: 'a producer detach handed to a keyed teardown map by reference',
      fixture: `
      onBeforeUnmount(() =>
        runPanelTeardown({ detachDocOpMinter: docOpMinter.detach })
      )
    `
    },
    {
      name: 'a producer detach bound to a name a disposal route is handed',
      fixture: `
      const releaseProducer = opSender.detach
      onBeforeUnmount(releaseProducer)
    `
    },
    {
      name: 'an optional-call detach',
      fixture: `onBeforeUnmount(() => opSender.detach?.())`
    },
    {
      name: 'an aliased factory import',
      fixture: `
      import { attachDocOpMinter as attach } from './crdt/docOpMinter'
      const minter = attach({})
    `
    }
  ])('catches $name', ({ fixture }) => {
    expect(
      checkOpProducersOutliveThePanel(FOLLOWER_FILE, fixture).map(
        ({ rule }) => rule
      )
    ).toEqual(['op-producers-outlive-the-panel'])
  })

  test('follows a panel cleanup through named helpers', () => {
    const fixture = `
      function releaseProducer() {
        opSender.detach()
      }
      function teardown() {
        releaseProducer()
      }
      onBeforeUnmount(teardown)
    `
    expect(
      checkOpProducersOutliveThePanel(FOLLOWER_FILE, fixture).map(
        ({ rule }) => rule
      )
    ).toEqual(['op-producers-outlive-the-panel'])
  })

  test('follows an aliased panel-close hook', () => {
    const fixture = `
      const beforeUnmount = onBeforeUnmount
      const releaseProducer = () => opSender.detach()
      beforeUnmount(releaseProducer)
    `
    expect(
      checkOpProducersOutliveThePanel(FOLLOWER_FILE, fixture).map(
        ({ rule }) => rule
      )
    ).toEqual(['op-producers-outlive-the-panel'])
  })

  test('names the invariant and links the ADR in both halves', () => {
    const fixture = `<script setup lang="ts">
const docOpMinter = attachDocOpMinter({})
onBeforeUnmount(() => docOpMinter.detach())
</script>`
    const violations = checkOpProducersOutliveThePanel(PANEL_FILE, fixture)
    expect(violations).toHaveLength(2)
    for (const violation of violations)
      expect(violation.message).toContain(
        'CRDT-FOLLOWER-0052-the-workflow-document-owns-the-follower-session.md Stage 2'
      )
  })
})

describe('checkOpProducersOutliveThePanel allowed shapes', () => {
  test('passes the producer owner attaching and detaching its own producer', () => {
    const fixture = `
      const attached = attachDocOpMinter({ isEnabled, isDocBound, enqueue })
      export function destroyAgentPageOpMinters(): void {
        attached.detach()
      }
    `
    expect(checkOpProducersOutliveThePanel(OP_PRODUCER_OWNER, fixture)).toEqual(
      []
    )
  })

  test('passes the session owner, whose scope a panel close does not stop', () => {
    const fixture = `
      onScopeDispose(() => {
        runFollowerTeardown([() => opSender.detach(), () => coalescer.detach()])
      })
    `
    expect(
      checkOpProducersOutliveThePanel(FOLLOWER_SESSION_OWNER, fixture)
    ).toEqual([])
  })

  test('passes a component that installs its answers on the page producer', () => {
    const fixture = `<script setup lang="ts">
const docOpMinter = retainDocOpMinterForPage(docTransport, { isEnabled })
watch(connected, () => docOpMinter.deliverHeldRestores())
</script>`
    expect(checkOpProducersOutliveThePanel(PANEL_FILE, fixture)).toEqual([])
  })

  test('passes a producer detach outside any panel-close route', () => {
    const fixture = `
      export function destroyEverything(): void {
        docOpMinter.detach()
      }
    `
    expect(checkOpProducersOutliveThePanel(PANEL_FILE, fixture)).toEqual([])
  })

  test('passes a named cleanup no panel-close route is handed', () => {
    const fixture = `
      function releaseProducer() {
        docOpMinter.detach()
      }
      export function destroyPageSession(): void {
        releaseProducer()
      }
    `
    expect(checkOpProducersOutliveThePanel(FOLLOWER_FILE, fixture)).toEqual([])
  })

  test('does not join same-named helpers from unrelated scopes', () => {
    const fixture = `
      function first() {
        const releaseProducer = () => opSender.detach()
      }
      function second() {
        const releaseProducer = () => notifyReleased()
        onBeforeUnmount(releaseProducer)
      }
    `
    expect(checkOpProducersOutliveThePanel(FOLLOWER_FILE, fixture)).toEqual([])
  })

  test('passes a non-producer detach on a panel-close route', () => {
    const fixture = `<script setup lang="ts">
onBeforeUnmount(() =>
  runPanelTeardown({
    detachAgentWriteOverwriteWatch: () => agentWriteOverwriteWatch.detach()
  })
)
</script>`
    expect(checkOpProducersOutliveThePanel(PANEL_FILE, fixture)).toEqual([])
  })

  test('ignores a factory name that only appears in a string', () => {
    const fixture = "const label = 'attachDocOpMinter'"
    expect(checkOpProducersOutliveThePanel(PANEL_FILE, fixture)).toEqual([])
  })

  test('ignores files outside the agent surface', () => {
    const fixture = 'const m = attachDocOpMinter({})'
    expect(
      checkOpProducersOutliveThePanel('src/scripts/app.ts', fixture)
    ).toEqual([])
  })

  test('fails closed when a .vue script block does not parse', () => {
    const fixture = `<script setup lang="ts">\nconst m = attachDocOpMinter({\n</script>`
    expect(
      checkOpProducersOutliveThePanel(PANEL_FILE, fixture).map(
        ({ rule }) => rule
      )
    ).toContain('syntax-error')
  })
})

describe('agent surface enforcement against this repository', () => {
  test('discovers the agent surface, including .vue components', () => {
    const files = findAgentSurfaceFiles(REPOSITORY_ROOT)
    expect(files).toContain(PANEL_FILE)
    expect(files).toContain(PAGE_SESSION_OWNER)
    expect(files.some((file) => file.endsWith('.test.ts'))).toBe(false)
  })

  test(
    'the agent surface holds the transport-ownership invariant',
    () => {
      expect(checkAgentSurfaceFiles(REPOSITORY_ROOT)).toEqual([])
    },
    REPOSITORY_SCAN_TIMEOUT
  )

  test(
    'the follower seam holds its invariants',
    () => {
      expect(checkFollowerFiles(REPOSITORY_ROOT)).toEqual([])
    },
    REPOSITORY_SCAN_TIMEOUT
  )
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
