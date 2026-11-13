import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { z } from 'zod'

import { useSkillPacksStore } from '@/platform/skills/stores/skillPacksStore'
import { isLogoutTransition } from '@/platform/workflow/persistence/base/storageIO'
import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'

const zSkillDraftFields = z.object({
  name: z.string(),
  description: z.string(),
  body: z.string()
})

const zSkillDrafts = z.object({
  newSkill: zSkillDraftFields.nullable(),
  edits: z.record(z.string(), zSkillDraftFields)
})

export type SkillDraftFields = z.infer<typeof zSkillDraftFields>
type SkillDrafts = z.infer<typeof zSkillDrafts>

export type SkillDraftTarget = { kind: 'new' } | { kind: 'edit'; name: string }

export function sameDraftFields(
  a: SkillDraftFields,
  b: SkillDraftFields
): boolean {
  return (
    a.name === b.name && a.description === b.description && a.body === b.body
  )
}

function editKey(name: string): string {
  return `skill:${name}`
}

function emptyDrafts(): SkillDrafts {
  return { newSkill: null, edits: {} }
}

function readDrafts(scope: string): SkillDrafts {
  try {
    const stored = localStorage.getItem(StorageKeys.agentSkillDrafts(scope))
    if (!stored) return emptyDrafts()
    const parsed = zSkillDrafts.safeParse(JSON.parse(stored))
    return parsed.success ? parsed.data : emptyDrafts()
  } catch {
    return emptyDrafts()
  }
}

function writeDrafts(scope: string, drafts: SkillDrafts): void {
  const key = StorageKeys.agentSkillDrafts(scope)
  try {
    if (!drafts.newSkill && Object.keys(drafts.edits).length === 0)
      localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(drafts))
  } catch {
    return
  }
}

export const useSkillDraftStore = defineStore('skillDrafts', () => {
  const skills = useSkillPacksStore()
  const drafts = ref(readDrafts(skills.scope))

  watch(
    () => skills.scope,
    (scope) => {
      drafts.value = readDrafts(scope)
    },
    { flush: 'sync' }
  )

  const newSkillDraft = computed(() => drafts.value.newSkill)

  function editDraftFor(name: string): SkillDraftFields | undefined {
    return drafts.value.edits[editKey(name)]
  }

  function setDraft(
    scope: string,
    target: SkillDraftTarget,
    fields: SkillDraftFields | null
  ): void {
    if (fields && isLogoutTransition()) return
    const next = readDrafts(scope)
    if (target.kind === 'new') next.newSkill = fields
    else if (fields) next.edits[editKey(target.name)] = fields
    else delete next.edits[editKey(target.name)]
    writeDrafts(scope, next)
    if (scope === skills.scope) drafts.value = next
  }

  function clearDraftIfUnchanged(
    scope: string,
    target: SkillDraftTarget,
    submitted: SkillDraftFields
  ): void {
    const next = readDrafts(scope)
    const stored =
      target.kind === 'new' ? next.newSkill : next.edits[editKey(target.name)]
    if (stored && sameDraftFields(stored, submitted)) {
      if (target.kind === 'new') next.newSkill = null
      else delete next.edits[editKey(target.name)]
      writeDrafts(scope, next)
    }
    if (scope === skills.scope) drafts.value = next
  }

  return { newSkillDraft, editDraftFor, setDraft, clearDraftIfUnchanged }
})
