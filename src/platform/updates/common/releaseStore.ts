import { useTelemetry } from '@comfyorg/telemetry'
import { until } from '@vueuse/core'
import { defineStore } from 'pinia'
import { compare, valid } from 'semver'
import { computed, ref, watch } from 'vue'
import type { ComputedRef } from 'vue'

import { isCloud, isDesktop } from '@/platform/distribution/types'
import { useOnboardingOverlayStore } from '@/platform/onboarding/onboardingOverlayStore'
import { useOnboardingTourStore } from '@/platform/onboarding/onboardingTourStore'
import { pendingServerFact } from '@/platform/serverFacts/pendingServerFact'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import { stringToLocale } from '@/utils/formatUtil'

import { useReleaseService } from './releaseService'
import type { ReleaseNote } from './releaseService'

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
  const onboardingTourStore = useOnboardingTourStore()
  const onboardingOverlayStore = useOnboardingOverlayStore()

  const currentVersion = computed(
    () => systemStatsStore.systemStats?.system.comfyui_version ?? ''
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
  const showVersionUpdates = computed(() =>
    settingStore.get('Comfy.Notification.ShowVersionUpdates')
  )

  // Most recent release
  const recentRelease = computed(() => {
    return releases.value.at(0) ?? null
  })

  // 3 most recent releases
  const recentReleases = computed(() => {
    return releases.value.slice(0, 3)
  })

  // Helper constants
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000 // 3 days

  const compareVersions = (
    releaseVersion: string,
    currentVer: string
  ): number => {
    if (valid(releaseVersion) && valid(currentVer)) {
      return compare(releaseVersion, currentVer)
    }
    // Non-semver (e.g. git hash): assume different = newer
    return releaseVersion === currentVer ? 0 : 1
  }

  // New version available?
  const isNewVersionAvailable = computed(
    () =>
      !!recentRelease.value &&
      compareVersions(
        recentRelease.value.version,
        currentVersion.value || '0.0.0'
      ) > 0
  )

  const isLatestVersion = computed(
    () =>
      !!recentRelease.value &&
      compareVersions(
        recentRelease.value.version,
        currentVersion.value || '0.0.0'
      ) === 0
  )

  const versionsComparable = computed(() =>
    pendingServerFact(
      'BE-27366',
      !!recentRelease.value &&
        !!valid(recentRelease.value.version) &&
        !!valid(currentVersion.value)
    )
  )

  const hasMediumOrHighAttention = computed(() => {
    const attention = recentRelease.value?.attention
    return attention === 'medium' || attention === 'high'
  })

  // Show toast if needed
  const shouldShowToast = computed(() => {
    if (!isDesktop || isCloud) {
      return false
    }

    if (!showVersionUpdates.value) {
      return false
    }

    if (!isNewVersionAvailable.value) {
      return false
    }

    if (!hasMediumOrHighAttention.value) {
      return false
    }

    if (
      releaseVersion.value === recentRelease.value?.version &&
      ['skipped', 'changelog seen'].includes(releaseStatus.value)
    ) {
      return false
    }

    return true
  })

  const shouldShowRedDot = computed(() => {
    if (isCloud) {
      return false
    }

    if (!versionsComparable.value) {
      return false
    }

    if (!showVersionUpdates.value) {
      return false
    }

    if (!isNewVersionAvailable.value) {
      return false
    }

    const release = recentRelease.value
    if (!release) return false
    const { version } = release

    if (
      releaseVersion.value === version &&
      releaseStatus.value === 'changelog seen'
    ) {
      return false
    }

    if (hasMediumOrHighAttention.value) {
      return true
    }

    if (
      releaseVersion.value === version &&
      releaseStatus.value === 'skipped' &&
      releaseTimestamp.value &&
      Date.now() - releaseTimestamp.value >= THREE_DAYS_MS
    ) {
      return false
    }

    return true
  })

  const shouldShowPopup = computed(() => {
    if (onboardingTourStore.activeTour === 'firstRun') {
      return false
    }

    if (onboardingOverlayStore.active) {
      return false
    }

    if (!showVersionUpdates.value) {
      return false
    }

    if (!recentRelease.value) {
      return false
    }

    const skipVersionCheck = isCloud && !valid(currentVersion.value)
    if (
      !skipVersionCheck &&
      (!versionsComparable.value || !isLatestVersion.value)
    ) {
      return false
    }

    if (
      releaseVersion.value === recentRelease.value.version &&
      releaseStatus.value === "what's new seen"
    ) {
      return false
    }

    return true
  })

  const telemetry = useTelemetry()
  const shownSurfaces = new Set<string>()

  function reportShown(
    surface: 'red_dot' | 'whats_new_popup' | 'release_toast'
  ): void {
    const release = recentRelease.value
    if (!release) return
    const key = `${surface}:${release.version}`
    if (shownSurfaces.has(key)) return
    shownSurfaces.add(key)
    telemetry?.trackVersionUpdateSurfaceShown({
      surface,
      release_version: release.version,
      current_version: currentVersion.value,
      attention: release.attention
    })
  }

  function reportResolved(
    version: string,
    action: 'changelog_opened' | 'skipped' | 'whats_new_seen' | 'update_clicked'
  ): void {
    telemetry?.trackVersionUpdateSurfaceResolved({
      release_version: version,
      action
    })
  }

  function watchSurface(
    visible: ComputedRef<boolean>,
    surface: 'red_dot' | 'whats_new_popup' | 'release_toast'
  ): void {
    watch(
      () => (visible.value ? recentRelease.value?.version : undefined),
      (version) => {
        if (version) reportShown(surface)
      }
    )
  }

  watchSurface(shouldShowRedDot, 'red_dot')
  watchSurface(shouldShowPopup, 'whats_new_popup')
  watchSurface(shouldShowToast, 'release_toast')

  function handleUpdateClicked(version: string): void {
    reportResolved(version, 'update_clicked')
  }

  async function handleSkipRelease(version: string): Promise<void> {
    if (
      version !== recentRelease.value?.version ||
      releaseStatus.value === 'changelog seen'
    ) {
      return
    }

    await settingStore.setMany({
      'Comfy.Release.Version': version,
      'Comfy.Release.Status': 'skipped',
      'Comfy.Release.Timestamp': Date.now()
    })
    reportResolved(version, 'skipped')
  }

  async function handleShowChangelog(version: string): Promise<void> {
    if (version !== recentRelease.value?.version) {
      return
    }

    await settingStore.setMany({
      'Comfy.Release.Version': version,
      'Comfy.Release.Status': 'changelog seen',
      'Comfy.Release.Timestamp': Date.now()
    })
    reportResolved(version, 'changelog_opened')
  }

  async function handleWhatsNewSeen(version: string): Promise<void> {
    if (version !== recentRelease.value?.version) {
      return
    }

    await settingStore.setMany({
      'Comfy.Release.Version': version,
      'Comfy.Release.Status': "what's new seen",
      'Comfy.Release.Timestamp': Date.now()
    })
    reportResolved(version, 'whats_new_seen')
  }

  // Fetch releases from API
  async function fetchReleases(): Promise<void> {
    if (isLoading.value) {
      return
    }

    if (!isCloud && !showVersionUpdates.value) {
      return
    }

    // Skip fetching if API nodes are disabled via argv
    if (
      systemStatsStore.systemStats?.system.argv?.includes('--disable-api-nodes')
    ) {
      return
    }
    isLoading.value = true
    error.value = null

    try {
      // Ensure system stats are loaded
      if (!systemStatsStore.systemStats) {
        await until(systemStatsStore.isInitialized)
      }

      const fetchedReleases = await releaseService.getReleases(
        {
          project: isCloud ? 'cloud' : 'comfyui',
          current_version: currentVersion.value,
          form_factor: systemStatsStore.getFormFactor(),
          locale: stringToLocale(locale.value)
        },
        {
          deployEnvironment:
            systemStatsStore.systemStats?.system.deploy_environment
        }
      )

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
    handleUpdateClicked,
    fetchReleases,
    initialize
  }
})
