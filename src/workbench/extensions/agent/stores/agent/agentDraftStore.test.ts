import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type {
  AgentDraftSnapshot,
  DraftPatchData,
  DraftVersionData
} from '../../schemas/agentApiSchema'

import { useAgentDraftStore } from './agentDraftStore'

const WORKFLOW = 'a81718a4-02ae-41e6-ae85-c33b7bb880f6'
const OTHER_WORKFLOW = 'b90000a0-0000-0000-0000-000000000000'

function graphAt(cfg: number): Record<string, unknown> {
  return {
    last_node_id: 1,
    links: [],
    nodes: [
      {
        id: 1,
        type: 'KSampler',
        widgets_values: [0, 'fixed', 12, cfg, 'euler', 'normal', 1]
      }
    ]
  }
}

function patch(
  version: number,
  baseVersion: number,
  workflow_id = WORKFLOW
): DraftPatchData {
  return {
    base_version: baseVersion,
    version,
    content: graphAt(version),
    workflow_id
  }
}

function heartbeat(version: number, workflow_id = WORKFLOW): DraftVersionData {
  return { version, workflow_id }
}

function snapshot(version: number): AgentDraftSnapshot {
  return { content: graphAt(version), version }
}

describe('useAgentDraftStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('applyPatch monotonic adoption', () => {
    it('adopts increasing versions 24 -> 25 -> 26 (base_version gap tolerated)', () => {
      const store = useAgentDraftStore()
      store.bind(WORKFLOW)
      store.adoptSnapshot(snapshot(24))

      expect(store.applyPatch(patch(25, 24))).toBe(true)
      expect(store.version).toBe(25)

      expect(store.applyPatch(patch(27, 26))).toBe(true)
      expect(store.version).toBe(27)
      expect(store.content).toEqual(graphAt(27))
    })

    it('adopts the first patch when unversioned but bound', () => {
      const store = useAgentDraftStore()
      store.bind(WORKFLOW)
      expect(store.version).toBeNull()
      expect(store.applyPatch(patch(25, 24))).toBe(true)
      expect(store.version).toBe(25)
      expect(store.content).toEqual(graphAt(25))
    })

    it('ignores a duplicate version (same version re-sent)', () => {
      const store = useAgentDraftStore()
      store.bind(WORKFLOW)
      store.applyPatch(patch(25, 24))
      expect(store.applyPatch(patch(25, 24))).toBe(false)
      expect(store.version).toBe(25)
      expect(store.content).toEqual(graphAt(25))
    })

    it('ignores a lower version (stale patch)', () => {
      const store = useAgentDraftStore()
      store.bind(WORKFLOW)
      store.applyPatch(patch(26, 25))
      expect(store.applyPatch(patch(25, 24))).toBe(false)
      expect(store.version).toBe(26)
      expect(store.content).toEqual(graphAt(26))
    })

    it('ignores a foreign workflow_id and does not mutate state', () => {
      const store = useAgentDraftStore()
      store.bind(WORKFLOW)
      store.applyPatch(patch(25, 24))
      expect(store.applyPatch(patch(26, 25, OTHER_WORKFLOW))).toBe(false)
      expect(store.version).toBe(25)
      expect(store.content).toEqual(graphAt(25))
    })

    it('ignores every patch while unbound', () => {
      const store = useAgentDraftStore()
      expect(store.applyPatch(patch(25, 24))).toBe(false)
      expect(store.content).toBeNull()
      expect(store.version).toBeNull()
    })
  })

  describe('bind', () => {
    it('clears content/version when binding a different workflow', () => {
      const store = useAgentDraftStore()
      store.bind(WORKFLOW)
      store.applyPatch(patch(25, 24))
      expect(store.content).toEqual(graphAt(25))

      store.bind(OTHER_WORKFLOW)
      expect(store.workflowId).toBe(OTHER_WORKFLOW)
      expect(store.content).toBeNull()
      expect(store.version).toBeNull()
    })

    it('re-binding the same workflow preserves state', () => {
      const store = useAgentDraftStore()
      store.bind(WORKFLOW)
      store.applyPatch(patch(25, 24))
      store.bind(WORKFLOW)
      expect(store.version).toBe(25)
      expect(store.content).toEqual(graphAt(25))
    })
  })

  describe('checkHeartbeat', () => {
    it('is foreign when unbound', () => {
      const store = useAgentDraftStore()
      expect(store.checkHeartbeat(heartbeat(24))).toBe('foreign')
    })

    it('is foreign when the workflow mismatches', () => {
      const store = useAgentDraftStore()
      store.bind(WORKFLOW)
      expect(store.checkHeartbeat(heartbeat(24, OTHER_WORKFLOW))).toBe(
        'foreign'
      )
    })

    it('is behind when we hold no version yet', () => {
      const store = useAgentDraftStore()
      store.bind(WORKFLOW)
      expect(store.checkHeartbeat(heartbeat(24))).toBe('behind')
    })

    it('is behind when the server is ahead', () => {
      const store = useAgentDraftStore()
      store.bind(WORKFLOW)
      store.applyPatch(patch(25, 24))
      expect(store.checkHeartbeat(heartbeat(26))).toBe('behind')
    })

    it('is in-sync at the same version', () => {
      const store = useAgentDraftStore()
      store.bind(WORKFLOW)
      store.applyPatch(patch(26, 25))
      expect(store.checkHeartbeat(heartbeat(26))).toBe('in-sync')
    })

    it('is in-sync when the heartbeat trails our version', () => {
      const store = useAgentDraftStore()
      store.bind(WORKFLOW)
      store.applyPatch(patch(26, 25))
      expect(store.checkHeartbeat(heartbeat(24))).toBe('in-sync')
    })
  })

  describe('adoptSnapshot', () => {
    it('adopts onto an empty store', () => {
      const store = useAgentDraftStore()
      store.bind(WORKFLOW)
      store.adoptSnapshot(snapshot(24))
      expect(store.version).toBe(24)
      expect(store.content).toEqual(graphAt(24))
    })

    it('re-adopts at an equal version (idempotent refresh)', () => {
      const store = useAgentDraftStore()
      store.bind(WORKFLOW)
      store.adoptSnapshot(snapshot(25))
      store.adoptSnapshot(snapshot(25))
      expect(store.version).toBe(25)
      expect(store.content).toEqual(graphAt(25))
    })

    it('ignores an older snapshot', () => {
      const store = useAgentDraftStore()
      store.bind(WORKFLOW)
      store.adoptSnapshot(snapshot(26))
      store.adoptSnapshot(snapshot(24))
      expect(store.version).toBe(26)
      expect(store.content).toEqual(graphAt(26))
    })
  })

  describe('reset', () => {
    it('clears all three refs', () => {
      const store = useAgentDraftStore()
      store.bind(WORKFLOW)
      store.applyPatch(patch(25, 24))
      store.reset()
      expect(store.workflowId).toBeNull()
      expect(store.content).toBeNull()
      expect(store.version).toBeNull()
    })
  })
})
