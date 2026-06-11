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
  image: 'sideToolbar.mediaAssets.filterImage',
  video: 'sideToolbar.mediaAssets.filterVideo',
  text: 'sideToolbar.mediaAssets.filterText',
  audio: 'sideToolbar.mediaAssets.filterAudio',
  '3d': 'sideToolbar.mediaAssets.filter3D'
} as const

export function useEssentialsFilters() {
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
    if (allMediaSelected.value) allMediaSelected.value = false

    mediaFilters.value[media] = enabled
    const isNew = (m: EssentialsMediaType) => mediaFilters.value[m] === enabled
    if (ESSENTIALS_MEDIA_TYPES.every(isNew)) selectAllMedia()
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
  return {
    mediaFilters,
    effectiveMediaFilters,
    setMediaFilter,
    allMediaSelected,
    selectAllMedia
  }
}
