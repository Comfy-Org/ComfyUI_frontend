import { throttle } from 'es-toolkit'
import type { ThrottledFunction } from 'es-toolkit'
import type { Op } from '@comfyorg/comfy-multi-player'

import { useToast } from '@/components/ui/toast/toastStore'
import { i18n } from '@/i18n'
import { reportError } from '@/platform/telemetry/reportError'

import type { DocOpFailure } from './docFrameClient'
import type { OpsResultView } from './opSender'

const NOTICE_LIFE_MS = 10_000

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

function rejectedTarget(op: Op | undefined): string | undefined {
  if (op?.op === 'set_widget') return op.widget
  if (op?.op === 'add_node') return op.class_type
  return undefined
}

function withReason(
  notice: string,
  target: string | undefined,
  code: string
): string {
  if (target)
    return `${notice} ${i18n.global.t('agent.editRejected.reason', { target, code })}`
  if (code === 'unspecified') return notice
  return `${notice} ${i18n.global.t('agent.editRejected.reasonCode', { code })}`
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
    ThrottledFunction<(detail: string) => void>
  >()
  const reportedCodes = new Set<string>()

  function reportOnce(
    code: string,
    widgetWrite: boolean,
    result: OpsResultView,
    failed: DocOpFailure | undefined
  ): void {
    if (reportedCodes.has(code)) return
    reportedCodes.add(code)
    reportError(
      new Error(`the agent doc host rejected a human edit (${code})`),
      {
        surface: 'agent',
        errorType: widgetWrite
          ? 'error_applying_agent_widget_edit'
          : 'error_applying_agent_graph_edit',
        context: { workflowId: result.workflowId, opId: failed?.op_id, code },
        level: 'warning'
      }
    )
  }

  function showThrottled(kind: string, description: string): void {
    const existing = throttledToasts.get(kind)
    if (existing) return existing(description)
    const created = throttle(
      (detail: string) => {
        useToast().error(i18n.global.t('g.error'), {
          description: detail,
          duration: NOTICE_LIFE_MS
        })
      },
      NOTICE_LIFE_MS,
      { edges: ['leading'] }
    )
    throttledToasts.set(kind, created)
    created(description)
  }

  return {
    notify(ops: readonly Op[], result: OpsResultView) {
      if (result.ok) return
      const { failed } = result
      const widgetWrite = isRejectedWidgetWrite(ops, failed)
      const code = failed?.code ?? result.code ?? 'unspecified'
      reportOnce(code, widgetWrite, result, failed)
      const partial = result.applied.length > 0 && failed !== undefined
      const kind = noticeKey(widgetWrite, partial)
      const notice = i18n.global.t(kind)
      const target = failed && rejectedTarget(rejectedOp(ops, failed))
      showThrottled(kind, withReason(notice, target, code))
    },
    notifyWidgetWriteRefused() {
      showThrottled(
        'agent.editRejected.widgetWrite',
        i18n.global.t('agent.editRejected.widgetWrite')
      )
    },
    cancel() {
      for (const throttled of throttledToasts.values()) throttled.cancel()
      throttledToasts.clear()
    }
  }
}
