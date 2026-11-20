import {
  isName,
  isText,
  packObject
} from '@/platform/nodeApi/v4/utilities/packArguments'
import type { PromptDef } from '@/platform/nodeApi/v4/types'
import { useDialogService } from '@/services/dialogService'

const PROMPT_FIELDS = {
  label: true,
  value: true,
  placeholder: true
} satisfies Record<keyof PromptDef, true>

export function prompt(definition: unknown): Promise<string | undefined> {
  const fields = packObject('ui.prompt', 'a prompt', definition, PROMPT_FIELDS)
  const label = fields.required('label', isName, 'a non-empty string')
  const value = fields.optional('value', isText, 'a string')
  const placeholder = fields.optional('placeholder', isText, 'a string')
  return askUser(label, value, placeholder)
}

async function askUser(
  label: string,
  value: string | undefined,
  placeholder: string | undefined
): Promise<string | undefined> {
  const answer = await useDialogService().prompt({
    title: label,
    message: label,
    defaultValue: value,
    placeholder
  })
  return answer ?? undefined
}
