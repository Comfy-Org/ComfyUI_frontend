import type { Ref } from 'vue'
import { z } from 'astro/zod'
import type { Document } from './editor-document'

export const editorInputClass =
  'w-full rounded-lg border border-admin-field bg-admin-page px-3 py-2 text-sm text-admin-fg outline-none focus:border-primary-comfy-yellow'

function eventValue(event: Event) {
  const target = event.target
  if (target instanceof HTMLInputElement)
    return target.type === 'checkbox' ? target.checked : target.value
  if (
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
    return target.value
  return undefined
}

export function useEditorFields(document: Ref<Document>, edited: () => void) {
  function value(name: string) {
    const raw = document.value[name]
    return typeof raw === 'string' ? raw : ''
  }
  function patch(name: string, event: Event) {
    const result = eventValue(event)
    if (result === undefined) return
    const next = { ...document.value, [name]: result }
    if (
      result === '' &&
      [
        'visible_from',
        'workflow_uid',
        'implementation_ref',
        'router_model_id',
        'author_uid',
        'change_id',
        'documentation_url',
        'cloud_share_url',
        'output_type',
        'long_description',
        'description',
        'works_on_cloud'
      ].includes(name)
    )
      delete next[name]
    if (name === 'works_on_cloud' && result !== '')
      next[name] = result === 'true'
    document.value = next
    edited()
  }
  function list(name: string, event: Event) {
    if (!(event.target instanceof HTMLInputElement)) return
    document.value = {
      ...document.value,
      [name]: event.target.value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
    }
  }
  function listValue(name: string) {
    const parsed = z.array(z.string()).safeParse(document.value[name])
    return parsed.success ? parsed.data.join(', ') : ''
  }
  return { value, patch, list, listValue }
}
