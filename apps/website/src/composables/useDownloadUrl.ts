import { computed, onMounted, ref } from 'vue'

import { externalLinks } from '@/config/routes'

export const downloadUrls = {
  windows: 'https://download.comfy.org/windows/nsis/x64',
  macArm: 'https://download.comfy.org/mac/dmg/arm64'
} as const

type DetectedPlatform = 'windows' | 'mac' | null

function isMobile(ua: string): boolean {
  return /iphone|ipad|ipod|android/.test(ua)
}

function detectPlatform(ua: string): DetectedPlatform {
  if (isMobile(ua)) return null
  if (ua.includes('win')) return 'windows'
  if (ua.includes('macintosh') || ua.includes('mac os x')) return 'mac'
  return null
}

// TODO: Only Windows x64 and macOS arm64 are available today.
// When Linux and/or macIntel builds are added, extend detection and URLs here.
export function useDownloadUrl() {
  const platform = ref<DetectedPlatform>(null)
  /**
   * Flips to `true` after the post-mount UA check has run, regardless of
   * whether the check produced a platform. Lets the button distinguish three
   * states for layout:
   *   - `!detected`            → SSR / pre-hydration, render nothing so we
   *                              don't ship Windows+Mac buttons in the HTML
   *                              and then flicker them away on hydration.
   *   - `detected && platform` → single button with the matched OS.
   *   - `detected && !platform`→ UA check came back empty (mobile, Linux,
   *                              private-mode or stripped UA); render both
   *                              Windows AND Mac as a fallback so the user
   *                              isn't stranded with nothing to click — the
   *                              field-reported failure mode on this page.
   */
  const detected = ref(false)

  const downloadUrl = computed(() => {
    if (platform.value === 'windows') return downloadUrls.windows
    if (platform.value === 'mac') return downloadUrls.macArm
    return externalLinks.github
  })

  onMounted(() => {
    platform.value = detectPlatform(navigator.userAgent.toLowerCase())
    detected.value = true
  })

  return { downloadUrl, platform, detected }
}
