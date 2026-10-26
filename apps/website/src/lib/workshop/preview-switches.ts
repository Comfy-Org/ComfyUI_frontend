import { computed, ref } from 'vue'
import type { ComputedRef } from 'vue'

import type { TranslationKey } from '@/i18n/translations'
import { useWorkshopFlag } from '@/scripts/posthog'

/** The Hub sections a preview build can switch, each named by its PostHog flag. */
export const PREVIEW_SWITCHES = [
  { id: 'hub-home-community', labelKey: 'workshop.preview.community' },
  {
    id: 'hub-workflows-modality-task',
    labelKey: 'workshop.preview.workflowsModalityTask',
    defaultOn: true
  },
  {
    id: 'hub-workflows-full-catalogue-mock',
    labelKey: 'workshop.preview.fullCatalogueMock',
    defaultOn: true
  }
] as const satisfies readonly {
  id: string
  labelKey: TranslationKey
  defaultOn?: boolean
}[]

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

const DEFAULT_ON: ReadonlySet<PreviewSwitchId> = new Set(
  PREVIEW_SWITCHES.flatMap((entry) => ('defaultOn' in entry ? [entry.id] : []))
)

/** Whether a switched section shows: this browser's choice, else its flag or default. */
export function usePreviewSwitch(id: PreviewSwitchId): ComputedRef<boolean> {
  loadStored()
  const flag = useWorkshopFlag(id)
  return computed(() => stored.value[id] ?? (flag.value || DEFAULT_ON.has(id)))
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
