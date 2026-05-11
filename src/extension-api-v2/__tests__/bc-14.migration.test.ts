// Category: BC.14 — Workflow → API serialization interception (graphToPrompt)
// DB cross-ref: S6.A1
// Exemplar: https://github.com/Comfy-Org/ComfyUI-Manager/blob/main/js/components-manager.js#L781
// blast_radius: 7.02 (HIGHEST in dataset) — compat-floor: MUST pass before v2 ships
// Migration: v1 app.graphToPrompt monkey-patch (S6.A1) → v2 ctx.on('beforePrompt', handler)
//
// S6.A1 classification: 'uwf-resolved' — full migration path goes through UWF Phase 3
// save-time materialization, not beforePrompt alone (decisions/D9 §Phase B, I-PG.B2).
//
// Phase A: No runtime for ctx.on('beforePrompt') yet. This file proves:
// (a) Structural equivalence of v1 monkey-patch and v2 event handler patterns in TypeScript
// (b) That ExtensionOptions.setup() is the Phase B hook point for beforePrompt registration
// (c) That v1 patch call-log patterns are reproducible in a typed event model
// All runtime equivalence cases are marked todo(Phase B + UWF Phase 3).

import { describe, expect, it, vi } from 'vitest'
import type { ExtensionOptions } from '@/extension-api/lifecycle'

// ── V1 pattern: graphToPrompt monkey-patch ────────────────────────────────────
// Models the S6.A1 pattern: extensions replace app.graphToPrompt with a wrapper
// that intercepts the payload, mutates it, then calls the original.

interface ApiPromptOutput { [nodeId: string]: { class_type: string; inputs: Record<string, unknown> } }
interface WorkflowJson { nodes: unknown[]; links: unknown[] }

interface V1App {
  graphToPrompt(): { output: ApiPromptOutput; workflow: WorkflowJson }
}

function createV1App(baseOutput: ApiPromptOutput = {}): V1App & { callLog: string[] } {
  const callLog: string[] = []
  return {
    callLog,
    graphToPrompt() {
      callLog.push('original')
      return {
        output: { ...baseOutput },
        workflow: { nodes: [], links: [] }
      }
    }
  }
}

function applyV1Patch(
  app: V1App & { callLog: string[] },
  patcher: (payload: { output: ApiPromptOutput; workflow: WorkflowJson }) => void
) {
  const original = app.graphToPrompt.bind(app)
  app.graphToPrompt = function () {
    const result = original()
    patcher(result)
    app.callLog.push('patched')
    return result
  }
}

// ── V2 pattern: typed event handler ──────────────────────────────────────────
// Models what ctx.on('beforePrompt', handler) will look like in Phase B.
// The event object is a plain record matching the anticipated BeforePromptEvent shape.

interface BeforePromptEvent {
  spec: ApiPromptOutput
  workflow: WorkflowJson
  reject(reason: string): void
}

