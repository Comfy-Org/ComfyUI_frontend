<template>
  <div v-if="shouldShow" class="whats-new-popup-container">
    <!-- Arrow pointing to help center -->
    <div class="help-center-arrow">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="19"
        viewBox="0 0 16 19"
        fill="none"
      >
        <!-- Arrow fill -->
        <path
          d="M15.25 1.27246L15.25 17.7275L0.999023 9.5L15.25 1.27246Z"
          fill="#353535"
        />
        <!-- Top and bottom outlines only -->
        <path
          d="M15.25 1.27246L0.999023 9.5"
          stroke="#4e4e4e"
          stroke-width="1"
          fill="none"
        />
        <path
          d="M0.999023 9.5L15.25 17.7275"
          stroke="#4e4e4e"
          stroke-width="1"
          fill="none"
        />
      </svg>
    </div>

    <div class="whats-new-popup" @click.stop>
      <!-- Close Button -->
      <button
        class="close-button"
        :aria-label="$t('g.close')"
        @click="closePopup"
      >
        <div class="close-icon"></div>
      </button>

      <!-- Release Content -->
      <div class="popup-content">
        <div class="content-text" v-html="formattedContent"></div>

        <!-- Actions Section -->
        <div class="popup-actions">
          <a
            class="learn-more-link"
            :href="changelogUrl"
            target="_blank"
            rel="noopener,noreferrer"
            @click="closePopup"
          >
            {{ $t('whatsNewPopup.learnMore') }}
          </a>
          <!-- TODO: CTA button -->
          <!-- <button class="cta-button" @click="handleCTA">CTA</button> -->
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { marked } from 'marked'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ReleaseNote } from '@/services/releaseService'
import { useReleaseStore } from '@/stores/releaseStore'
import { formatVersionAnchor } from '@/utils/formatUtil'

const { locale, t } = useI18n()
const releaseStore = useReleaseStore()

// Local state for dismissed status
const isDismissed = ref(false)

// Get latest release from store
const latestRelease = computed<ReleaseNote | null>(
  () => releaseStore.recentRelease
)

// Show popup when on latest version and not dismissed
const shouldShow = computed(
  () => releaseStore.shouldShowPopup && !isDismissed.value
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

// Format release content for display using marked
const formattedContent = computed(() => {
  if (!latestRelease.value?.content) {
    return `<p>${t('whatsNewPopup.noReleaseNotes')}</p>`
  }

  try {
    // Use marked to parse markdown to HTML
    return marked(latestRelease.value.content, {
      gfm: true // Enable GitHub Flavored Markdown
    })
  } catch (error) {
    console.error('Error parsing markdown:', error)
    // Fallback to plain text with line breaks
    return latestRelease.value.content.replace(/\n/g, '<br>')
  }
})

const show = () => {
  isDismissed.value = false
}

const hide = () => {
  isDismissed.value = true
}

const closePopup = async () => {
  // Mark "what's new" seen when popup is closed
  if (latestRelease.value) {
    await releaseStore.handleWhatsNewSeen(latestRelease.value.version)
  }
  hide()
}

// Learn more handled by anchor href

// const handleCTA = async () => {
//   window.open('https://docs.comfy.org/installation/update_comfyui', '_blank')
//   await closePopup()
// }

// Initialize on mount
onMounted(async () => {
  // Fetch releases if not already loaded
  if (!releaseStore.releases.length) {
    await releaseStore.fetchReleases()
  }
})

// Expose methods for parent component
defineExpose({
  show,
  hide
})
</script>

<style scoped>
/* Popup container - positioning handled by parent */
.whats-new-popup-container {
  position: absolute;
  bottom: 1rem;
  z-index: 1000;
  pointer-events: auto;
}

/* Arrow pointing to help center */
.help-center-arrow {
  position: absolute;
  bottom: calc(
    var(--sidebar-width, 4rem) + 0.25rem
  ); /* Position toward center of help center icon */
  transform: none;
  z-index: 999;
  pointer-events: none;
}

/* Position arrow based on sidebar location */
.whats-new-popup-container.sidebar-left .help-center-arrow {
  left: -14px; /* Overlap with popup outline */
}

.whats-new-popup-container.sidebar-left.small-sidebar .help-center-arrow {
  left: -14px; /* Overlap with popup outline */
  bottom: calc(2.5rem + 0.25rem); /* Adjust for small sidebar */
}

/* Sidebar positioning classes applied by parent */
.whats-new-popup-container.sidebar-left {
  left: 1rem;
}

.whats-new-popup-container.sidebar-left.small-sidebar {
  left: 1rem;
}

.whats-new-popup-container.sidebar-right {
  right: 1rem;
}

.whats-new-popup {
  background: #353535;
  border-radius: 12px;
  max-width: 400px;
  width: 400px;
  outline: 1px solid #4e4e4e;
  outline-offset: -1px;
  box-shadow: 0px 8px 32px rgba(0, 0, 0, 0.3);
  position: relative;
}

/* Content Section */
.popup-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-height: 80vh;
  overflow-y: auto;
  padding: 32px 32px 24px;
  border-radius: 12px;
}

