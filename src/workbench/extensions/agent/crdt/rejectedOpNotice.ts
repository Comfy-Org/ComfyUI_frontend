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
  function showToast(key: string): void {
    useToast().error(i18n.global.t('g.error'), {
      id: NOTICE_ID,
      description: i18n.global.t(key),
      duration: NOTICE_LIFE_MS
    })
  }

  return {
    notify(ops: readonly Op[], result: OpsResultView) {
      if (result.ok) return
      const { failed } = result
      const widgetWrite = isRejectedWidgetWrite(ops, failed)
      const code = failed?.code ?? result.code ?? 'unspecified'
      reportLostEdit(
        'host_rejected',
        failed
          ? [rejectedOp(ops, failed)].filter((op) => op !== undefined)
          : ops,
        {
          code,
          workflowId: result.workflowId,
          errorType: widgetWrite
            ? 'error_applying_agent_widget_edit'
            : 'error_applying_agent_graph_edit'
        }
      )
      const partial = result.applied.length > 0 && failed !== undefined
      showToast(noticeKey(widgetWrite, partial))
    },
    notifyWidgetWriteRefused() {
      showToast('agent.editRejected.widgetWrite')
    }
  }
}
