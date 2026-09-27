import { throttle } from 'es-toolkit'
import type { ThrottledFunction } from 'es-toolkit'
import type { Op } from '@comfyorg/comfy-multi-player'

import { i18n } from '@/i18n'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'

import type { DocOpFailure } from './docFrameClient'
import type { OpsResultView } from './opSender'

const NOTICE_LIFE_MS = 10_000

/**
 * Doc-host codes for a refused widget write. The applier raises
 * `uncatalogued_widget_write` and `unknown_widget` for `add_node` too, so the
 * op the host named decides the wording rather than the code alone.
 */
const WIDGET_WRITE_REJECTION_CODES = new Set([
  'opaque_widgets',
  'uncatalogued_widget_write',
  'unknown_widget',
  'widget_out_of_range'
])

export interface RejectedOpNotifier {
  notify(ops: readonly Op[], result: OpsResultView): void
  cancel(): void
}

function rejectedOp(
  ops: readonly Op[],
  failure: Partial<DocOpFailure>
): Op | undefined {
  return (
    ops.find((op) => op.op_id === failure.op_id) ??
    (failure.index === undefined ? undefined : ops[failure.index])
  )
}

function isRejectedWidgetWrite(
  ops: readonly Op[],
  failure: Partial<DocOpFailure> | undefined
): boolean {
  if (failure?.code === undefined) return false
  return (
    WIDGET_WRITE_REJECTION_CODES.has(failure.code) &&
    rejectedOp(ops, failure)?.op === 'set_widget'
  )
}

/**
 * Tells the human a batch the host refused never reached the shared document.
 *
 * One follower owns one notifier. An uncatalogued node refuses every edit it
 * receives, so each distinct message is rate-limited to one toast per
 * `NOTICE_LIFE_MS` — per message, so a rejection of another kind inside that
 * window still speaks for itself — and each distinct failure code is reported
 * once, the policy `docFrameClient` already applies to invalid frames.
 */
export function createRejectedOpNotifier(): RejectedOpNotifier {
  const throttledToasts = new Map<string, ThrottledFunction<() => void>>()
  const reportedCodes = new Set<string>()

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
    notify(ops, result) {
      if (result.ok) return
      const { failure } = result
      const widgetWrite = isRejectedWidgetWrite(ops, failure)
      const code = failure?.code ?? 'unspecified'
      if (!reportedCodes.has(code)) {
        reportedCodes.add(code)
        reportError(
          new Error(`the agent doc host rejected a human edit (${code})`),
          {
            errorType: widgetWrite
              ? 'error_applying_agent_widget_edit'
              : 'error_applying_agent_graph_edit',
            context: {
              workflowId: result.workflowId,
              opId: failure?.op_id,
              code: failure?.code
            },
            level: 'warning'
          }
        )
      }
      const { t } = i18n.global
      throttledToast(
        widgetWrite
          ? t('agent.editRejected.widgetWrite')
          : t('agent.editRejected.generic')
      )()
    },
    cancel() {
      for (const throttled of throttledToasts.values()) throttled.cancel()
      throttledToasts.clear()
    }
  }
}