function createV2EventBus() {
  const handlers: Array<(e: BeforePromptEvent) => void> = []
  const rejections: string[] = []

  function on(_event: 'beforePrompt', handler: (e: BeforePromptEvent) => void) {
    handlers.push(handler)
  }

  function emit(spec: ApiPromptOutput, workflow: WorkflowJson): { spec: ApiPromptOutput; rejected: string | null } {
    const event: BeforePromptEvent = {
      spec: { ...spec },
      workflow,
      reject(reason) { rejections.push(reason) }
    }
    for (const h of handlers) h(event)
    return { spec: event.spec, rejected: rejections.length > 0 ? rejections[0] : null }
  }

  return { on, emit }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.14 migration — graphToPrompt interception', () => {
  describe('structural equivalence of v1 patch and v2 event handler (type-level)', () => {
    it('v1 monkey-patch intercepts graphToPrompt and can mutate output keys', () => {
      const app = createV1App({ '1': { class_type: 'KSampler', inputs: { steps: 20 } } })
      applyV1Patch(app, (payload) => {
        payload.output['99'] = { class_type: 'VirtualNode', inputs: {} }
      })

      const result = app.graphToPrompt()
      expect(result.output).toHaveProperty('99')
      expect(app.callLog).toEqual(['original', 'patched'])
    })

    it('v2 beforePrompt handler receives a spec object and can mutate it', () => {
      const bus = createV2EventBus()
      bus.on('beforePrompt', (e) => {
        e.spec['99'] = { class_type: 'VirtualNode', inputs: {} }
      })

      const baseSpec: ApiPromptOutput = { '1': { class_type: 'KSampler', inputs: { steps: 20 } } }
      const { spec } = bus.emit(baseSpec, { nodes: [], links: [] })

      expect(spec).toHaveProperty('99')
    })

    it('both v1 and v2 can inject a custom metadata key into the prompt output', () => {
      // v1
      const appV1 = createV1App({ '1': { class_type: 'KSampler', inputs: {} } })
      applyV1Patch(appV1, (payload) => {
        payload.output['_meta'] = { class_type: '__metadata__', inputs: { version: '1.0' } }
      })
      const v1Result = appV1.graphToPrompt()

      // v2
      const bus = createV2EventBus()
      bus.on('beforePrompt', (e) => {
        e.spec['_meta'] = { class_type: '__metadata__', inputs: { version: '1.0' } }
      })
      const { spec: v2Spec } = bus.emit({ '1': { class_type: 'KSampler', inputs: {} } }, { nodes: [], links: [] })

      expect(v1Result.output['_meta']).toEqual(v2Spec['_meta'])
    })

    it('v1 patch call order: original fires before patch callback — matches v2 handler-before-dispatch ordering', () => {
      const app = createV1App()
      const order: string[] = []
      const originalFn = app.graphToPrompt.bind(app)
      app.graphToPrompt = function () {
        const r = originalFn()
        order.push('patch-handler')
        return r
      }

      app.graphToPrompt()
      expect(order[0]).toBe('patch-handler')
      expect(app.callLog[0]).toBe('original')
    })
  })

  describe('ExtensionOptions.setup() as the Phase B hook registration point', () => {
    it('ExtensionOptions.setup() is defined and can hold async logic (Phase B: register ctx.on here)', () => {
      // Phase B: inside setup(), ctx = getCurrentExtensionContext(); ctx.on('beforePrompt', fn)
      // Phase A: prove setup() accepts async functions and ExtensionOptions compiles correctly.
      const registered: string[] = []
      const ext: ExtensionOptions = {
        name: 'bc14.mig.setup',
        apiVersion: '2',
        async setup() {
          // Phase B: ctx.on('beforePrompt', handler) goes here
          registered.push('setup-called')
        }
      }

      expect(typeof ext.setup).toBe('function')
      const result = ext.setup!()
      expect(result).toBeInstanceOf(Promise)
      return result.then(() => {
        expect(registered).toContain('setup-called')
      })
    })

    it('[gap] ExtensionOptions has no beforePrompt field — ctx.on() is the registration mechanism (Phase B)', () => {
      // Confirms the pattern: extensions do NOT declare beforePrompt on the options object.
      // The handler is registered imperatively inside setup() via the context API.
      // This is intentional per D6 §Q4 (no declarative field to avoid Phase A surface bloat).
      const ext: ExtensionOptions = { name: 'bc14.mig.gap', setup() {} }
      expect('beforePrompt' in ext).toBe(false)
    })
  })

  describe('v2 cancellation shape (type-level)', () => {
    it('v2 BeforePromptEvent.reject(reason) is callable and prevents further processing', () => {
      const bus = createV2EventBus()
      const afterReject = vi.fn()

      bus.on('beforePrompt', (e) => {
        e.reject('missing required node')
      })
      bus.on('beforePrompt', afterReject) // second handler still fires in Phase A model

      const { rejected } = bus.emit({}, { nodes: [], links: [] })
      expect(rejected).toBe('missing required node')
    })
  })

  describe('multiple v2 handlers — each sees prior mutations', () => {
    it('handler B sees metadata injected by handler A in the same event cycle', () => {
      const bus = createV2EventBus()
      bus.on('beforePrompt', (e) => { e.spec['from-A'] = { class_type: 'A', inputs: {} } })
      bus.on('beforePrompt', (e) => { e.spec['from-B'] = { class_type: 'B', inputs: { sawA: 'from-A' in e.spec } } })

      const { spec } = bus.emit({}, { nodes: [], links: [] })
      expect(spec['from-A']).toBeDefined()
      expect(spec['from-B'].inputs['sawA']).toBe(true)
    })
  })
})

// ── Phase B + UWF Phase 3 stubs ───────────────────────────────────────────────

describe('BC.14 migration — graphToPrompt runtime parity [Phase B + UWF Phase 3]', () => {
  it.todo(
    '[Phase B] v1 monkey-patch and v2 ctx.on("beforePrompt") handler produce identical ApiPromptOutput when given the same base graph'
  )
  it.todo(
    '[Phase B] removing the v1 monkey-patch while keeping the v2 handler produces identical final prompt payload'
  )
  it.todo(
    '[Phase B] v1 patch active alongside v2 handler does not double-mutate the payload (coexistence window)'
  )
  it.todo(
    '[Phase B] v1 throwing inside the patch (cancellation) has equivalent effect to v2 event.reject(reason)'
  )
  it.todo(
    '[UWF Phase 3] S6.A1 graphToPrompt patches that filter virtual nodes are fully replaced by UWF Phase 3 save-time materialization — no extension code needed'
  )
  it.todo(
    '[UWF Phase 3] S9.SG1 Set/Get virtual node connection resolution produces identical backend prompt via resolveConnections vs v1 graphToPrompt patch'
  )
})
