import { throttle } from 'es-toolkit'
import type { ThrottledFunction } from 'es-toolkit'
import type { Op } from '@comfyorg/comfy-multi-player'

import { useToast } from '@/components/ui/toast/toastStore'
import { i18n } from '@/i18n'
import { createToastId } from '@/types/toastId'

import type { DocOpFailure } from './docFrameClient'
import type { OpsResultView } from './opSender'
import { reportLostEdit } from './reportLostEdit'

const NOTICE_LIFE_MS = 10_000
const NOTICE_ID = createToastId()

function rejectedOp(ops: readonly Op[], failed: DocOpFailure): Op | undefined {
  return ops.find((op) => op.op_id === failed.op_id) ?? ops[failed.index]
}

/**
 * Doc-host codes for a refused widget write. Both halves are load-bearing: the
 * applier raises `uncatalogued_widget_write` and `unknown_widget` for
 * `add_node` too, so the op the host NAMED must also be a widget write; and a
 * `set_widget` refused for an unrelated reason (`catalog_required`,
 * `malformed_op`) is not a widget-addressing failure and gets the generic copy.
 */
const WIDGET_WRITE_REJECTION_CODES = new Set([
  'opaque_widgets',
  'uncatalogued_widget_write',
  'unknown_widget',
  'widget_out_of_range'
])

function isRejectedWidgetWrite(
  ops: readonly Op[],
  failed: DocOpFailure | undefined
): boolean {
  if (failed === undefined) return false
  return (
    WIDGET_WRITE_REJECTION_CODES.has(failed.code) &&
    rejectedOp(ops, failed)?.op === 'set_widget'
  )
}

function nodeFieldTarget(nodeId: string | number, field: string): string {
  const t = i18n.global.t
  const plain = { escapeParameter: false }
  return t(
    'agent.editRejected.targets.nodeField',
    { id: String(nodeId), field },
    plain
  )
}

function rejectedTarget(op: Op | undefined): string | undefined {
  const t = i18n.global.t
  const plain = { escapeParameter: false }
  switch (op?.op) {
    case 'set_widget':
      return nodeFieldTarget(op.node_id, op.widget)
    case 'add_node':
      return op.class_type
    case 'set_node_field':
      return nodeFieldTarget(op.node_id, op.field)
    case 'delete_node':
      return t(
        'agent.editRejected.targets.node',
        { id: String(op.node_id) },
        plain
      )
    case 'clear':
      return t('agent.editRejected.targets.clear')
    case 'connect':
    case 'disconnect':
      return t(
        'agent.editRejected.targets.link',
        { id: String(op.link_id) },
        plain
      )
    default:
      return undefined
  }
}

function rejectedOpContext(op: Op | undefined): {
  nodeId?: string | number
  classType?: string
} {
  switch (op?.op) {
    case 'set_widget':
    case 'set_node_field':
    case 'delete_node':
      return { nodeId: op.node_id }
    case 'add_node':
      return { nodeId: op.node_id, classType: op.class_type }
    default:
      return {}
  }
}

function withReason(
  notice: string,
  target: string | undefined,
  code: string
): string {
  const plain = { escapeParameter: false }
  if (target && code && code !== 'unspecified')
    return i18n.global.t(
      'agent.editRejected.withReason',
      { notice, target, code },
      plain
    )
  if (target)
    return i18n.global.t(
      'agent.editRejected.withReasonTarget',
      { notice, target },
      plain
    )
  if (!code || code === 'unspecified') return notice
  return i18n.global.t(
    'agent.editRejected.withReasonCode',
    { notice, code },
    plain
  )
}

/**
 * Schema §4 aborts the REMAINDER of a batch, so a rejected result can still
 * carry an applied prefix — which is what `partial` distinguishes.
 */
function noticeKey(widgetWrite: boolean, partial: boolean): string {
  if (widgetWrite) {
    return partial
      ? 'agent.editRejected.widgetWritePartial'
      : 'agent.editRejected.widgetWrite'
  }
  return partial
    ? 'agent.editRejected.genericPartial'
    : 'agent.editRejected.generic'
}

export function createRejectedOpNotifier() {
  const throttledToasts = new Map<
    string,
    ThrottledFunction<(description: string) => void>
  >()

  function showToast(kind: string, description: string): void {
    const toast = throttledToasts.get(kind)
    if (toast) return toast(description)
    const throttled = throttle(
      (detail: string) =>
        useToast().error(i18n.global.t('g.error'), {
          id: NOTICE_ID,
          description: detail,
          duration: NOTICE_LIFE_MS
        }),
      NOTICE_LIFE_MS,
      { edges: ['leading'] }
    )
    throttledToasts.set(kind, throttled)
    throttled(description)
  }

  function reportRejectedEdit(
    ops: readonly Op[],
    result: OpsResultView,
    failed: DocOpFailure | undefined,
    code: string,
    widgetWrite: boolean
  ): void {
    const accepted = new Set([...result.applied, ...result.skipped])
    reportLostEdit(
      'host_rejected',
      ops.filter((op) => !accepted.has(op.op_id)),
      {
        code,
        workflowId: result.workflowId,
        message: failed?.message,
        failedIndex: failed?.index,
        errorType: widgetWrite
          ? 'error_applying_agent_widget_edit'
          : 'error_applying_agent_graph_edit',
        ...rejectedOpContext(failed && rejectedOp(ops, failed))
      }
    )
  }

  function notifyRejected(ops: readonly Op[], result: OpsResultView): void {
    const { failed } = result
    const widgetWrite = isRejectedWidgetWrite(ops, failed)
    const code = failed?.code ?? result.code ?? 'unspecified'
    reportRejectedEdit(ops, result, failed, code, widgetWrite)
    const partial = result.applied.length > 0 && failed !== undefined
    const kind = noticeKey(widgetWrite, partial)
    const notice = i18n.global.t(kind)
    const target = failed && rejectedTarget(rejectedOp(ops, failed))
    showToast(kind, withReason(notice, target, code))
  }

  return {
    notify(ops: readonly Op[], result: OpsResultView) {
      if (result.ok) return
      notifyRejected(ops, result)
    },
    notifyWidgetWriteRefused(nodeId: string | number, widgetName: string) {
      const notice = i18n.global.t('agent.editRejected.widgetWrite')
      showToast(
        'agent.editRejected.widgetWrite',
        withReason(notice, nodeFieldTarget(nodeId, widgetName), 'unspecified')
      )
    }
  }
}