/* Close button */
.close-button {
  position: absolute;
  top: 0;
  right: 0;
  width: 32px;
  height: 32px;
  padding: 6px;
  background: #7c7c7c;
  border-radius: 16px;
  border: none;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  transform: translate(30%, -30%);
  transition:
    background-color 0.2s ease,
    transform 0.1s ease;
  z-index: 1;
}

.close-button:hover {
  background: #8e8e8e;
}

.close-button:active {
  background: #6a6a6a;
  transform: translate(30%, -30%) scale(0.95);
}

.close-icon {
  width: 16px;
  height: 16px;
  position: relative;
  opacity: 0.9;
  transition: opacity 0.2s ease;
}

.close-button:hover .close-icon {
  opacity: 1;
}

.close-icon::before,
.close-icon::after {
  content: '';
  position: absolute;
  width: 12px;
  height: 2px;
  background: white;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(45deg);
  transition: background-color 0.2s ease;
}

.close-icon::after {
  transform: translate(-50%, -50%) rotate(-45deg);
}

/* Content Section */
.popup-content {
  display: flex;
  flex-direction: column;
}

.content-text {
  color: white;
  font-size: 14px;
  line-height: 1.5;
  word-wrap: break-word;
}

/* Style the markdown content */
/* Title */
.content-text :deep(*) {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.content-text :deep(h1) {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 8px;
}

/* Version subtitle - targets the first p tag after h1 */
.content-text :deep(h1 + p) {
  color: #c0c0c0;
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
  opacity: 0.8;
}

/* Regular paragraphs - short description */
.content-text :deep(p) {
  margin-bottom: 16px;
  color: #e0e0e0;
}

/* List */
.content-text :deep(ul),
.content-text :deep(ol) {
  margin-bottom: 16px;
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

/* List items */
.content-text :deep(li) {
  margin-bottom: 8px;
  position: relative;
  padding-left: 20px;
}

.content-text :deep(li:last-child) {
  margin-bottom: 0;
}

/* Custom bullet points */
.content-text :deep(li::before) {
  content: '';
  position: absolute;
  left: 0;
  top: 10px;
  display: flex;
  width: 8px;
  height: 8px;
  justify-content: center;
  align-items: center;
  aspect-ratio: 1/1;
  border-radius: 100px;
  background: #60a5fa;
}

/* List item strong text */
.content-text :deep(li strong) {
  color: #fff;
  font-size: 14px;
  display: block;
  margin-bottom: 4px;
}

.content-text :deep(li p) {
  font-size: 12px;
  margin-bottom: 0;
  line-height: 2;
}

/* Code styling */
.content-text :deep(code) {
  background-color: #2a2a2a;
  border: 1px solid #4a4a4a;
  border-radius: 4px;
  padding: 2px 6px;
  color: #f8f8f2;
  white-space: nowrap;
}

/* Remove top margin for first media element */
.content-text :deep(img:first-child),
.content-text :deep(video:first-child),
.content-text :deep(iframe:first-child) {
  margin-top: -32px; /* Align with the top edge of the popup content */
  margin-bottom: 24px;
}

/* Media elements */
.content-text :deep(img),
.content-text :deep(video),
.content-text :deep(iframe) {
  width: calc(100% + 64px);
  height: auto;
  margin: 24px -32px;
  display: block;
}

/* Actions Section */
.popup-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.learn-more-link {
  color: #60a5fa;
  font-size: 14px;
  font-weight: 500;
  line-height: 18.2px;
  text-decoration: none;
}

.learn-more-link:hover {
  text-decoration: underline;
}

.cta-button {
  height: 40px;
  padding: 0 20px;
  background: white;
  border-radius: 6px;
  outline: 1px solid #4e4e4e;
  outline-offset: -1px;
  border: none;
  color: #121212;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.cta-button:hover {
  background: #f0f0f0;
}
</style>
