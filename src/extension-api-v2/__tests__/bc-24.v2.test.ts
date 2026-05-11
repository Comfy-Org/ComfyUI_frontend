/**
 * BC.24 — Node-def schema inspection [v2 contract]
 *
 * Pattern: S13.SC1 — branch on ComfyNodeDef shape to drive UI decisions.
 *
 * V2 contract: extensions receive a ComfyNodeDef object (from nodeDefStore /
 * app.nodeOutputTypes) and branch on its typed fields:
 *   nodeData.input.required    — Record<string, [type, options?][]>
 *   nodeData.input.optional    — same shape, optional inputs
 *   nodeData.output            — string[] of output slot types
 *   nodeData.output_node       — boolean (node produces output for display)
 *   nodeData.category          — string dot-path (e.g. "loaders/checkpoints")
 *
 * Extensions do NOT reach into raw LiteGraph type registries; they use the
 * typed nodeData object from the extension context.
 *
 * Phase A: tests assert inspection logic using literal nodeData fixtures.
 * Phase B upgrade: hydrate with loadEvidenceSnippet() once eval sandbox lands.
 *
 * DB cross-ref: S13.SC1
 */
import { describe, it, expect } from 'vitest'

import { loadEvidenceSnippet, runV1, runV2 } from '@/extension-api-v2/harness'

void [loadEvidenceSnippet, runV1, runV2]

// ─── Minimal ComfyNodeDef fixture shape ──────────────────────────────────────
// Uses only the fields BC.24 patterns branch on.

interface MinimalInputSpec {
  required?: Record<string, unknown[]>
  optional?: Record<string, unknown[]>
  hidden?: Record<string, unknown[]>
}

interface MinimalNodeDef {
  name: string
  display_name?: string
  category?: string
  output?: string[]
  output_node?: boolean
  input: MinimalInputSpec
}

function makeNodeDef(overrides: Partial<MinimalNodeDef> = {}): MinimalNodeDef {
  return {
    name: 'TestNode',
    category: 'test',
    output: [],
    output_node: false,
    input: { required: {}, optional: {} },
    ...overrides,
  }
}

// ─── Helper that mirrors the v2 extension pattern ────────────────────────────
// Extensions inspect nodeData fields directly — no helper function needed in v2
// because the type is structured. These helpers are test utilities, not API.

function hasRequiredInput(nodeData: MinimalNodeDef, name: string): boolean {
  return name in (nodeData.input.required ?? {})
}

function isOutputNode(nodeData: MinimalNodeDef): boolean {
  return nodeData.output_node === true
}

function getOutputTypes(nodeData: MinimalNodeDef): string[] {
  return nodeData.output ?? []
}

function nodeCategory(nodeData: MinimalNodeDef): string {
  return nodeData.category ?? ''
}

// ─── S13.SC1 — branch on ComfyNodeDef shape ──────────────────────────────────

describe('BC.24 — Node-def schema inspection [v2 contract]', () => {
  it('S13.SC1 — input.required lookup returns true for present key', () => {
    const nodeData = makeNodeDef({
      input: { required: { ckpt_name: [['MODEL'], {}] } },
    })
    expect(hasRequiredInput(nodeData, 'ckpt_name')).toBe(true)
  })

  it('S13.SC1 — input.required lookup returns false for absent key', () => {
    const nodeData = makeNodeDef({
      input: { required: { ckpt_name: [['MODEL'], {}] } },
    })
    expect(hasRequiredInput(nodeData, 'nonexistent')).toBe(false)
  })

  it('S13.SC1 — output_node: true identifies display-output nodes', () => {
    const saveNode = makeNodeDef({ output_node: true })
    const passNode = makeNodeDef({ output_node: false })
    expect(isOutputNode(saveNode)).toBe(true)
    expect(isOutputNode(passNode)).toBe(false)
  })

  it('S13.SC1 — output array carries slot type strings', () => {
    const nodeData = makeNodeDef({ output: ['MODEL', 'CLIP', 'VAE'] })
    expect(getOutputTypes(nodeData)).toEqual(['MODEL', 'CLIP', 'VAE'])
  })

  it('S13.SC1 — empty output node has empty output array', () => {
    const nodeData = makeNodeDef({ output: [] })
    expect(getOutputTypes(nodeData)).toHaveLength(0)
  })

  it('S13.SC1 — category is a dot-separated path string', () => {
    const nodeData = makeNodeDef({ category: 'loaders/checkpoints' })
    expect(nodeCategory(nodeData)).toBe('loaders/checkpoints')
  })

  it('S13.SC1 — optional inputs are separate from required', () => {
    const nodeData = makeNodeDef({
      input: {
        required: { model: [['MODEL']] },
        optional: { lora: [['LORA']] },
      },
    })
    expect(hasRequiredInput(nodeData, 'model')).toBe(true)
    // optional inputs are not in required — extension must check separately
    expect(hasRequiredInput(nodeData, 'lora')).toBe(false)
    expect('lora' in (nodeData.input.optional ?? {})).toBe(true)
  })

  it('S13.SC1 — node with no inputs has empty required and optional', () => {
    const nodeData = makeNodeDef({ input: {} })
    expect(nodeData.input.required).toBeUndefined()
    expect(nodeData.input.optional).toBeUndefined()
  })
})
