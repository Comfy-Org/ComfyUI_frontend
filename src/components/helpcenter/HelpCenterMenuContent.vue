<template>
  <div class="help-center-menu" role="menu" aria-label="Help Center Menu">
    <!-- Main Menu Items -->
    <nav class="help-menu-section" role="menubar">
      <button
        v-for="menuItem in menuItems"
        :key="menuItem.key"
        type="button"
        class="help-menu-item"
        :class="{ 'more-item': menuItem.key === 'more' }"
        role="menuitem"
        @click="menuItem.action"
        @mouseenter="onMenuItemHover(menuItem.key, $event)"
        @mouseleave="onMenuItemLeave(menuItem.key)"
      >
        <i :class="menuItem.icon" class="help-menu-icon" />
        <span class="menu-label">{{ menuItem.label }}</span>
        <i v-if="menuItem.key === 'more'" class="pi pi-chevron-right" />
      </button>
    </nav>

    <!-- More Submenu -->
    <Teleport to="body">
      <div
        v-if="isSubmenuVisible"
        ref="submenuRef"
        class="more-submenu"
        :style="submenuStyle"
        @mouseenter="onSubmenuHover"
        @mouseleave="onSubmenuLeave"
      >
        <template v-for="submenuItem in submenuItems" :key="submenuItem.key">
          <div v-if="submenuItem.type === 'divider'" class="submenu-divider" />
          <button
            v-else
            type="button"
            class="help-menu-item submenu-item"
            :class="{ disabled: submenuItem.disabled }"
            :disabled="submenuItem.disabled"
            role="menuitem"
            @click="submenuItem.action"
          >
            <span class="menu-label">{{ submenuItem.label }}</span>
          </button>
        </template>
      </div>
    </Teleport>

    <!-- What's New Section -->
    <section class="whats-new-section">
      <h3 class="section-description">{{ $t('helpCenter.whatsNew') }}</h3>

      <!-- Release Items -->
      <div v-if="hasReleases" role="group" aria-label="Recent releases">
        <article
          v-for="release in releaseStore.recentReleases"
          :key="release.id || release.version"
          class="help-menu-item release-menu-item"
          role="button"
          tabindex="0"
          @click="onReleaseClick(release)"
          @keydown.enter="onReleaseClick(release)"
          @keydown.space.prevent="onReleaseClick(release)"
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
            @click.stop="onUpdate(release)"
          />
        </article>
      </div>

      <!-- Loading State -->
      <div
        v-else-if="releaseStore.isLoading"
        class="help-menu-item"
        role="status"
        aria-live="polite"
      >
        <i class="pi pi-spin pi-spinner help-menu-icon" aria-hidden="true" />
        <span>{{ $t('helpCenter.loadingReleases') }}</span>
      </div>

      <!-- No Releases State -->
      <div v-else class="help-menu-item" role="status">
        <i class="pi pi-info-circle help-menu-icon" aria-hidden="true" />
        <span>{{ $t('helpCenter.noRecentReleases') }}</span>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { type CSSProperties, computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { type ReleaseNote } from '@/services/releaseService'
import { useReleaseStore } from '@/stores/releaseStore'
import { electronAPI, isElectron } from '@/utils/envUtil'
import { formatVersionAnchor } from '@/utils/formatUtil'

// Types
interface MenuItem {
  key: string
  icon: string
  label: string
  action: () => void
}

interface SubmenuItem {
  key: string
  type?: 'item' | 'divider'
  label?: string
  action?: () => void
  disabled?: boolean
}

// Constants
const EXTERNAL_LINKS = {
  DOCS: 'https://docs.comfy.org/',
  DISCORD: 'https://www.comfy.org/discord',
  GITHUB: 'https://github.com/comfyanonymous/ComfyUI',
  DESKTOP_GUIDE: 'https://docs.comfy.org/installation/desktop',
  UPDATE_GUIDE: 'https://docs.comfy.org/installation/update_comfyui'
} as const

const TIME_UNITS = {
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
  YEAR: 365 * 24 * 60 * 60 * 1000
} as const

const SUBMENU_CONFIG = {
  DELAY_MS: 100,
  OFFSET_PX: 8,
  Z_INDEX: 1002
} as const

// Composables
const { t, locale } = useI18n()
const releaseStore = useReleaseStore()

// State
const isSubmenuVisible = ref(false)
const submenuRef = ref<HTMLElement | null>(null)
const submenuStyle = ref<CSSProperties>({})
let hoverTimeout: number | null = null

// Computed
const hasReleases = computed(() => releaseStore.releases.length > 0)

const menuItems = computed<MenuItem[]>(() => [
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
    action: () => {} // No action for more item
  }
])

const submenuItems = computed<SubmenuItem[]>(() => [
  {
    key: 'desktop-guide',
    type: 'item',
    label: t('helpCenter.desktopUserGuide'),
    action: () => openExternalLink(EXTERNAL_LINKS.DESKTOP_GUIDE),
    disabled: false
  },
  {
    key: 'dev-tools',
    type: 'item',
    label: t('helpCenter.openDevTools'),
    action: openDevTools,
    disabled: !isElectron()
  },
  {
    key: 'divider-1',
    type: 'divider'
  },
  {
    key: 'reinstall',
    type: 'item',
    label: t('helpCenter.reinstall'),
    action: onReinstall,
    disabled: !isElectron()
  }
])

