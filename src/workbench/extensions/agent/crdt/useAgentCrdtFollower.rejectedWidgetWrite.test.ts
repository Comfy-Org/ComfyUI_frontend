import { fromPartial } from '@total-typescript/shoehorn'
import { render } from '@testing-library/vue'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { defineComponent, ref } from 'vue'

import { i18n } from '@/i18n'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { api } from '@/scripts/api'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { parseWireOps } from '@e2e/fixtures/agentWireFrame'

import type { GraphOperation } from './graphOperations'
import { useAgentCrdtFollower } from './useAgentCrdtFollower'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

const WORKFLOW_ID = 'wf-rejected-widget-write'

/**
 * The exact text `agentDuplicateInsertOpaqueWidgetWrite.spec.ts` filters the
 * error toast on; the e2e contract breaks if this wording drifts.
 */
const GENERIC_REJECTION_TEXT = 'Your edit was rejected and was not saved'
const WIDGET_REJECTION_TEXT = 'Widget edit was rejected and was not saved'

const WIDGET_EDIT: GraphOperation = {
  op: 'set_widget',
  node_id: 3,
  widget: 'seed',
  value: 222_222
}

const NODE_ADD: GraphOperation = {
  op: 'add_node',
  node_id: 7,
  class_type: 'Note',
  pos: [400, 400],
  node: {
    id: 7,
    type: 'Note',
    pos: [400, 400],
    size: [300, 200],
    inputs: [],
    outputs: [],
    widgets_values: { text: 'keep me' }
  }
}

