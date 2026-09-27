import { fromPartial } from '@total-typescript/shoehorn'
import { render } from '@testing-library/vue'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { defineComponent, ref } from 'vue'

import { i18n } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { api } from '@/scripts/api'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { parseWireOps } from '@e2e/fixtures/agentWireFrame'

import type { GraphMutations } from './graphMutations'
import type { GraphOperation } from './graphOperations'
import { useAgentCrdtFollower } from './useAgentCrdtFollower'

const WORKFLOW_ID = 'wf-rejected-widget-write'

/**
 * The exact text `agentDuplicateInsertOpaqueWidgetWrite.spec.ts` filters the
 * error toast on; the e2e contract breaks if this wording drifts.
 */
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
function mintedOpId(raw: string): string | null {
  const frame: unknown = JSON.parse(raw)
  const { type, data } =
    typeof frame === 'object' && frame !== null
      ? (frame as { type?: unknown; data?: unknown })
      : {}
  if (type !== 'doc_ops') return null
  const parsed =
    typeof data === 'object' && data !== null
      ? parseWireOps((data as { ops?: unknown }).ops)
      : { ok: false as const, reason: 'invalid_frame' as const }
  return parsed.ok && parsed.ops.length > 0 ? parsed.ops[0].op_id : null
}

/** The transport listens on `api`; a server frame is a CustomEvent there. */
function answerWithOpsResult(detail: Record<string, unknown>): void {
  EventTarget.prototype.dispatchEvent.call(
    api,
    new CustomEvent('doc_ops_result', { detail })
  )
}

/** Mounts a follower and returns a submitter for one human edit at a time. */
function mountFollower() {
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

  return async function submit(operation: GraphOperation): Promise<string> {
    const framesBefore = send.mock.calls.length
    follower.enqueueHumanOperations([operation])
    // The coalescer defers delivery to the end of the tick.
    await vi.waitFor(() =>
      expect(send.mock.calls.length).toBeGreaterThan(framesBefore)
    )
    const opId = send.mock.calls
      .slice(framesBefore)
      .map(([frame]) => mintedOpId(frame))
      .find((id) => id !== null)
    if (opId == null)
      throw new Error('the sender put no wire-shaped doc_ops frame on the wire')
    return opId
  }
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
      i18n.global.t('agent.editRejected.generic')
    ])
  })

  it('falls back to a generic notice for a code that names no widget write', async () => {
    const submit = mountFollower()

    answerWithOpsResult(
      rejection(await submit(WIDGET_EDIT), 'base_version_conflict')
    )

    expect(toastDetails()).toEqual([
      i18n.global.t('agent.editRejected.generic')
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
      i18n.global.t('agent.editRejected.generic')
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
})
