import type { AskUserOption } from '../../../services/agent/agentMessageParts'

export const askUserOptionRowClass =
  'flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-secondary-background-hover'

export function askUserOptionId(idPrefix: string, index: number): string {
  return `${idPrefix}-option-${index}`
}

export function askUserOptionDescribedBy(
  idPrefix: string,
  option: AskUserOption,
  index: number
): string | undefined {
  return option.description
    ? `${askUserOptionId(idPrefix, index)}-description`
    : undefined
}
