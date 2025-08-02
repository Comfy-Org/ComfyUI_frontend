import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { type ReleaseNote, useReleaseService } from '@/services/releaseService'
import { useSettingStore } from '@/stores/settingStore'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import { compareVersions, stringToLocale } from '@/utils/formatUtil'

// Store for managing release notes
export const useReleaseStore = defineStore('release', () => {
  // State
  const releases = ref<ReleaseNote[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Services
  const releaseService = useReleaseService()
  const systemStatsStore = useSystemStatsStore()
  const settingStore = useSettingStore()

  // Current ComfyUI version
  const currentComfyUIVersion = computed(
    () => systemStatsStore?.systemStats?.system?.comfyui_version ?? ''
  )

  // Release data from settings
  const locale = computed(() => settingStore.get('Comfy.Locale'))
  const releaseVersion = computed(() =>
    settingStore.get('Comfy.Release.Version')
  )
  const releaseStatus = computed(() => settingStore.get('Comfy.Release.Status'))
  const releaseTimestamp = computed(() =>
    settingStore.get('Comfy.Release.Timestamp')
  )

  // Most recent release
  const recentRelease = computed(() => {
    return releases.value[0] ?? null
  })

  // 3 most recent releases
  const recentReleases = computed(() => {
    return releases.value.slice(0, 3)
  })

  // Helper constants
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000 // 3 days

  // New version available?
  const isNewVersionAvailable = computed(
    () =>
      !!recentRelease.value &&
      compareVersions(
        recentRelease.value.version,
        currentComfyUIVersion.value
      ) > 0
  )

  const isLatestVersion = computed(
    () =>
      !!recentRelease.value &&
      !compareVersions(recentRelease.value.version, currentComfyUIVersion.value)
  )

  const hasMediumOrHighAttention = computed(() =>
    recentReleases.value
      .slice(0, -1)
      .some(
        (release) =>
          release.attention === 'medium' || release.attention === 'high'
      )
  )

  // Show toast if needed
  const shouldShowToast = computed(() => {
    if (!isNewVersionAvailable.value) {
      return false
    }

    // Skip if low attention
    if (!hasMediumOrHighAttention.value) {
      return false
    }

    // Skip if user already skipped or changelog seen
    if (
      releaseVersion.value === recentRelease.value?.version &&
      !['skipped', 'changelog seen'].includes(releaseStatus.value)
    ) {
      return false
    }

    return true
  })

  // Show red-dot indicator
  const shouldShowRedDot = computed(() => {
    // Already latest → no dot
    if (!isNewVersionAvailable.value) {
      return false
    }

    const { version } = recentRelease.value

    // Changelog seen → clear dot
    if (
      releaseVersion.value === version &&
      releaseStatus.value === 'changelog seen'
    ) {
      return false
    }

    // Attention medium / high (levels 2 & 3)
    if (hasMediumOrHighAttention.value) {
      // Persist until changelog is opened
      return true
    }

    // Attention low (level 1) and skipped → keep up to 3 d
    if (
      releaseVersion.value === version &&
      releaseStatus.value === 'skipped' &&
      releaseTimestamp.value &&
      Date.now() - releaseTimestamp.value >= THREE_DAYS_MS
    ) {
      return false
    }

    // Not skipped → show
    return true
  })

  // Show "What's New" popup
  const shouldShowPopup = computed(() => {
    if (!isLatestVersion.value) {
      return false
    }

    // Hide if already seen
    if (
      releaseVersion.value === recentRelease.value.version &&
      releaseStatus.value === "what's new seen"
    ) {
      return false
    }

    return true
  })

  // Action handlers for user interactions
  async function handleSkipRelease(version: string): Promise<void> {
    if (
      version !== recentRelease.value?.version ||
      releaseStatus.value === 'changelog seen'
    ) {
      return
    }

    await settingStore.set('Comfy.Release.Version', version)
    await settingStore.set('Comfy.Release.Status', 'skipped')
    await settingStore.set('Comfy.Release.Timestamp', Date.now())
  }

  async function handleShowChangelog(version: string): Promise<void> {
    if (version !== recentRelease.value?.version) {
      return
    }

    await settingStore.set('Comfy.Release.Version', version)
    await settingStore.set('Comfy.Release.Status', 'changelog seen')
    await settingStore.set('Comfy.Release.Timestamp', Date.now())
  }

  async function handleWhatsNewSeen(version: string): Promise<void> {
    if (version !== recentRelease.value?.version) {
      return
    }

    await settingStore.set('Comfy.Release.Version', version)
    await settingStore.set('Comfy.Release.Status', "what's new seen")
    await settingStore.set('Comfy.Release.Timestamp', Date.now())
  }

  // Fetch releases from API
  async function fetchReleases(): Promise<void> {
    if (isLoading.value) return

    isLoading.value = true
    error.value = null

    try {
      // Ensure system stats are loaded
      if (!systemStatsStore.systemStats) {
        await systemStatsStore.fetchSystemStats()
      }

      const fetchedReleases = await releaseService.getReleases({
        project: 'comfyui',
        current_version: currentComfyUIVersion.value,
        form_factor: systemStatsStore.getFormFactor(),
        locale: stringToLocale(locale.value)
      })

      if (fetchedReleases !== null) {
        releases.value = fetchedReleases
      } else if (releaseService.error.value) {
        error.value = releaseService.error.value
      }
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Unknown error occurred'
    } finally {
      isLoading.value = false
    }
  }

  // Initialize store
  async function initialize(): Promise<void> {
    await fetchReleases()
  }

  return {
    releases,
    isLoading,
    error,
    recentRelease,
    recentReleases,
    shouldShowToast,
    shouldShowRedDot,
    shouldShowPopup,
    shouldShowUpdateButton: isNewVersionAvailable,
    handleSkipRelease,
    handleShowChangelog,
    handleWhatsNewSeen,
    fetchReleases,
    initialize
  }
})
