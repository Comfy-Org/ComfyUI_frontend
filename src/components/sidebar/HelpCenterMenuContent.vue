<template>
  <div class="help-center-menu" role="menu" aria-label="Help Center Menu">
    <!-- Help Center Menu Items -->
    <nav class="help-menu-section" role="menubar">
      <button
        v-for="menuItem in MENU_ITEMS"
        :key="menuItem.key"
        type="button"
        class="help-menu-item"
        :class="{ 'more-item': menuItem.key === 'more' }"
        role="menuitem"
        @click="menuItem.action"
      >
        <i :class="menuItem.icon" class="help-menu-icon" />
        <span class="menu-label">{{ menuItem.label }}</span>
        <i v-if="menuItem.key === 'more'" class="pi pi-chevron-right" />
      </button>
    </nav>

    <!-- What's New Section -->
    <section class="whats-new-section">
      <h3 class="section-description">{{ $t('helpCenter.whatsNew') }}</h3>

      <!-- Release items -->
      <div v-if="hasReleases" role="group" aria-label="Recent releases">
        <article
          v-for="release in releaseStore.recentReleases"
          :key="release.id || release.version"
          class="help-menu-item release-menu-item"
          role="button"
          tabindex="0"
          @click="handleReleaseClick(release)"
          @keydown.enter="handleReleaseClick(release)"
          @keydown.space.prevent="handleReleaseClick(release)"
        >
          <i class="pi pi-refresh help-menu-icon" aria-hidden="true" />
          <div class="release-content">
            <span class="release-title">
              Comfy {{ release.version }} Release
            </span>
            <time class="release-date" :datetime="release.published_at">
              <span class="normal-state">
                {{ formatReleaseDate(release.published_at) }}
              </span>
              <span class="hover-state">
                {{ $t('helpCenter.clickToLearnMore') }}
              </span>
            </time>
          </div>
          <Button
            v-if="shouldShowUpdateButton(release)"
            :label="$t('helpCenter.updateAvailable')"
            size="small"
            class="update-button"
            @click.stop="handleUpdate(release)"
          />
        </article>
      </div>

      <!-- Loading state -->
      <div
        v-else-if="releaseStore.isLoading"
        class="help-menu-item"
        role="status"
        aria-live="polite"
      >
        <i class="pi pi-spin pi-spinner help-menu-icon" aria-hidden="true" />
        <span>{{ $t('helpCenter.loadingReleases') }}</span>
      </div>

      <!-- No releases state -->
      <div v-else class="help-menu-item" role="status">
        <i class="pi pi-info-circle help-menu-icon" aria-hidden="true" />
        <span>{{ $t('helpCenter.noRecentReleases') }}</span>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import { type ReleaseNote } from '@/services/releaseService'
import { useReleaseStore } from '@/stores/releaseStore'

// Constants
const EXTERNAL_LINKS = {
  DOCS: 'https://docs.comfy.org/',
  DISCORD: 'https://www.comfy.org/discord',
  GITHUB: 'https://github.com/comfyanonymous/ComfyUI',
  CHANGELOG: 'https://docs.comfy.org/changelog'
} as const

const TIME_UNITS = {
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
  YEAR: 365 * 24 * 60 * 60 * 1000
} as const

// Composables
const { t } = useI18n()
const releaseStore = useReleaseStore()

// Computed
const hasReleases = computed(() => releaseStore.releases.length > 0)

const MENU_ITEMS = computed(() => [
  {
    key: 'docs',
    icon: 'pi pi-book',
    label: t('helpCenter.docs'),
    action: () => openExternalLink(EXTERNAL_LINKS.DOCS)
  },
  {
    key: 'discord',
    icon: 'pi pi-discord',
    label: 'Discord',
    action: () => openExternalLink(EXTERNAL_LINKS.DISCORD)
  },
  {
    key: 'github',
    icon: 'pi pi-github',
    label: t('helpCenter.github'),
    action: () => openExternalLink(EXTERNAL_LINKS.GITHUB)
  },
  {
    key: 'help',
    icon: 'pi pi-question-circle',
    label: t('helpCenter.helpFeedback'),
    action: () => openExternalLink(EXTERNAL_LINKS.DISCORD)
  },
  {
    key: 'more',
    icon: '',
    label: t('helpCenter.more'),
    action: handleShowMore
  }
])

