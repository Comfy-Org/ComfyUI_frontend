<template>
  <div v-if="shouldShow" class="release-toast-popup">
    <div class="release-notification-toast">
      <!-- Header section with icon and text -->
      <div class="toast-header">
        <div class="toast-icon">
          <i class="icon-[lucide--rocket]" />
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

      <!-- Description section -->
      <div class="toast-description" v-html="formattedContent"></div>

      <!-- Footer section -->
      <div class="toast-footer">
        <a
          class="learn-more-link flex items-center gap-2 text-sm font-normal py-1"
          :href="changelogUrl"
          target="_blank"
          rel="noopener,noreferrer"
          @click="handleLearnMore"
        >
          <i class="icon-[lucide--external-link]"></i>
          {{ $t('releaseToast.whatsNew') }}
        </a>
        <div class="footer-actions flex items-center gap-4">
          <button
            class="action-secondary h-6 px-0 bg-transparent border-none text-sm font-normal cursor-pointer"
            @click="handleSkip"
          >
            {{ $t('releaseToast.skip') }}
          </button>
          <button
            class="action-primary h-10 px-4 border-none text-sm font-normal rounded-lg cursor-pointer"
            @click="handleUpdate"
          >
            {{ $t('releaseToast.update') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatVersionAnchor } from '@/utils/formatUtil'
import { renderMarkdownToHtml } from '@/utils/markdownRendererUtil'

import type { ReleaseNote } from '../common/releaseService'
import { useReleaseStore } from '../common/releaseStore'

const { locale } = useI18n()
const releaseStore = useReleaseStore()

// Local state for dismissed status
const isDismissed = ref(false)

// Get latest release from store
const latestRelease = computed<ReleaseNote | null>(() => {
  return releaseStore.recentRelease
})

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

const formattedContent = computed(() => {
  if (!latestRelease.value?.content) {
    return `<p>Check out the latest improvements and features in this update.</p>`
  }

  try {
    const markdown = latestRelease.value.content
    // Remove the h1 title line for toast mode
    const contentWithoutTitle = markdown.replace(/^# .+$/m, '')
    return renderMarkdownToHtml(contentWithoutTitle)
  } catch (error) {
    console.error('Error parsing markdown:', error)
    // Fallback to plain text with line breaks
    return latestRelease.value.content.replace(/\n/g, '<br>')
  }
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

// Expose methods for testing
defineExpose({
  handleSkip,
  handleLearnMore,
  handleUpdate
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
  width: 384px;
  background: var(--interface-menu-surface);
  box-shadow: 1px 1px 8px 0 rgb(0 0 0 / 0.2);
  border-radius: 8px;
  border: 1px solid var(--interface-menu-stroke);
  display: flex;
  flex-direction: column;
}

/* Header section */
.toast-header {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 16px 16px 0;
}

/* Icon container */
.toast-icon {
  width: 40px;
  height: 40px;
  padding: 12px;
  background: var(--primary-background);
  border-radius: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.toast-icon i {
  color: white;
  font-size: 16px;
}

/* Text content */
.toast-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.toast-title {
  color: var(--text-primary);
  font-size: 14px;
  font-family: Inter, sans-serif;
  font-weight: 400;
  line-height: 1.429;
}

.toast-version-badge {
  color: var(--text-secondary);
  font-size: 14px;
  font-family: Inter, sans-serif;
  font-weight: 400;
  line-height: 1.21;
}

/* Description section */
.toast-description {
  color: var(--text-primary);
  font-size: 14px;
  font-family: Inter, sans-serif;
  font-weight: 400;
  line-height: 1.5;
  padding: 16px;
  padding-left: 72px;
  word-wrap: break-word;
}

/* Style the markdown content */
.toast-description :deep(*) {
  box-sizing: border-box;
}

.toast-description :deep(h1) {
  color: var(--text-primary);
  font-family: Inter, sans-serif;
  font-size: 14px;
  margin: 0 0 8px;
}

.toast-description :deep(p) {
  color: var(--text-secondary);
  font-family: Inter, sans-serif;
  margin: 8px 0;
}

.toast-description :deep(ul),
.toast-description :deep(ol) {
  margin-bottom: 0;
  padding-left: 0;
  list-style: none;
}

.toast-description :deep(li) {
  margin-bottom: 6px;
  position: relative;
  padding-left: 18px;
  color: var(--text-secondary);
  font-family: Inter, sans-serif;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.21;
}

.toast-description :deep(li::before) {
  content: '';
  position: absolute;
  left: 4px;
  top: 7px;
  width: 6px;
  height: 6px;
  border: 2px solid var(--text-secondary);
  border-radius: 50%;
  background: transparent;
}

.toast-description :deep(li strong) {
  color: var(--text-secondary);
  font-family: Inter, sans-serif;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.21;
  margin-right: 4px;
}

.toast-description :deep(code) {
  background-color: var(--input-surface);
  border: 1px solid var(--interface-menu-stroke);
  border-radius: 4px;
  padding: 2px 6px;
  color: var(--text-primary);
  white-space: nowrap;
}

/* Footer section */
.toast-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 0 16px 16px;
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.learn-more-link {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 400;
  line-height: 1.21;
  text-decoration: none;
  padding: 4px 0;
  font-family: Inter, sans-serif;
}

.learn-more-link:hover {
  color: var(--text-primary);
}

.learn-more-link i {
  width: 16px;
  height: 16px;
}

.action-secondary {
  height: 24px;
  padding: 4px 0;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 400;
  line-height: 1.21;
  cursor: pointer;
  border-radius: 4px;
  font-family: Inter, sans-serif;
}

.action-secondary:hover {
  color: var(--text-primary);
}

.action-primary {
  height: 40px;
  padding: 8px 16px;
  background: var(--interface-menu-component-surface-hovered);
  border-radius: 8px;
  border: none;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 400;
  line-height: 1.21;
  cursor: pointer;
  font-family: Inter, sans-serif;
}

.action-primary:hover {
  background: var(--button-hover-surface);
}
</style>
