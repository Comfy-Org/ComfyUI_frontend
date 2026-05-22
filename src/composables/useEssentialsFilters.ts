import { computed, ref } from 'vue'

export const ESSENTIALS_MEDIA_TYPES = [
  'image',
  'video',
  'text',
  'audio',
  '3d'
] as const

export type EssentialsMediaType = (typeof ESSENTIALS_MEDIA_TYPES)[number]

export const ESSENTIALS_MEDIA_LABELS: Record<EssentialsMediaType, string> = {
  image: 'Image',
  video: 'Video',
  text: 'Text',
  audio: 'Audio',
  '3d': '3D'
}

const mediaFilters = ref<Record<EssentialsMediaType, boolean>>({
  image: false,
  video: false,
  text: false,
  audio: false,
  '3d': false
})

const allMediaSelected = ref(true)

function clearAllMedia() {
  for (const media of ESSENTIALS_MEDIA_TYPES) {
    mediaFilters.value[media] = false
  }
}

function setMediaFilter(media: EssentialsMediaType, enabled: boolean) {
  if (allMediaSelected.value) {
    clearAllMedia()
    allMediaSelected.value = false
  }
  mediaFilters.value[media] = enabled
  const allChecked = ESSENTIALS_MEDIA_TYPES.every((m) => mediaFilters.value[m])
  const anyChecked = ESSENTIALS_MEDIA_TYPES.some((m) => mediaFilters.value[m])
  if (allChecked || !anyChecked) {
    selectAllMedia()
  }
}

function selectAllMedia() {
  clearAllMedia()
  allMediaSelected.value = true
}

const effectiveMediaFilters = computed<Record<EssentialsMediaType, boolean>>(
  () => {
    if (allMediaSelected.value) {
      return ESSENTIALS_MEDIA_TYPES.reduce(
        (acc, m) => ({ ...acc, [m]: true }),
        {} as Record<EssentialsMediaType, boolean>
      )
    }
    return mediaFilters.value
  }
)

export function useEssentialsFilters() {
  return {
    mediaFilters,
    effectiveMediaFilters,
    setMediaFilter,
    allMediaSelected,
    selectAllMedia
  }
}
