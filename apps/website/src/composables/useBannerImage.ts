import { computed, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

const DEFAULT_BANNER = '/assets/images/fallback-gradient-avatar.svg'

interface UseBannerImageInput {
  bannerUrl?: MaybeRefOrGetter<string | undefined>
  iconUrl?: MaybeRefOrGetter<string | undefined>
}

export function useBannerImage({ bannerUrl, iconUrl }: UseBannerImageInput) {
  const isImageError = ref(false)

  const showDefaultBanner = computed(
    () => !toValue(bannerUrl) && !toValue(iconUrl)
  )
  const imgSrc = computed(() => toValue(bannerUrl) || toValue(iconUrl))

  function onImageError() {
    isImageError.value = true
  }

  return {
    DEFAULT_BANNER,
    isImageError,
    showDefaultBanner,
    imgSrc,
    onImageError
  }
}
