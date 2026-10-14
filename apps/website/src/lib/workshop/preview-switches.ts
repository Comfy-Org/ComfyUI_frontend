import { computed, ref } from 'vue'
import type { ComputedRef } from 'vue'

import type { TranslationKey } from '@/i18n/translations'
import { useWorkshopFlag } from '@/scripts/posthog'

/** The Hub sections a preview build can switch, each named by its PostHog flag. */
export const PREVIEW_SWITCHES = [
  { id: 'hub-home-community', labelKey: 'workshop.preview.community' },
  {
    id: 'home-hub-pick-remix-run',
    labelKey: 'workshop.preview.homePickRemixRun'
  },
  { id: 'hub-task-sidebar', labelKey: 'workshop.preview.taskSidebar' },
  { id: 'hub-facet-sidebar', labelKey: 'workshop.preview.workflowsByModality' },
  { id: 'hub-workflows-flat', labelKey: 'workshop.preview.workflowsFlat' },
  {
    id: 'hub-workflows-modality-task',
    labelKey: 'workshop.preview.workflowsModalityTask'
  },
  {
    id: 'hub-workflows-full-catalogue-mock',
    labelKey: 'workshop.preview.fullCatalogueMock'
  }
] as const satisfies readonly { id: string; labelKey: TranslationKey }[]

export type PreviewSwitchId = (typeof PREVIEW_SWITCHES)[number]['id']

const STORAGE_PREFIX = 'comfy-preview-switch:'

const stored = ref<Partial<Record<PreviewSwitchId, boolean>>>({})
let loaded = false

function readStored(id: PreviewSwitchId): boolean | undefined {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + id)
    return raw === null ? undefined : raw === 'on'
  } catch {
    return undefined
  }
}

function loadStored() {
  if (loaded || typeof window === 'undefined') return
  loaded = true
  stored.value = Object.fromEntries(
    PREVIEW_SWITCHES.flatMap(({ id }) => {
      const value = readStored(id)
      return value === undefined ? [] : [[id, value]]
    })
  )
}

/** Whether a switched section shows: this browser's choice, else its flag. */
export function usePreviewSwitch(id: PreviewSwitchId): ComputedRef<boolean> {
  loadStored()
  const flag = useWorkshopFlag(id)
  return computed(() => stored.value[id] ?? flag.value)
}

export function setPreviewSwitch(id: PreviewSwitchId, on: boolean) {
  loadStored()
  stored.value = { ...stored.value, [id]: on }
  try {
    window.localStorage.setItem(STORAGE_PREFIX + id, on ? 'on' : 'off')
  } catch {
    return
  }
}
