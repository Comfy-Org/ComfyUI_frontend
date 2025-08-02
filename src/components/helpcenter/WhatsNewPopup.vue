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
      <button class="close-button" aria-label="Close" @click="closePopup">
        <div class="close-icon"></div>
      </button>

      <!-- Release Content -->
      <div class="popup-content">
        <div class="content-text" v-html="formattedContent"></div>
      </div>

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
</template>

<script setup lang="ts">
import { marked } from 'marked'
import { computed, onMounted, ref } from 'vue'
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
    return '<p>No release notes available.</p>'
  }

  try {
    // Use marked to parse markdown to HTML
    return marked(latestRelease.value.content, {
      breaks: true, // Convert line breaks to <br>
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
  padding: 32px 32px 24px;
  background: #353535;
  border-radius: 12px;
  max-width: 400px;
  width: 400px;
  display: flex;
  flex-direction: column;
  gap: 32px;
  outline: 1px solid #4e4e4e;
  outline-offset: -1px;
  box-shadow: 0px 8px 32px rgba(0, 0, 0, 0.3);
  position: relative;
}

/* Content Section */
.popup-content {
  display: flex;
  flex-direction: column;
}

/* Close button */
.close-button {
  position: absolute;
  top: 0;
  right: 0;
  width: 31px;
  height: 31px;
  padding: 6px 7px;
  background: #7c7c7c;
  border-radius: 15.5px;
  border: none;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  transform: translate(50%, -50%);
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
  transform: translate(50%, -50%) scale(0.95);
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
  font-family: 'Inter', sans-serif;
  font-weight: 400;
  line-height: 1.5;
  word-wrap: break-word;
}

/* Style the markdown content */
.content-text :deep(h1) {
  color: white;
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 16px 0;
  line-height: 1.3;
}

.content-text :deep(h2) {
  color: white;
  font-size: 18px;
  font-weight: 600;
  margin: 16px 0 12px 0;
  line-height: 1.3;
}

.content-text :deep(h2:first-child) {
  margin-top: 0;
}

.content-text :deep(h3) {
  color: white;
  font-size: 16px;
  font-weight: 600;
  margin: 12px 0 8px 0;
  line-height: 1.3;
}

.content-text :deep(h3:first-child) {
  margin-top: 0;
}

.content-text :deep(h4) {
  color: white;
  font-size: 14px;
  font-weight: 600;
  margin: 8px 0 6px 0;
}

.content-text :deep(h4:first-child) {
  margin-top: 0;
}

.content-text :deep(p) {
  margin: 0 0 12px 0;
  line-height: 1.6;
}

.content-text :deep(p:first-child) {
  margin-top: 0;
}

.content-text :deep(p:last-child) {
  margin-bottom: 0;
}

.content-text :deep(ul),
.content-text :deep(ol) {
  margin: 0 0 12px 0;
  padding-left: 24px;
}

.content-text :deep(ul:first-child),
.content-text :deep(ol:first-child) {
  margin-top: 0;
}

.content-text :deep(ul:last-child),
.content-text :deep(ol:last-child) {
  margin-bottom: 0;
}

/* Remove top margin for first media element */
.content-text :deep(img:first-child),
.content-text :deep(video:first-child),
.content-text :deep(iframe:first-child) {
  margin-top: -32px; /* Align with the top edge of the popup content */
  margin-bottom: 12px;
}

/* Media elements */
.content-text :deep(img),
.content-text :deep(video),
.content-text :deep(iframe) {
  width: calc(100% + 64px);
  height: auto;
  border-radius: 6px;
  margin: 12px -32px;
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
  font-family: 'Inter', sans-serif;
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
  font-family: 'Inter', sans-serif;
  font-weight: 500;
  cursor: pointer;
}

.cta-button:hover {
  background: #f0f0f0;
}
</style>