// Methods
const openExternalLink = (url: string): void => {
  window.open(url, '_blank', 'noopener,noreferrer')
}

const formatReleaseDate = (dateString?: string): string => {
  if (!dateString) return 'date'

  const date = new Date(dateString)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - date.getTime())

  const timeUnits = [
    { unit: TIME_UNITS.YEAR, suffix: 'y' },
    { unit: TIME_UNITS.MONTH, suffix: 'mo' },
    { unit: TIME_UNITS.WEEK, suffix: 'w' },
    { unit: TIME_UNITS.DAY, suffix: 'd' },
    { unit: TIME_UNITS.HOUR, suffix: 'h' },
    { unit: TIME_UNITS.MINUTE, suffix: 'min' }
  ]

  for (const { unit, suffix } of timeUnits) {
    const value = Math.floor(diffTime / unit)
    if (value > 0) {
      return `${value}${suffix} ago`
    }
  }

  return 'now'
}

const shouldShowUpdateButton = (release: ReleaseNote): boolean => {
  return (
    releaseStore.shouldShowUpdateButton &&
    release === releaseStore.recentReleases[0]
  )
}

// Event handlers
const handleReleaseClick = (release: ReleaseNote): void => {
  // Mark changelog as seen
  void releaseStore.handleShowChangelog(release.version)
  openExternalLink(EXTERNAL_LINKS.CHANGELOG)
}

const handleUpdate = (_: ReleaseNote): void => {
  window.open('https://docs.comfy.org/installation/update_comfyui', '_blank')
}

const handleShowMore = (): void => {
  // TODO: Implement show more functionality
}

// Lifecycle
onMounted(async () => {
  if (!hasReleases.value) {
    await releaseStore.fetchReleases()
  }
})
</script>

<style scoped>
.help-center-menu {
  width: 380px;
  max-height: 500px;
  overflow-y: auto;
  background: var(--p-content-background);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  border: 1px solid var(--p-content-border-color);
  backdrop-filter: blur(8px);
}

.help-menu-section {
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--p-content-border-color);
}

.help-menu-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0.75rem 1rem;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 0.9rem;
  color: inherit;
  text-align: left;
}

.help-menu-item:hover,
.help-menu-item:focus-visible {
  background-color: #007aff26;
  outline: none;
}

.help-menu-item:focus-visible {
  box-shadow: inset 0 0 0 2px var(--p-primary-color);
}

.help-menu-icon {
  margin-right: 0.75rem;
  font-size: 1rem;
  color: var(--p-text-muted-color);
  width: 16px;
  display: flex;
  justify-content: center;
  flex-shrink: 0;
}

.menu-label {
  flex: 1;
}

.more-item {
  justify-content: space-between;
}

.whats-new-section {
  padding: 0.5rem 0;
}

.section-description {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--p-text-muted-color);
  margin: 0 0 0.5rem 0;
  padding: 0 1rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.release-menu-item {
  position: relative;
}

.release-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.release-title {
  font-size: 0.9rem;
  line-height: 1.2;
  font-weight: 500;
}

.release-date {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}

.release-date .hover-state {
  display: none;
}

.release-menu-item:hover .release-date .normal-state,
.release-menu-item:focus-within .release-date .normal-state {
  display: none;
}

.release-menu-item:hover .release-date .hover-state,
.release-menu-item:focus-within .release-date .hover-state {
  display: inline;
}

.update-button {
  margin-left: 0.5rem;
  font-size: 0.8rem;
  padding: 0.25rem 0.75rem;
  flex-shrink: 0;
}

/* Scrollbar styling */
.help-center-menu::-webkit-scrollbar {
  width: 6px;
}

.help-center-menu::-webkit-scrollbar-track {
  background: transparent;
}

.help-center-menu::-webkit-scrollbar-thumb {
  background: var(--p-content-border-color);
  border-radius: 3px;
}

.help-center-menu::-webkit-scrollbar-thumb:hover {
  background: var(--p-text-muted-color);
}

/* Focus management */
.help-menu-item:focus {
  outline: 2px solid var(--p-primary-color);
  outline-offset: -2px;
}

@media (prefers-reduced-motion: reduce) {
  .help-menu-item {
    transition: none;
  }
}
</style>
