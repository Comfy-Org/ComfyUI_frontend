import { computed, ref } from 'vue'
import type { ComputedRef } from 'vue'

import type { TranslationKey } from '@/i18n/translations'
import { useWorkshopFlag } from '@/scripts/posthog'

type PreviewPage = 'home' | 'models'

const PREVIEW_SWITCHES = [
  {
    id: 'home-hub-pick-remix-run',
    page: 'home',
    labelKey: 'workshop.preview.homePickRemixRun',
    hintKey: 'workshop.preview.homePickRemixRunHint'
  },
  {
    id: 'hub-task-sidebar',
    page: 'models',
    labelKey: 'workshop.preview.taskSidebar',
    hintKey: 'workshop.preview.taskSidebarHint'
  },
  {
    id: 'hub-models-compare',
    page: 'models',
    labelKey: 'workshop.preview.compare',
    hintKey: 'workshop.preview.compareHint'
  }
] as const satisfies readonly {
  id: string
  page: PreviewPage
  labelKey: TranslationKey
  hintKey: TranslationKey
}[]

const PREVIEW_PAGES = [
  { page: 'home', labelKey: 'workshop.preview.pages.home' },
  { page: 'models', labelKey: 'workshop.preview.pages.models' }
] as const satisfies readonly { page: PreviewPage; labelKey: TranslationKey }[]

/** The preview switches grouped under the page each one changes, in page order. */
export const PREVIEW_SWITCH_GROUPS = PREVIEW_PAGES.map(
  ({ page, labelKey }) => ({
    page,
    labelKey,
    switches: PREVIEW_SWITCHES.filter((entry) => entry.page === page)
  })
)

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
