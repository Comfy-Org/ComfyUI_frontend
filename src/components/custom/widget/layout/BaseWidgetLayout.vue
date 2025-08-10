<template>
  <div
    class="base-widget-layout rounded-2xl overflow-hidden relative bg-neutral-50 dark-theme:bg-zinc-800"
  >
    <IconButton
      v-show="!isRightPanelOpen && hasRightPanel"
      class="absolute top-4 right-16 z-10 transition-opacity duration-200"
      :class="{
        'opacity-0 pointer-events-none': isRightPanelOpen || !hasRightPanel
      }"
      @click="toggleRightPanel"
    >
      <i-lucide:panel-right class="text-sm" />
    </IconButton>
    <IconButton
      class="absolute top-4 right-6 z-10 transition-opacity duration-200"
      @click="closeDialog"
    >
      <i class="pi pi-times text-sm"></i>
    </IconButton>
    <div class="flex w-full h-full">
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

      <div class="flex-1 flex bg-zinc-100 dark-theme:bg-neutral-900">
        <div class="w-full h-full flex flex-col">
          <header
            v-if="$slots.header"
            class="w-full h-16 px-6 py-4 flex justify-between gap-2"
          >
            <div class="flex-1 flex gap-2 flex-shrink-0">
              <IconButton v-if="!notMobile" @click="toggleLeftPanel">
                <i-lucide:panel-left v-if="!showLeftPanel" class="text-sm" />
                <i-lucide:panel-left-close v-else class="text-sm" />
              </IconButton>
              <slot name="header"></slot>
            </div>
            <div class="flex justify-end gap-2 min-w-20">
              <slot name="header-right-area"></slot>
              <IconButton
                v-if="isRightPanelOpen && hasRightPanel"
                @click="toggleRightPanel"
              >
                <i-lucide:panel-right-close class="text-sm" />
              </IconButton>
            </div>
          </header>
          <main class="flex-1">
            <slot name="content"></slot>
          </main>
        </div>
        <Transition name="slide-panel-right">
          <aside
            v-if="hasRightPanel && isRightPanelOpen"
            class="w-1/4 min-w-40 max-w-80"
          >
            <slot name="rightPanel"></slot>
          </aside>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useBreakpoints } from '@vueuse/core'
import { computed, inject, ref, useSlots, watch } from 'vue'

import IconButton from '@/components/custom/button/IconButton.vue'
import { OnCloseKey } from '@/types/custom_components/widgetTypes'

const BREAKPOINTS = { sm: 480 }
const PANEL_SIZES = {
  width: 'w-1/3',
  minWidth: 'min-w-40',
  maxWidth: 'max-w-56'
}

const slots = useSlots()
const closeDialog = inject(OnCloseKey, () => {})

const breakpoints = useBreakpoints(BREAKPOINTS)
const notMobile = breakpoints.greater('sm')

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

/* Slide transition for right panel */
.slide-panel-right-enter-active,
.slide-panel-right-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
  backface-visibility: hidden;
}

.slide-panel-right-enter-from,
.slide-panel-right-leave-to {
  transform: translateX(100%);
}
</style>
