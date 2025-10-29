<template>
  <div :class="layoutClasses">
    <IconButton
      v-show="!isRightPanelOpen && hasRightPanel"
      :class="rightPanelButtonClasses"
      @click="toggleRightPanel"
    >
      <i class="icon-[lucide--panel-right] text-sm" />
    </IconButton>
    <IconButton :class="closeButtonClasses" @click="closeDialog">
      <i class="pi pi-times text-sm"></i>
    </IconButton>
    <div class="flex h-full w-full">
      <Transition name="slide-panel">
        <nav
          v-if="$slots.leftPanel && showLeftPanel"
          :class="[
            PANEL_SIZES.width,
            PANEL_SIZES.minWidth,
            PANEL_SIZES.maxWidth
          ]"
        >
          <slot name="leftPanel"></slot>
        </nav>
      </Transition>

      <div :class="mainContainerClasses">
        <div class="flex h-full w-full flex-col">
          <header v-if="$slots.header" :class="headerClasses">
            <div class="flex flex-1 shrink-0 gap-2">
              <IconButton v-if="!notMobile" @click="toggleLeftPanel">
                <i
                  v-if="!showLeftPanel"
                  class="icon-[lucide--panel-left] text-sm"
                />
                <i v-else class="icon-[lucide--panel-left-close] text-sm" />
              </IconButton>
              <slot name="header"></slot>
            </div>
            <slot name="header-right-area"></slot>
            <div :class="rightAreaClasses">
              <IconButton
                v-if="isRightPanelOpen && hasRightPanel"
                @click="toggleRightPanel"
              >
                <i class="icon-[lucide--panel-right-close] text-sm" />
              </IconButton>
            </div>
          </header>

          <main class="flex min-h-0 flex-1 flex-col">
            <!-- Fallback title bar when no leftPanel is provided -->
            <slot name="contentFilter"></slot>
            <h2
              v-if="!$slots.leftPanel"
              class="text-xxl m-0 px-6 pt-2 pb-6 capitalize"
            >
              {{ contentTitle }}
            </h2>
            <div :class="contentContainerClasses">
              <slot name="content"></slot>
            </div>
          </main>
        </div>
        <aside
          v-if="hasRightPanel && isRightPanelOpen"
          :class="rightPanelClasses"
        >
          <slot name="rightPanel"></slot>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useBreakpoints } from '@vueuse/core'
import { computed, inject, ref, useSlots, watch } from 'vue'

import IconButton from '@/components/button/IconButton.vue'
import { OnCloseKey } from '@/types/widgetTypes'
import { cn } from '@/utils/tailwindUtil'

const { contentTitle } = defineProps<{
  contentTitle: string
}>()

const BREAKPOINTS = { md: 880 }
const PANEL_SIZES = {
  width: 'w-1/3',
  minWidth: 'min-w-40',
  maxWidth: 'max-w-56'
}

const slots = useSlots()
const closeDialog = inject(OnCloseKey, () => {})

const breakpoints = useBreakpoints(BREAKPOINTS)
const notMobile = breakpoints.greater('md')

const isLeftPanelOpen = ref<boolean>(true)
const isRightPanelOpen = ref<boolean>(false)
const mobileMenuOpen = ref<boolean>(false)

const hasRightPanel = computed(() => !!slots.rightPanel)

watch(notMobile, (isDesktop) => {
  if (!isDesktop) {
    mobileMenuOpen.value = false
  }
})

const showLeftPanel = computed(() => {
  const shouldShow = notMobile.value
    ? isLeftPanelOpen.value
    : mobileMenuOpen.value
  return shouldShow
})

const toggleLeftPanel = () => {
  if (notMobile.value) {
    isLeftPanelOpen.value = !isLeftPanelOpen.value
  } else {
    mobileMenuOpen.value = !mobileMenuOpen.value
  }
}

const toggleRightPanel = () => {
  isRightPanelOpen.value = !isRightPanelOpen.value
}

// Computed classes for better readability
const layoutClasses = cn(
  'base-widget-layout',
  'rounded-2xl overflow-hidden relative',
  'bg-gray-50 dark-theme:bg-smoke-800'
)

const rightPanelButtonClasses = computed(() => {
  return cn('absolute top-4 right-18 z-10', 'transition-opacity duration-200', {
    'opacity-0 pointer-events-none':
      isRightPanelOpen.value || !hasRightPanel.value
  })
})

const closeButtonClasses = cn(
  'absolute top-4 right-6 z-10',
  'transition-opacity duration-200'
)

const mainContainerClasses = cn(
  'flex-1 flex',
  'bg-smoke-100 dark-theme:bg-neutral-900'
)

const headerClasses = cn(
  'w-full h-18 px-6',
  'flex items-center justify-between gap-2'
)

const rightAreaClasses = computed(() => {
  return cn(
    'flex justify-end gap-2 w-0',
    hasRightPanel.value && !isRightPanelOpen.value ? 'min-w-22' : 'min-w-10'
  )
})

const contentContainerClasses = computed(() => {
  return cn('min-h-0 px-6 pt-0 pb-10', 'overflow-y-auto scrollbar-hide')
})

const rightPanelClasses = computed(() => {
  return cn('w-1/4 min-w-40 max-w-80')
})
</script>
<style scoped>
.base-widget-layout {
  height: 80vh;
  width: 90vw;
  max-width: 1280px;
  aspect-ratio: 20/13;
}

@media (min-width: 1450px) {
  .base-widget-layout {
    max-width: 1724px;
  }
}

/* Fade transition for buttons */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Slide transition for left panel */
.slide-panel-enter-active,
.slide-panel-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
  backface-visibility: hidden;
}

.slide-panel-enter-from,
.slide-panel-leave-to {
  transform: translateX(-100%);
}
</style>
