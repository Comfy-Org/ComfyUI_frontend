<template>
  <div
    v-if="shouldShow"
    class="release-toast-popup"
  >
    <div
      class="flex max-h-96 w-96 flex-col rounded-lg border border-border-default bg-base-background shadow-[1px_1px_8px_0_rgba(0,0,0,0.4)]"
    >
      <!-- Main content -->
      <div class="flex min-h-0 flex-1 flex-col gap-4 p-4">
        <!-- Header section with icon and text -->
        <div class="flex items-center gap-4">
          <div
            class="flex shrink-0 items-center justify-center rounded-lg bg-primary-background-hover p-3"
          >
            <i class="icon-[lucide--rocket] h-4 w-4 text-white" />
          </div>
          <div class="flex flex-col gap-1">
            <div
              class="text-sm leading-[1.429] font-normal text-base-foreground"
            >
              {{ $t('releaseToast.newVersionAvailable') }}
            </div>
            <div
              class="text-sm leading-[1.21] font-normal text-muted-foreground"
            >
              {{ latestRelease?.version }}
            </div>
          </div>
        </div>

        <!-- Description section -->
        <div
          class="min-h-0 flex-1 overflow-y-auto pl-14 text-sm leading-[1.21] font-normal text-muted-foreground"
          v-html="formattedContent"
        />
      </div>

      <!-- Footer section -->
      <div class="flex items-center justify-between px-4 pb-4">
        <a
          class="flex items-center gap-2 py-1 text-sm font-normal text-muted-foreground hover:text-base-foreground"
          :href="changelogUrl"
          target="_blank"
          rel="noopener noreferrer"
          @click="handleLearnMore"
        >
          <i class="icon-[lucide--external-link] h-4 w-4" />
          {{ $t('releaseToast.whatsNew') }}
        </a>
        <div class="flex items-center gap-4">
          <button
            class="h-6 cursor-pointer border-none bg-transparent px-0 text-sm font-normal text-muted-foreground hover:text-base-foreground"
            @click="handleSkip"
          >
            {{ $t('releaseToast.skip') }}
          </button>
          <button
            class="h-10 cursor-pointer rounded-lg border-none bg-secondary-background px-4 text-sm font-normal text-base-foreground hover:bg-secondary-background-hover"
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
import { default as DOMPurify } from 'dompurify'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useErrorHandling } from '@/composables/useErrorHandling'
import { useExternalLink } from '@/composables/useExternalLink'
import { useCommandStore } from '@/stores/commandStore'
import { isElectron } from '@/utils/envUtil'
import { formatVersionAnchor } from '@/utils/formatUtil'
import { renderMarkdownToHtml } from '@/utils/markdownRendererUtil'

import type { ReleaseNote } from '../common/releaseService'
import { useReleaseStore } from '../common/releaseStore'

const { buildDocsUrl } = useExternalLink()
const { toastErrorHandler } = useErrorHandling()
const releaseStore = useReleaseStore()
const { t } = useI18n()

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
  const changelogBaseUrl = buildDocsUrl('/changelog', { includeLocale: true })
  if (latestRelease.value?.version) {
    const versionAnchor = formatVersionAnchor(latestRelease.value.version)
    return `${changelogBaseUrl}#${versionAnchor}`
  }
  return changelogBaseUrl
})

const formattedContent = computed(() => {
  if (!latestRelease.value?.content) {
    return DOMPurify.sanitize(`<p>${t('releaseToast.description')}</p>`)
  }

  try {
    const markdown = latestRelease.value.content
    // Remove the h1 title line and images for toast mode
    const contentWithoutTitle = markdown.replace(/^# .+$/m, '')
    const contentWithoutImages = contentWithoutTitle.replace(
      /!\[.*?\]\(.*?\)/g,
      ''
    )

    // Check if there's meaningful content left after cleanup
    const trimmedContent = contentWithoutImages.trim()
    if (!trimmedContent || trimmedContent.replace(/\s+/g, '') === '') {
      return DOMPurify.sanitize(`<p>${t('releaseToast.description')}</p>`)
    }

    // renderMarkdownToHtml already sanitizes with DOMPurify, so this is safe
    return renderMarkdownToHtml(contentWithoutImages)
  } catch (error) {
    console.error('Error parsing markdown:', error)
    // Fallback to plain text with line breaks - sanitize the HTML we create
    const fallbackContent = latestRelease.value.content.replace(/\n/g, '<br>')
    return fallbackContent.trim()
      ? DOMPurify.sanitize(fallbackContent)
      : DOMPurify.sanitize(`<p>${t('releaseToast.description')}</p>`)
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

const handleUpdate = async () => {
  if (isElectron()) {
    try {
      await useCommandStore().execute('Comfy-Desktop.CheckForUpdates')
      dismissToast()
    } catch (error) {
      toastErrorHandler(error)
    }
    return
  }

  window.open(
    buildDocsUrl('/installation/update_comfyui', { includeLocale: true }),
    '_blank'
  )
  dismissToast()
}

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
.release-toast-popup.sidebar-left,
.release-toast-popup.sidebar-left.small-sidebar {
  left: 1rem;
}

.release-toast-popup.sidebar-right {
  right: 1rem;
}
</style>
