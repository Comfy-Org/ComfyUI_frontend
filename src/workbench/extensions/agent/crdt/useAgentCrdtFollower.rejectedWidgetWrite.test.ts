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

import type { GraphMutations } from './graphMutations'
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

/** Narrows an outbound frame the same way a real host would. */
function mintedOpIds(raw: string): string[] {
  const frame: unknown = JSON.parse(raw)
  const { type, data } =
    typeof frame === 'object' && frame !== null
      ? (frame as { type?: unknown; data?: unknown })
      : {}
  if (type !== 'doc_ops') return []
  const parsed =
    typeof data === 'object' && data !== null
      ? parseWireOps((data as { ops?: unknown }).ops)
      : { ok: false as const, reason: 'invalid_frame' as const }
  return parsed.ok ? parsed.ops.map((op) => op.op_id) : []
}

/** The transport listens on `api`; a server frame is a CustomEvent there. */
function answerWithOpsResult(detail: Record<string, unknown>): void {
  EventTarget.prototype.dispatchEvent.call(
    api,
    new CustomEvent('doc_ops_result', { detail })
  )
}

/**
 * Mounts a follower and returns a submitter. `submit(op)` sends one edit;
 * `submit.batch(ops)` sends several as ONE wire batch, which is what a
 * prefix-applied rejection needs.
 */
function mountFollower() {
  // The telemetry dedupe is per notifier, and each mount makes a new one, so
  // the assertion baseline has to reset with it.
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
        follower = useAgentCrdtFollower(
          ref<string | null>(WORKFLOW_ID),
          fromPartial<GraphMutations>({})
        )
        return () => null
      }
    })
  )
  onTestFinished(unmount)

  async function batch(operations: GraphOperation[]): Promise<string[]> {
    const framesBefore = send.mock.calls.length
    follower.enqueueHumanOperations(operations)
    // The coalescer defers delivery to the end of the tick.
    await vi.waitFor(() =>
      expect(send.mock.calls.length).toBeGreaterThan(framesBefore)
    )
    const ids = send.mock.calls
      .slice(framesBefore)
      .flatMap(([frame]) => mintedOpIds(frame))
    if (ids.length === 0)
      throw new Error('the sender put no wire-shaped doc_ops frame on the wire')
    return ids
  }

  async function submit(operation: GraphOperation): Promise<string> {
    // `batch` throws rather than returning an empty list.
    const [first] = await batch([operation])
    return first
  }

  return Object.assign(submit, { batch })
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

/** The `code` of every telemetry report raised so far, in order. */
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
      const submit = mountFollower()

      answerWithOpsResult(rejection(await submit(WIDGET_EDIT), code))

      expect(toastDetails()).toEqual([
        expect.stringContaining(WIDGET_REJECTION_TEXT)
      ])
    }
  )

  it('raises the notice as a self-dismissing error toast', async () => {
    const submit = mountFollower()

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
    const submit = mountFollower()

    answerWithOpsResult(
      rejection(await submit(NODE_ADD), 'uncatalogued_widget_write')
    )

    expect(toastDetails()).toEqual([
      expect.stringContaining(GENERIC_REJECTION_TEXT)
    ])
  })

  it('falls back to a generic notice for a code that names no widget write', async () => {
    const submit = mountFollower()

    answerWithOpsResult(
      rejection(await submit(WIDGET_EDIT), 'base_version_conflict')
    )

    expect(toastDetails()).toEqual([
      expect.stringContaining(GENERIC_REJECTION_TEXT)
    ])
  })

  it('repeats no notice a rejection already put on screen', async () => {
    const submit = mountFollower()

    answerWithOpsResult(rejection(await submit(WIDGET_EDIT), 'opaque_widgets'))
    answerWithOpsResult(rejection(await submit(WIDGET_EDIT), 'opaque_widgets'))

    expect(toastDetails()).toEqual([
      expect.stringContaining(WIDGET_REJECTION_TEXT)
    ])
  })

  it('still speaks for a rejection of another kind inside that window', async () => {
    const submit = mountFollower()

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
    const submit = mountFollower()
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
  // entry. Read only from `failure`, every one of these collapses to
  // 'unspecified' — and because the telemetry dedupe keys on that, the first
  // would suppress the report for every later kind.
  it('classifies a batch-level refusal that carries no failed entry', async () => {
    const submit = mountFollower()
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
    const submit = mountFollower()

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
  // A REAL two-op batch: the host applies the add and rejects the widget write
  // behind it, so both the op ids and the failure index are the sender's own.
  it('does not claim nothing was saved when a batch applied a prefix', async () => {
    const submit = mountFollower()
    const ids = await submit.batch([NODE_ADD, WIDGET_EDIT])
    // Both must ride ONE frame, or this is not a prefix-applied batch.
    expect(ids).toHaveLength(2)
    const [appliedId, rejectedId] = ids

    answerWithOpsResult({
      v: 1,
      workflow_id: WORKFLOW_ID,
      ok: false,
      applied: [appliedId],
      skipped: [],
      failed: {
        index: 1,
        op_id: rejectedId,
        code: 'opaque_widgets',
        message: 'node is absent from the pinned catalog'
      }
    })

    // Still carries the canonical substring the e2e spec filters on, so the
    // partial variant cannot break that contract.
    expect(toastDetails()).toEqual([
      expect.stringContaining(WIDGET_REJECTION_TEXT)
    ])
    expect(String(toastDetails()[0])).toContain('some earlier edits were')
  })
})
