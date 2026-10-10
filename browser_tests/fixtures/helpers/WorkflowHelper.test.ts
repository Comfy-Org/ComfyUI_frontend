import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ComfyApp } from '@/scripts/app'
import { hashPath } from '@/platform/workflow/persistence/base/hashUtil'
import { zComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import nativeWorkflow from '@e2e/assets/inputs/native_lora_model.json'
import { workflowDraftReady } from '@e2e/fixtures/helpers/workflowDraftReady'

const path = 'workflows/native-draft-readiness.json'
const pointerKey = 'Comfy.Workflow.ActivePath:draft-readiness-test'
const payloadKey = `Comfy.Workflow.Draft.v2:personal:${hashPath(path)}`
const otherPayloadKey = `Comfy.Workflow.Draft.v2:personal:${hashPath('workflows/other.json')}`

function captureDraftReadiness() {
  const expected = zComfyWorkflow.parse(nativeWorkflow)
  expected.nodes[0].widgets_values = [
    1,
    'native-lora-e2e/A.safetensors',
    1,
    false
  ]
  vi.stubGlobal(
    'app',
    fromPartial<ComfyApp>({
      api: { clientId: 'draft-readiness-test' }
    })
  )
  sessionStorage.setItem(
    pointerKey,
    JSON.stringify({ path, workspaceId: 'personal' })
  )
  return {
    expected,
    isReady: () =>
      workflowDraftReady({ path, draftKey: hashPath(path), expected })
  }
}

describe('workflow draft readiness', () => {
  afterEach(() => {
    sessionStorage.removeItem(pointerKey)
    localStorage.removeItem(payloadKey)
    localStorage.removeItem(otherPayloadKey)
  })

  it('does not accept another workflow draft with the same edited values', () => {
    const { expected, isReady } = captureDraftReadiness()
    localStorage.setItem(
      otherPayloadKey,
      JSON.stringify({ data: JSON.stringify(expected), updatedAt: 100 })
    )

    expect(isReady()).toBe(false)
  })

  it('does not accept a newer draft that still contains the old toggle value', () => {
    const { expected, isReady } = captureDraftReadiness()
    const stale = structuredClone(expected)
    stale.nodes[0].widgets_values = [
      1,
      'native-lora-e2e/A.safetensors',
      1,
      true
    ]
    localStorage.setItem(
      payloadKey,
      JSON.stringify({ data: JSON.stringify(stale), updatedAt: 1000 })
    )

    expect(isReady()).toBe(false)
  })

  it.for(['not json', 'null', '{"data":"not json"}'])(
    'treats malformed payload %s as not persisted',
    (payload) => {
      const { isReady } = captureDraftReadiness()
      localStorage.setItem(payloadKey, payload)

      expect(isReady()).toBe(false)
    }
  )

  it('accepts the edited widget values without requiring identical node geometry', () => {
    const { expected, isReady } = captureDraftReadiness()
    const persisted = structuredClone(expected)
    persisted.nodes[0].pos = [400, 600]
    persisted.nodes[0].size = [450, 700]
    localStorage.setItem(
      payloadKey,
      JSON.stringify({ data: JSON.stringify(persisted), updatedAt: 1 })
    )

    expect(isReady()).toBe(true)
  })
})
