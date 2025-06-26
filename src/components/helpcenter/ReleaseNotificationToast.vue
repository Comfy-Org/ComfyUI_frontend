<template>
  <div v-if="shouldShow" class="release-toast-popup">
    <div class="release-notification-toast">
      <!-- Header section with icon and text -->
      <div class="toast-header">
        <div class="toast-icon">
          <i class="pi pi-download" />
        </div>
        <div class="toast-text">
          <div class="toast-title">
            {{ $t('releaseToast.newVersionAvailable') }}
          </div>
          <div class="toast-version-badge">
            {{ latestRelease?.version }}
          </div>
        </div>
      </div>

      <!-- Actions section -->
      <div class="toast-actions-section">
        <div class="actions-row">
          <div class="left-actions">
            <a
              class="learn-more-link"
              :href="changelogUrl"
              target="_blank"
              rel="noopener,noreferrer"
              @click="handleLearnMore"
            >
              {{ $t('releaseToast.whatsNew') }}
            </a>
          </div>
          <div class="right-actions">
            <button class="skip-button" @click="handleSkip">
              {{ $t('releaseToast.skip') }}
            </button>
            <button class="cta-button" @click="handleUpdate">
              {{ $t('releaseToast.update') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ReleaseNote } from '@/services/releaseService'
import { useReleaseStore } from '@/stores/releaseStore'
import { formatVersionAnchor } from '@/utils/formatUtil'

const { locale } = useI18n()
const releaseStore = useReleaseStore()

// Local state for dismissed status
const isDismissed = ref(false)

// Get latest release from store
const latestRelease = computed<ReleaseNote | null>(
  () => releaseStore.recentRelease
)

// Show toast when new version available and not dismissed
const shouldShow = computed(
  () => releaseStore.shouldShowToast && !isDismissed.value
)

// Generate changelog URL with version anchor (language-aware)
const changelogUrl = computed(() => {
  const isChineseLocale = locale.value === 'zh'
  const baseUrl = isChineseLocale
    ? 'https://docs.comfy.org/zh-CN/changelog'
    : 'https://docs.comfy.org/changelog'

  if (latestRelease.value?.version) {
    const versionAnchor = formatVersionAnchor(latestRelease.value.version)
    return `${baseUrl}#${versionAnchor}`
  }
  return baseUrl
})

// Auto-hide timer
let hideTimer: ReturnType<typeof setTimeout> | null = null

const startAutoHide = () => {
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    dismissToast()
  }, 8000) // 8 second auto-hide
}

const clearAutoHide = () => {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

const dismissToast = () => {
  isDismissed.value = true
  clearAutoHide()
}

const handleSkip = () => {
  if (latestRelease.value) {
    void releaseStore.handleSkipRelease(latestRelease.value.version)
  }
  dismissToast()
}

const handleLearnMore = () => {
  if (latestRelease.value) {
    void releaseStore.handleShowChangelog(latestRelease.value.version)
  }
  // Do not dismiss; anchor will navigate in new tab but keep toast? spec maybe wants dismiss? We'll dismiss.
  dismissToast()
}

const handleUpdate = () => {
  window.open('https://docs.comfy.org/installation/update_comfyui', '_blank')
  dismissToast()
}

// Learn more handled by anchor href

// Start auto-hide when toast becomes visible
watch(shouldShow, (isVisible) => {
  if (isVisible) {
    startAutoHide()
  } else {
    clearAutoHide()
  }
})

// Initialize on mount
onMounted(async () => {
  // Fetch releases if not already loaded
  if (!releaseStore.releases.length) {
    await releaseStore.fetchReleases()
  }
})
</script>

<style scoped>
/* Toast popup - positioning handled by parent */
.release-toast-popup {
  position: absolute;
  bottom: 1rem;
  z-index: 1000;
  pointer-events: auto;
}

/* Sidebar positioning classes applied by parent - matching help center */
.release-toast-popup.sidebar-left {
  left: 1rem;
}

.release-toast-popup.sidebar-left.small-sidebar {
  left: 1rem;
}

.release-toast-popup.sidebar-right {
  right: 1rem;
}

/* Main toast container */
.release-notification-toast {
  width: 448px;
  padding: 16px 16px 8px;
  background: #353535;
  box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.25);
  border-radius: 12px;
  outline: 1px solid #4e4e4e;
  outline-offset: -1px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Header section */
.toast-header {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

/* Icon container */
.toast-icon {
  width: 42px;
  height: 42px;
  padding: 10px;
  background: rgba(0, 122, 255, 0.2);
  border-radius: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.toast-icon i {
  color: #007aff;
  font-size: 16px;
}

/* Text content */
.toast-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.toast-title {
  color: white;
  font-size: 14px;
  font-family: 'Satoshi', sans-serif;
  font-weight: 500;
  line-height: 18.2px;
}

.toast-version-badge {
  color: #a0a1a2;
  font-size: 12px;
  font-family: 'Satoshi', sans-serif;
  font-weight: 500;
  line-height: 15.6px;
}

/* Actions section */
.toast-actions-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.actions-row {
  padding-left: 58px; /* Align with text content */
  padding-right: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.left-actions {
  display: flex;
  align-items: center;
}

/* Learn more link - simple text link */
.learn-more-link {
  color: #60a5fa;
  font-size: 12px;
  font-family: 'Inter', sans-serif;
  font-weight: 500;
  line-height: 15.6px;
  text-decoration: none;
}

.learn-more-link:hover {
  text-decoration: underline;
}

.right-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* Button styles */
.skip-button {
  padding: 8px 16px;
  background: #353535;
  border-radius: 6px;
  outline: 1px solid #4e4e4e;
  outline-offset: -1px;
  border: none;
  color: #aeaeb2;
  font-size: 12px;
  font-family: 'Inter', sans-serif;
  font-weight: 500;
  cursor: pointer;
}

.skip-button:hover {
  background: #404040;
}

.cta-button {
  padding: 8px 16px;
  background: white;
  border-radius: 6px;
  outline: 1px solid #4e4e4e;
  outline-offset: -1px;
  border: none;
  color: black;
  font-size: 12px;
  font-family: 'Inter', sans-serif;
  font-weight: 500;
  cursor: pointer;
}

.cta-button:hover {
  background: #f0f0f0;
}
</style>
