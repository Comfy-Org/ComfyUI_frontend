<template>
  <div v-if="shouldShow" class="whats-new-popup-container left-4">
    <div
      class="whats-new-popup relative flex w-100 max-w-100 flex-col rounded-lg border bg-popover shadow-md"
      @click.stop
    >
      <Button
        class="absolute top-2 right-2 z-10 size-8 rounded-lg p-2 opacity-50"
        :aria-label="$t('g.close')"
        size="icon-sm"
        variant="muted-textonly"
        @click="closePopup"
      >
        <i class="icon-[lucide--x]" />
      </Button>

      <div class="flex flex-1 flex-col gap-4">
        <SanitizedHtml
          class="content-text max-h-96 overflow-y-auto"
          :html="formattedContent"
        />
      </div>

      <div class="flex items-center justify-between gap-4 px-4 pb-4">
        <a
          class="flex items-center gap-2 py-1 text-sm text-muted-foreground no-underline hover:text-foreground"
          :href="changelogUrl"
          target="_blank"
          rel="noopener noreferrer"
          @click="closePopup"
        >
          <i class="icon-[lucide--external-link]" />
          {{ $t('whatsNewPopup.learnMore') }}
        </a>
        <div class="flex items-center gap-4">
          <Button
            class="h-8"
            size="sm"
            variant="muted-textonly"
            @click="closePopup"
          >
            {{ $t('whatsNewPopup.later') }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { default as DOMPurify } from 'dompurify'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import SanitizedHtml from '@comfyorg/design-system/common/SanitizedHtml'
import Button from '@comfyorg/design-system/button/Button'
import { useExternalLink } from '@/composables/useExternalLink'
import { formatVersionAnchor } from '@/utils/formatUtil'
import { renderMarkdownToHtml } from '@/utils/markdownRendererUtil'

import type { ReleaseNote } from '@/platform/updates/common/releaseService'
import { useReleaseStore } from '@/platform/updates/common/releaseStore'

const { buildDocsUrl } = useExternalLink()
const releaseStore = useReleaseStore()
const { t } = useI18n()

// Define emits
const emit = defineEmits<{
  'whats-new-dismissed': []
}>()

// Local state for dismissed status
const isDismissed = ref(false)

// Get latest release from store
const latestRelease = computed<ReleaseNote | null>(() => {
  return releaseStore.recentRelease
})

// Show popup when on latest version and not dismissed
const shouldShow = computed(
  () => releaseStore.shouldShowPopup && !isDismissed.value
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
    return DOMPurify.sanitize(`<p>${t('whatsNewPopup.noReleaseNotes')}</p>`)
  }

  try {
    const markdown = latestRelease.value.content

    // Check if content is meaningful (not just whitespace)
    const trimmedContent = markdown.trim()
    if (!trimmedContent || trimmedContent.replace(/\s+/g, '') === '') {
      return DOMPurify.sanitize(`<p>${t('whatsNewPopup.noReleaseNotes')}</p>`)
    }

    // Extract image and remaining content separately
    const imageMatch = markdown.match(/!\[.*?\]\(.*?\)/)
    const image = imageMatch ? imageMatch[0] : ''

    // Remove image from content but keep original title
    const contentWithoutImage = markdown.replace(/!\[.*?\]\(.*?\)/, '').trim()

    // Reorder: image first, then original content
    const reorderedContent = [image, contentWithoutImage]
      .filter(Boolean)
      .join('\n\n')

    // renderMarkdownToHtml already sanitizes with DOMPurify, so this is safe
    return renderMarkdownToHtml(reorderedContent)
  } catch (error) {
    console.error('Error parsing markdown:', error)
    // Fallback to plain text with line breaks - sanitize the HTML we create
    const fallbackContent = latestRelease.value.content.replace(/\n/g, '<br>')
    return fallbackContent.trim()
      ? DOMPurify.sanitize(fallbackContent)
      : DOMPurify.sanitize(`<p>${t('whatsNewPopup.noReleaseNotes')}</p>`)
  }
})