const NODE_DELETE: GraphOperation = {
  op: 'delete_node',
  node_id: 9,
  removed_links: []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function mintedOpIds(raw: string): string[] {
  const frame: unknown = JSON.parse(raw)
  if (!isRecord(frame) || !('type' in frame) || frame['type'] !== 'doc_ops')
    return []
  if (!('data' in frame) || !isRecord(frame['data'])) return []
  const data = frame['data']
  if (!('ops' in data)) return []
  const parsed = parseWireOps(data['ops'])
  return parsed.ok ? parsed.ops.map((op) => op.op_id) : []
}

/** Every `doc_ops` frame among the raw frames, as its list of minted op ids. */
function docOpsFrames(raw: string[]): string[][] {
  return raw.map(mintedOpIds).filter((ids) => ids.length > 0)
}

/** The transport listens on `api`; a server frame is a CustomEvent there. */
function answerWithOpsResult(detail: Record<string, unknown>): void {
  EventTarget.prototype.dispatchEvent.call(
    api,
    new CustomEvent('doc_ops_result', { detail })
  )
}

/**
 * Mounts a follower. `submitBatch` returns ONE entry per `doc_ops` frame the
 * sender emitted, so a caller can require that its operations rode a single
 * frame rather than inferring it from an id count.
 */
function mountFollower() {
  // The telemetry dedupe is per notifier and each mount makes a new one.
  vi.mocked(reportError).mockClear()
  const previousSocket = api.socket
  const send = vi.fn<(frame: string) => void>()
  api.socket = fromPartial<WebSocket>({ readyState: WebSocket.OPEN, send })
  onTestFinished(() => {
    api.socket = previousSocket
  })
  const store = useAgentPanelStore()
  store.enabled = true
  onTestFinished(() => {
    store.enabled = false
  })

  let follower!: ReturnType<typeof useAgentCrdtFollower>
  const { unmount } = render(
    defineComponent({
      setup() {
        follower = useAgentCrdtFollower(ref<string | null>(WORKFLOW_ID))
        return () => null
      }
    })
  )
  onTestFinished(unmount)

  async function submitBatch(
    operations: GraphOperation[]
  ): Promise<string[][]> {
    const framesBefore = send.mock.calls.length
    follower.enqueueHumanOperations(operations)
    // The coalescer defers delivery to the end of the tick.
    await vi.waitFor(() =>
      expect(send.mock.calls.length).toBeGreaterThan(framesBefore)
    )
    const frames = docOpsFrames(
      send.mock.calls.slice(framesBefore).map(([frame]) => frame)
    )
    if (frames.length === 0)
      throw new Error('the sender put no wire-shaped doc_ops frame on the wire')
    return frames
  }

  async function submit(operation: GraphOperation): Promise<string> {
    const [[first]] = await submitBatch([operation])
    return first
  }

  return { submit, submitBatch }
}

function rejection(opId: string, code: string): Record<string, unknown> {
  return {
    v: 1,
    workflow_id: WORKFLOW_ID,
    ok: false,
    applied: [],
    skipped: [],
    failed: {
      index: 0,
      op_id: opId,
      code,
      message: `node is absent from the pinned catalog (${code})`
    }
  }
}

function toastDetails(): unknown[] {
  return useToastStore().messagesToAdd.map((message) => message.detail)
}

/**
 * A batch-level refusal — `overloaded`, `catalog_mismatch` — which the host
 * sends with a top-level `code` and NO `failed` entry at all.
 */
function batchRefusal(code: string): Record<string, unknown> {
  return {
    v: 1,
    workflow_id: WORKFLOW_ID,
    ok: false,
    applied: [],
    skipped: [],
    code,
    message: `the host refused the batch (${code})`
  }
}

function reportedCodes(): unknown[] {
  return vi
    .mocked(reportError)
    .mock.calls.map(([, options]) => options.context?.['code'])
}

describe('a human edit the doc host rejects', () => {
  // Every widget-write code in the applier's vocabulary, matched on `code`,
  // never on `message` (`@comfyorg/comfy-multi-player`).
  it.for([
    'opaque_widgets',
    'uncatalogued_widget_write',
    'unknown_widget',
    'widget_out_of_range'
  ])(
    'tells the user their widget edit was not saved when the host answers %s',
    async (code) => {
      const { submit } = mountFollower()

      answerWithOpsResult(rejection(await submit(WIDGET_EDIT), code))

      expect(toastDetails()).toEqual([
        expect.stringContaining(WIDGET_REJECTION_TEXT)
      ])
    }
  )

  // `op_id` is optional on the wire — the relay omits it when it cannot map
  // the failing index. Resolving by index is the only path left, and a first-
  // or last-position implementation would misclassify this as generic.
  it('identifies the rejected op by index when the host sends no op_id', async () => {
    const { submitBatch } = mountFollower()
    const frames = await submitBatch([NODE_ADD, WIDGET_EDIT, NODE_DELETE])
    expect(frames).toHaveLength(1)
    const [[appliedId]] = frames

    answerWithOpsResult({
      v: 1,
      workflow_id: WORKFLOW_ID,
      ok: false,
      applied: [appliedId],
      skipped: [],
      failed: {
        index: 1,
        code: 'opaque_widgets',
        message: 'node is absent from the pinned catalog'
      }
    })

    expect(toastDetails()).toEqual([
      expect.stringContaining(WIDGET_REJECTION_TEXT)
    ])
  })

  // A deliberately non-conforming frame. The relay derives `index` and
  // `op_id` from one position and omits `op_id` rather than mis-state it, so
  // real traffic never disagrees; preferring the minted id over a
  // host-supplied position is defence in depth at the trust boundary. Every
  // other fixture agrees on both or sends no `op_id`, so without this one an
  // index-only lookup satisfies them all.
  it('prefers the minted op_id over a disagreeing index', async () => {
    const { submitBatch } = mountFollower()
    const frames = await submitBatch([NODE_ADD, WIDGET_EDIT, NODE_DELETE])
    expect(frames).toHaveLength(1)
    const [[, widgetOpId]] = frames
    expect(widgetOpId).toBeDefined()

    answerWithOpsResult({
      v: 1,
      workflow_id: WORKFLOW_ID,
      ok: false,
      applied: [],
      skipped: [],
      failed: {
        index: 2,
        op_id: widgetOpId,
        code: 'opaque_widgets',
        message: 'node is absent from the pinned catalog'
      }
    })

    expect(toastDetails()).toEqual([
      expect.stringContaining(WIDGET_REJECTION_TEXT)
    ])
  })

  it('raises the notice as a self-dismissing error toast', async () => {
    const { submit } = mountFollower()

    answerWithOpsResult(rejection(await submit(WIDGET_EDIT), 'opaque_widgets'))

    expect(useToastStore().messagesToAdd).toEqual([
      {
        severity: 'error',
        summary: i18n.global.t('g.error'),
        detail: expect.stringContaining(WIDGET_REJECTION_TEXT),
        life: expect.any(Number)
      }
    ])
  })

  // The applier raises this code for `add_node` too, and a node the host never
  // added has no widget value left on screen to warn about.
  it('does not blame a widget when the rejected op added a node', async () => {
    const { submit } = mountFollower()

    answerWithOpsResult(
      rejection(await submit(NODE_ADD), 'uncatalogued_widget_write')
    )

    expect(toastDetails()).toEqual([
      expect.stringContaining(GENERIC_REJECTION_TEXT)
    ])
  })

  it('falls back to a generic notice for a code that names no widget write', async () => {
    const { submit } = mountFollower()

    answerWithOpsResult(
      rejection(await submit(WIDGET_EDIT), 'base_version_conflict')
    )

    expect(toastDetails()).toEqual([
      expect.stringContaining(GENERIC_REJECTION_TEXT)
    ])
  })

  it('repeats no notice a rejection already put on screen', async () => {
    const { submit } = mountFollower()

    answerWithOpsResult(rejection(await submit(WIDGET_EDIT), 'opaque_widgets'))
    answerWithOpsResult(rejection(await submit(WIDGET_EDIT), 'opaque_widgets'))

    expect(toastDetails()).toEqual([
      expect.stringContaining(WIDGET_REJECTION_TEXT)
    ])
  })

  // A permanent seen-message set would pass the suppression test above and
  // then silence every later rejection for the follower's lifetime.
  it('speaks again once the throttle window has passed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    onTestFinished(() => {
      vi.useRealTimers()
    })
    const { submit } = mountFollower()

    answerWithOpsResult(rejection(await submit(WIDGET_EDIT), 'opaque_widgets'))
    await vi.advanceTimersByTimeAsync(10_001)
    answerWithOpsResult(rejection(await submit(WIDGET_EDIT), 'opaque_widgets'))

    expect(toastDetails()).toEqual([
      expect.stringContaining(WIDGET_REJECTION_TEXT),
      expect.stringContaining(WIDGET_REJECTION_TEXT)
    ])
  })

  it('still speaks for a rejection of another kind inside that window', async () => {
    const { submit } = mountFollower()

    answerWithOpsResult(rejection(await submit(WIDGET_EDIT), 'opaque_widgets'))
    answerWithOpsResult(
      rejection(await submit(WIDGET_EDIT), 'base_version_conflict')
    )

    expect(toastDetails()).toEqual([
      expect.stringContaining(WIDGET_REJECTION_TEXT),
      expect.stringContaining(GENERIC_REJECTION_TEXT)
    ])
  })

  it('stays silent when the host applies the edit', async () => {
    const { submit } = mountFollower()
    const opId = await submit(WIDGET_EDIT)

    answerWithOpsResult({
      v: 1,
      workflow_id: WORKFLOW_ID,
      ok: true,
      applied: [opId],
      skipped: []
    })

    expect(useToastStore().messagesToAdd).toEqual([])
  })

  // The host refuses a whole batch with a top-level `code` and no `failed`
  // entry. Read only from `failed`, every one of these collapses to
  // 'unspecified' — and because the telemetry dedupe keys on that, the first
  // would suppress the report for every later kind.
  it('classifies a batch-level refusal that carries no failed entry', async () => {
    const { submit } = mountFollower()
    await submit(WIDGET_EDIT)

    answerWithOpsResult(batchRefusal('catalog_mismatch'))

    expect(toastDetails()).toEqual([
      expect.stringContaining(GENERIC_REJECTION_TEXT)
    ])
    expect(reportedCodes()).toEqual(['catalog_mismatch'])
  })

  // Asserted on telemetry rather than toasts: every generic notice renders the
  // same string, so they share one throttle key and the second is swallowed on
  // screen even though it is a different failure.
  it('reports each distinct batch-level code once', async () => {
    const { submit } = mountFollower()

    // One pending batch per answer: the notifier runs when a batch SETTLES, so
    // a result with nothing outstanding settles nothing and reports nothing.
    await submit(WIDGET_EDIT)
    answerWithOpsResult(batchRefusal('overloaded'))
    await submit(WIDGET_EDIT)
    answerWithOpsResult(batchRefusal('overloaded'))
    await submit(WIDGET_EDIT)
    answerWithOpsResult(batchRefusal('catalog_mismatch'))

    expect(reportedCodes()).toEqual(['overloaded', 'catalog_mismatch'])
  })

  // Schema §4 aborts the remainder of a batch, so the prefix is still applied.
  // Both partial branches are user-facing copy, so both are exercised: a wrong
  // key on either would tell the user nothing was saved after a batch that
  // saved a prefix. The rejected op's KIND picks the branch, so the two rows
  // differ only in which op the host rejects.
  it.for([
    {
      branch: 'widget',
      ops: [NODE_ADD, WIDGET_EDIT],
      code: 'opaque_widgets',
      expected: WIDGET_REJECTION_TEXT
    },
    {
      branch: 'generic',
      ops: [WIDGET_EDIT, NODE_ADD],
      code: 'uncatalogued_widget_write',
      expected: GENERIC_REJECTION_TEXT
    }
  ])(
    'does not claim nothing was saved when a batch applied a prefix ($branch)',
    async ({ ops, code, expected }) => {
      const { submitBatch } = mountFollower()
      const frames = await submitBatch(ops)
      // EXACTLY one frame carrying BOTH ops: across two frames the host could
      // never answer with one applied id and one failure index.
      expect(frames).toHaveLength(1)
      const [[appliedId, rejectedId]] = frames
      expect(rejectedId).toBeDefined()

      answerWithOpsResult({
        v: 1,
        workflow_id: WORKFLOW_ID,
        ok: false,
        applied: [appliedId],
        skipped: [],
        failed: {
          index: 1,
          op_id: rejectedId,
          code,
          message: 'node is absent from the pinned catalog'
        }
      })

      // Still carries the canonical substring the e2e spec filters on, so the
      // partial variant cannot break that contract.
      expect(toastDetails()).toEqual([expect.stringContaining(expected)])
      expect(String(toastDetails()[0])).toContain('some earlier edits were')
    }
  )
})
