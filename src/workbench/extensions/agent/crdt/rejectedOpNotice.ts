import { throttle } from 'es-toolkit'
import type { ThrottledFunction } from 'es-toolkit'
import type { Op } from '@comfyorg/comfy-multi-player'

import { i18n } from '@/i18n'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'

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

/**
 * Tells the human which of their edits the host refused. One follower owns one
 * notifier. Actual guarantees, since two of them are narrower than they look:
 *
 * - A refused batch may still have applied a prefix (schema §4 aborts the
 *   remainder, not the batch), so this reports the REJECTED operations and not
 *   that nothing reached the document.
 * - Toasts are throttled per RENDERED MESSAGE, not per code, so two rejections
 *   that render the same copy — every generic one does — collapse to one toast
 *   for `NOTICE_LIFE_MS`. Only a differently-worded rejection speaks inside
 *   that window.
 * - Telemetry is deduplicated per CODE, so a distinct code still reports even
 *   when its toast was collapsed. That is the channel to trust for counting.
 */
export function createRejectedOpNotifier() {
  const throttledToasts = new Map<string, ThrottledFunction<() => void>>()
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
        errorType: widgetWrite
          ? 'error_applying_agent_widget_edit'
          : 'error_applying_agent_graph_edit',
        context: { workflowId: result.workflowId, opId: failed?.op_id, code },
        level: 'warning'
      }
    )
  }

  function throttledToast(detail: string): ThrottledFunction<() => void> {
    const existing = throttledToasts.get(detail)
    if (existing) return existing
    const created = throttle(
      () => {
        useToastStore().add({
          severity: 'error',
          summary: i18n.global.t('g.error'),
          detail,
          life: NOTICE_LIFE_MS
        })
      },
      NOTICE_LIFE_MS,
      { edges: ['leading'] }
    )
    throttledToasts.set(detail, created)
    return created
  }

  return {
    notify(ops: readonly Op[], result: OpsResultView) {
      if (result.ok) return
      const { failed } = result
      const widgetWrite = isRejectedWidgetWrite(ops, failed)
      // A batch-level refusal (`overloaded`, `catalog_mismatch`, …) carries no
      // `failure` at all; without this every one collapses to 'unspecified' and
      // the first suppresses the telemetry report for every later kind.
      const code = failed?.code ?? result.code ?? 'unspecified'
      reportOnce(code, widgetWrite, result, failed)
      const partial = result.applied.length > 0 && failed !== undefined
      throttledToast(i18n.global.t(noticeKey(widgetWrite, partial)))()
    },
    cancel() {
      for (const throttled of throttledToasts.values()) throttled.cancel()
      throttledToasts.clear()
    }
  }
}
