import { i18n } from '@/i18n'

const MAX_NAMED_REJECTIONS = 3

export function refusedAttachmentsMessage(
  names: string[],
  rejectedCount: number = names.length
): string {
  const named = names.slice(0, MAX_NAMED_REJECTIONS)
  const remaining = rejectedCount - named.length
  const name =
    named.length === 0
      ? String(rejectedCount)
      : remaining > 0
        ? i18n.global.t('agent.attachmentNamesOverflow', {
            names: named.join(', '),
            count: remaining
          })
        : named.join(', ')
  return i18n.global.t(
    'agent.attachmentTypeNotAccepted',
    { name },
    rejectedCount
  )
}
