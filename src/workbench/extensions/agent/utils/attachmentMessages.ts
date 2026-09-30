import { i18n } from '@/i18n'

const MAX_NAMED_REJECTIONS = 3

/**
 * The one place a refusal is worded, so the local and server-reported paths
 * cannot disagree about it.
 *
 * `total` is separate from `names.length` because the two are separate facts on
 * the wire: the server caps `AgentAttachmentRejected.rejected` and reports the
 * real figure in `rejected_count`, so a caller that counts the array
 * understates a refusal. Locally the two coincide and the default applies.
 *
 * Names are capped for display on both paths — an unbounded list would only
 * move from a stack of toasts into one unreadable message body.
 */
export function refusedAttachmentsMessage(
  names: string[],
  total: number = names.length
): string {
  const named = names.slice(0, MAX_NAMED_REJECTIONS)
  const remaining = total - named.length
  const name =
    remaining > 0
      ? i18n.global.t('agent.attachmentNamesOverflow', {
          names: named.join(', '),
          count: remaining
        })
      : named.join(', ')
  return i18n.global.t('agent.attachmentTypeNotAccepted', { name }, total)
}