const show = () => {
  isDismissed.value = false
}

const hide = () => {
  isDismissed.value = true
  emit('whats-new-dismissed')
}

const closePopup = async () => {
  // Mark "what's new" seen when popup is closed
  if (latestRelease.value) {
    await releaseStore.handleWhatsNewSeen(latestRelease.value.version)
  }
  hide()
}

// Initialize on mount
onMounted(async () => {
  // Fetch releases if not already loaded
  if (!releaseStore.releases.length) {
    await releaseStore.fetchReleases()
  }
})

// Expose methods for parent component and tests
defineExpose({
  show,
  hide,
  closePopup
})
</script>

<style scoped>
/* Popup container - positioning handled by parent */
.whats-new-popup-container {
  --whats-new-popup-bottom: 1rem;

  position: absolute;
  bottom: var(--whats-new-popup-bottom);
  z-index: 1000;
  pointer-events: auto;
}

.content-text {
  color: var(--foreground);
  font-size: 14px;
  line-height: 1.5;
  word-wrap: break-word;
  padding: 0 1rem;
}

.content-text :deep(h1) {
  color: var(--muted-foreground);
  font-size: 14px;
  font-weight: 400;
  margin-top: 1rem;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* What's new title - targets h2 or strong text after h1 */
.content-text :deep(h2),
/* stylelint-disable-next-line selector-max-type -- generated markdown offers no class hooks */
.content-text :deep(h1 + p strong) {
  color: var(--foreground);
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 8px;
  line-height: 1.429;
}

/* Regular paragraphs - short description */
.content-text :deep(p) {
  color: var(--muted-foreground);
  margin: 1rem 0;
}

/* List */
.content-text :deep(ul),
.content-text :deep(ol) {
  margin-bottom: 0;
  padding-left: 0;
  list-style: none;
}

.content-text :deep(ul:first-child),
.content-text :deep(ol:first-child) {
  margin-top: 0;
}

.content-text :deep(ul:last-child),
.content-text :deep(ol:last-child) {
  margin-bottom: 0;
}

.content-text :deep(li) {
  margin-bottom: 6px;
  position: relative;
  padding-left: 18px;
  color: var(--muted-foreground);
  font-size: 14px;
  font-weight: 400;
  line-height: 1.2102;
}

.content-text :deep(li:last-child) {
  margin-bottom: 0;
}

.content-text :deep(li::before) {
  content: '';
  position: absolute;
  left: 4px;
  top: 7px;
  width: 6px;
  height: 6px;
  border: 2px solid var(--muted-foreground);
  border-radius: 50%;
  background: transparent;
}

.content-text :deep(li strong) {
  color: var(--muted-foreground);
  font-size: 14px;
  font-weight: 400;
  line-height: 1.2102;
  margin-right: 4px;
}

.content-text :deep(li p) {
  margin: 2px 0 0;
  display: inline;
}

/* Code styling */
.content-text :deep(code) {
  background-color: var(--input);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2px 6px;
  color: var(--foreground);
  white-space: nowrap;
}

.content-text :deep(img) {
  width: 100%;
  height: 200px;
  margin: 0 0 16px;
  object-fit: cover;
  display: block;
  border-radius: 8px;
}

.content-text :deep(img:first-child) {
  margin: -1rem -1rem 16px;
  width: calc(100% + 2rem);
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

/* Add border to content when image is present */
.content-text:has(img:first-child) {
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
  border-top: 1px solid var(--border);
  border-bottom-left-radius: 8px;
  border-bottom-right-radius: 8px;
  margin: -1px;
  margin-bottom: 0;
}

.content-text :deep(img + h1) {
  margin-top: 0;
}

/* Secondary headings */
.content-text :deep(h3) {
  color: var(--foreground);
  font-size: 16px;
  font-weight: 600;
  margin: 16px 0 8px;
  line-height: 1.4;
}
</style>
