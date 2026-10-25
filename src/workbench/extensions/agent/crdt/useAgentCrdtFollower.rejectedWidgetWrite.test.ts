import { render, screen } from '@testing-library/vue'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'

import Toaster from '@/components/ui/toast/Toaster.vue'
import { useToast } from '@/components/ui/toast/toastStore'
import { i18n } from '@/i18n'
import { reportError } from '@/platform/telemetry/reportError'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { parseWireOps } from '@e2e/fixtures/agentWireFrame'

import type { GraphOperation } from './graphOperations'
import { createFakeAgentSocket } from './__fixtures__/agentSocket'
import { useAgentCrdtFollower } from './useAgentCrdtFollower'

vi.mock(import('@/platform/telemetry/reportError'))

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

const PUNCTUATED_WIDGET_EDIT: GraphOperation = {
  ...WIDGET_EDIT,
  widget: "Width/Height & 'x'"
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

const WORKFLOW_CLEAR: GraphOperation = { op: 'clear', removed_nodes: [9] }

const NODE_DELETE: GraphOperation = {
  op: 'delete_node',
  node_id: 9,
  removed_links: []
}

const PUNCTUATED_NODE_DELETE: GraphOperation = {
  ...NODE_DELETE,
  node_id: 'node & <nine>'
}

const PUNCTUATED_LINK_CONNECT: GraphOperation = {
  op: 'connect',
  link_id: 'link & <nine>',
  from_node: 1,
  from_slot: 0,
  to_node: 2,
  to_slot: 0,
  link_type: '*'
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

let agentSocket = createFakeAgentSocket()

function answerWithOpsResult(detail: Record<string, unknown>): void {
  agentSocket.receive('doc_ops_result', detail)
}

/**
 * Mounts a follower. `submitBatch` returns ONE entry per `doc_ops` frame the
 * sender emitted, so a caller can require that its operations rode a single
 * frame rather than inferring it from an id count.
 */
function mountFollower() {
  // The telemetry dedupe is per notifier and each mount makes a new one.
  vi.mocked(reportError).mockClear()
  agentSocket = createFakeAgentSocket()
  const { send } = agentSocket
  const store = useAgentPanelStore()
  store.enabled = true
  onTestFinished(() => {
    store.enabled = false
  })

  let follower!: ReturnType<typeof useAgentCrdtFollower>
  const { unmount } = render(
    defineComponent({
      setup() {
        follower = useAgentCrdtFollower(ref<string | null>(WORKFLOW_ID), {
          transport: agentSocket.transport
        })
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

  return { submit, submitBatch, follower }
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

function toastDescriptions(): (string | undefined)[] {
  return useToast().toasts.map((toast) => toast.description)
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

      expect(toastDescriptions()).toEqual([
        expect.stringContaining(WIDGET_REJECTION_TEXT)
      ])
      expect(reportError).toHaveBeenCalledExactlyOnceWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'error_applying_agent_widget_edit',
          tags: expect.objectContaining({ outcome: 'host_rejected' })
        })
      )
    }
  )

  it('reports the rejected node id on the telemetry context', async () => {
    const { submit } = mountFollower()

    answerWithOpsResult(rejection(await submit(WIDGET_EDIT), 'opaque_widgets'))

    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      expect.any(Error),
      expect.objectContaining({
        context: expect.objectContaining({ nodeId: WIDGET_EDIT.node_id })
      })
    )
  })

  it('reports the rejected node id and class on the telemetry context when the rejected op added a node', async () => {
    const { submit } = mountFollower()

    answerWithOpsResult(
      rejection(await submit(NODE_ADD), 'uncatalogued_widget_write')
    )

    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      expect.any(Error),
      expect.objectContaining({
        context: expect.objectContaining({
          nodeId: NODE_ADD.node_id,
          classType: NODE_ADD.class_type
        })
      })
    )
  })

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

    expect(toastDescriptions()).toEqual([
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

    expect(toastDescriptions()).toEqual([
      expect.stringContaining(WIDGET_REJECTION_TEXT)
    ])
  })

  it('raises the notice as a self-dismissing error toast', async () => {
    const { submit } = mountFollower()

    answerWithOpsResult(rejection(await submit(WIDGET_EDIT), 'opaque_widgets'))

    expect(useToast().toasts).toEqual([
      expect.objectContaining({
        kind: 'error',
        title: i18n.global.t('g.error'),
        description: expect.stringContaining(WIDGET_REJECTION_TEXT),
        duration: expect.any(Number)
      })
    ])
  })

  // The applier raises this code for `add_node` too, and a node the host never
  // added has no widget value left on screen to warn about.
  it('does not blame a widget when the rejected op added a node', async () => {
    const { submit } = mountFollower()

    answerWithOpsResult(
      rejection(await submit(NODE_ADD), 'uncatalogued_widget_write')
    )

    expect(toastDescriptions()).toEqual([
      expect.stringContaining(GENERIC_REJECTION_TEXT)
    ])
  })

  it.for([
    {
      label: 'widget write',
      operation: WIDGET_EDIT,
      code: 'unknown_widget',
      reason: 'Rejected: node 3 seed (unknown_widget)'
    },
    {
      label: 'node add',
      operation: NODE_ADD,
      code: 'unknown_widget',
      reason: 'Rejected: Note (unknown_widget)'
    },
    {
      label: 'widget write whose name carries punctuation',
      operation: PUNCTUATED_WIDGET_EDIT,
      code: 'unknown_widget',
      reason: "Rejected: node 3 Width/Height & 'x' (unknown_widget)"
    },
    {
      label: 'workflow clear',
      operation: WORKFLOW_CLEAR,
      code: 'malformed_op',
      reason: 'Rejected: clearing the workflow (malformed_op)'
    },
    {
      label: 'node delete whose ID carries punctuation',
      operation: PUNCTUATED_NODE_DELETE,
      code: 'malformed_op',
      reason: 'Rejected: node node & <nine> (malformed_op)'
    },
    {
      label: 'link connect whose ID carries punctuation',
      operation: PUNCTUATED_LINK_CONNECT,
      code: 'malformed_op',
      reason: 'Rejected: link link & <nine> (malformed_op)'
    },
    {
      label: 'node field write',
      operation: {
        op: 'set_node_field',
        node_id: 3,
        field: 'title',
        value: 'renamed'
      } satisfies GraphOperation,
      code: 'malformed_op',
      reason: 'Rejected: node 3 title (malformed_op)'
    }
  ])(
    'names what the host rejected and why for a $label',
    async ({ operation, code, reason }) => {
      const { submit } = mountFollower()

      answerWithOpsResult(rejection(await submit(operation), code))

      expect(toastDescriptions()).toEqual([expect.stringContaining(reason)])
    }
  )

  it('keeps the target but omits a blank rejection code', async () => {
    const { submit } = mountFollower()

    answerWithOpsResult(rejection(await submit(WIDGET_EDIT), ''))

    expect(toastDescriptions()).toEqual([
      expect.stringMatching(
        new RegExp(`${GENERIC_REJECTION_TEXT}.*Rejected: node 3 seed$`)
      )
    ])
  })

  it('shares one notice between a refusal the minter raised and a host rejection', async () => {
    const { submit, follower } = mountFollower()

    follower.notifyWidgetWriteRefused(3, 'seed')
    expect(toastDescriptions()).toEqual([
      expect.stringMatching(
        new RegExp(`${WIDGET_REJECTION_TEXT}.*Rejected: node 3 seed$`)
      )
    ])

    answerWithOpsResult(rejection(await submit(WIDGET_EDIT), 'opaque_widgets'))
    expect(toastDescriptions()).toEqual([
      expect.stringContaining(WIDGET_REJECTION_TEXT)
    ])
  })

  it('falls back to a generic notice for a code that names no widget write', async () => {
    const { submit } = mountFollower()

    answerWithOpsResult(
      rejection(await submit(WIDGET_EDIT), 'base_version_conflict')
    )

    expect(toastDescriptions()).toEqual([
      expect.stringContaining(GENERIC_REJECTION_TEXT)
    ])
  })

  it('repeats no notice a rejection already put on screen', async () => {
    const { submit } = mountFollower()

    answerWithOpsResult(rejection(await submit(WIDGET_EDIT), 'opaque_widgets'))
    answerWithOpsResult(rejection(await submit(WIDGET_EDIT), 'opaque_widgets'))

    expect(toastDescriptions()).toEqual([
      expect.stringContaining(WIDGET_REJECTION_TEXT)
    ])
  })

  it('shows a later rejection after the throttle window', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    onTestFinished(() => {
      vi.useRealTimers()
    })
    const { submit } = mountFollower()

    answerWithOpsResult(rejection(await submit(WIDGET_EDIT), 'opaque_widgets'))
    await vi.advanceTimersByTimeAsync(10_001)
    answerWithOpsResult(rejection(await submit(WIDGET_EDIT), 'opaque_widgets'))

    expect(toastDescriptions()).toEqual([
      expect.stringContaining(WIDGET_REJECTION_TEXT)
    ])
  })

  it('replaces the notice with the latest rejection instead of stacking it', async () => {
    const { submit } = mountFollower()
    render(Toaster, { global: { plugins: [i18n] } })

    answerWithOpsResult(rejection(await submit(WIDGET_EDIT), 'opaque_widgets'))
    answerWithOpsResult(
      rejection(await submit(WIDGET_EDIT), 'base_version_conflict')
    )

    expect(toastDescriptions()).toEqual([
      expect.stringContaining(GENERIC_REJECTION_TEXT)
    ])
    await nextTick()
    expect(screen.getAllByTestId('toast')).toHaveLength(1)
    const announcement = screen.getByRole('alert')
    expect(announcement).toHaveTextContent(GENERIC_REJECTION_TEXT)
    expect(announcement).not.toHaveTextContent(WIDGET_REJECTION_TEXT)
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

    expect(useToast().toasts).toEqual([])
  })

  it('classifies a batch-level refusal that carries no failed entry', async () => {
    const { submit } = mountFollower()
    await submit(WIDGET_EDIT)

    answerWithOpsResult(batchRefusal('catalog_mismatch'))

    expect(toastDescriptions()).toEqual([
      expect.stringMatching(
        new RegExp(`^${GENERIC_REJECTION_TEXT}.*Reason: catalog_mismatch$`)
      )
    ])
    expect(reportedCodes()).toEqual(['catalog_mismatch'])
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'error_applying_agent_graph_edit',
        tags: expect.objectContaining({ outcome: 'host_rejected' })
      })
    )
  })

  it('reports each rejected batch once even when rejection codes repeat', async () => {
    const { submit } = mountFollower()

    await submit(WIDGET_EDIT)
    answerWithOpsResult(batchRefusal('overloaded'))
    answerWithOpsResult(batchRefusal('overloaded'))
    await submit(WIDGET_EDIT)
    answerWithOpsResult(batchRefusal('overloaded'))
    answerWithOpsResult(batchRefusal('overloaded'))
    await submit(WIDGET_EDIT)
    answerWithOpsResult(batchRefusal('catalog_mismatch'))

    expect(reportedCodes()).toEqual([
      'overloaded',
      'overloaded',
      'catalog_mismatch'
    ])
  })

  it.for([
    {
      branch: 'widget',
      ops: [NODE_ADD, WIDGET_EDIT],
      code: 'opaque_widgets',
      expected: WIDGET_REJECTION_TEXT,
      errorType: 'error_applying_agent_widget_edit'
    },
    {
      branch: 'generic',
      ops: [WIDGET_EDIT, NODE_ADD],
      code: 'uncatalogued_widget_write',
      expected: GENERIC_REJECTION_TEXT,
      errorType: 'error_applying_agent_graph_edit'
    }
  ])(
    'does not claim nothing was saved when a batch applied a prefix ($branch)',
    async ({ ops, code, expected, errorType }) => {
      const { submitBatch } = mountFollower()
      const frames = await submitBatch([NODE_DELETE, ...ops, NODE_DELETE])
      expect(frames).toHaveLength(1)
      const [[skippedId, appliedId, rejectedId, tailId]] = frames
      expect(rejectedId).toBeDefined()

      answerWithOpsResult({
        v: 1,
        workflow_id: WORKFLOW_ID,
        ok: false,
        applied: [appliedId],
        skipped: [skippedId],
        failed: {
          index: 2,
          op_id: rejectedId,
          code,
          message: 'node is absent from the pinned catalog'
        }
      })

      expect(reportError).toHaveBeenCalledExactlyOnceWith(
        expect.any(Error),
        expect.objectContaining({
          errorType,
          level: 'warning',
          context: expect.objectContaining({ opIds: [rejectedId, tailId] })
        })
      )
      expect(toastDescriptions()).toEqual([expect.stringContaining(expected)])
      expect(toastDescriptions()[0]).toContain('some earlier edits were')
    }
  )
})