// Utility Functions
const openExternalLink = (url: string): void => {
  window.open(url, '_blank', 'noopener,noreferrer')
}

const clearHoverTimeout = (): void => {
  if (hoverTimeout) {
    clearTimeout(hoverTimeout)
    hoverTimeout = null
  }
}

const calculateSubmenuPosition = (button: HTMLElement): CSSProperties => {
  const rect = button.getBoundingClientRect()
  const submenuWidth = 210 // Width defined in CSS

  // Get actual submenu height if available, otherwise use estimated height
  const submenuHeight = submenuRef.value?.offsetHeight || 120 // More realistic estimate for 2 items

  // Get viewport dimensions
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  // Calculate basic position (aligned with button)
  let top = rect.top
  let left = rect.right + SUBMENU_CONFIG.OFFSET_PX

  // Check if submenu would overflow viewport on the right
  if (left + submenuWidth > viewportWidth) {
    // Position submenu to the left of the button instead
    left = rect.left - submenuWidth - SUBMENU_CONFIG.OFFSET_PX
  }

  // Check if submenu would overflow viewport at the bottom
  if (top + submenuHeight > viewportHeight) {
    // Position submenu above the button, aligned to bottom
    top = Math.max(
      SUBMENU_CONFIG.OFFSET_PX, // Minimum distance from top of viewport
      rect.bottom - submenuHeight
    )
  }

  // Ensure submenu doesn't go above viewport
  if (top < SUBMENU_CONFIG.OFFSET_PX) {
    top = SUBMENU_CONFIG.OFFSET_PX
  }

  return {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    zIndex: SUBMENU_CONFIG.Z_INDEX
  }
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

// Event Handlers
const onMenuItemHover = async (
  key: string,
  event: MouseEvent
): Promise<void> => {
  if (key !== 'more') return

  clearHoverTimeout()

  const moreButton = event.currentTarget as HTMLElement

  // Calculate initial position before showing submenu
  submenuStyle.value = calculateSubmenuPosition(moreButton)

  // Show submenu with correct position
  isSubmenuVisible.value = true

  // After submenu is rendered, refine position if needed
  await nextTick()
  if (submenuRef.value) {
    submenuStyle.value = calculateSubmenuPosition(moreButton)
  }
}

const onMenuItemLeave = (key: string): void => {
  if (key !== 'more') return

  hoverTimeout = window.setTimeout(() => {
    isSubmenuVisible.value = false
  }, SUBMENU_CONFIG.DELAY_MS)
}

const onSubmenuHover = (): void => {
  clearHoverTimeout()
}

const onSubmenuLeave = (): void => {
  isSubmenuVisible.value = false
}

const openDevTools = (): void => {
  if (isElectron()) {
    electronAPI().openDevTools()
  }
}

const onReinstall = (): void => {
  if (isElectron()) {
    void electronAPI().reinstall()
  }
}

const onReleaseClick = (release: ReleaseNote): void => {
  void releaseStore.handleShowChangelog(release.version)
  const versionAnchor = formatVersionAnchor(release.version)
  const changelogUrl = `${getChangelogUrl()}#${versionAnchor}`
  openExternalLink(changelogUrl)
}

const onUpdate = (_: ReleaseNote): void => {
  openExternalLink(EXTERNAL_LINKS.UPDATE_GUIDE)
}

// Generate language-aware changelog URL
const getChangelogUrl = (): string => {
  const isChineseLocale = locale.value === 'zh'
  return isChineseLocale
    ? 'https://docs.comfy.org/zh-CN/changelog'
    : 'https://docs.comfy.org/changelog'
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
  position: relative;
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

.help-menu-item:hover {
  background-color: #007aff26;
}

.help-menu-item:focus,
.help-menu-item:focus-visible {
  outline: none;
  box-shadow: none;
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
  height: 16px;
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

/* Submenu Styles */
.more-submenu {
  width: 210px;
  padding: 0.5rem 0;
  background: var(--p-content-background);
  border-radius: 12px;
  border: 1px solid var(--p-content-border-color);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  transition: opacity 0.15s ease-out;
}

.submenu-item {
  padding: 0.75rem 1rem;
  color: inherit;
  font-size: 0.9rem;
  font-weight: inherit;
  line-height: inherit;
}

.submenu-item:hover {
  background-color: #007aff26;
}

.submenu-item:focus,
.submenu-item:focus-visible {
  outline: none;
  box-shadow: none;
}

.submenu-item.disabled,
.submenu-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.submenu-divider {
  height: 1px;
  background: #3e3e3e;
  margin: 0.5rem 0;
}

/* Scrollbar Styling */
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

/* Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  .help-menu-item {
    transition: none;
  }
}
</style>
