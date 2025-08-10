<template>
  <div class="base-widget-layout rounded-2xl overflow-hidden relative">
    <IconButton class="absolute top-4 right-6" @click="closeDialog">
      <i class="pi pi-times text-sm"></i>
    </IconButton>
    <div class="flex w-full h-full">
      <Transition name="slide-panel">
        <nav
          v-if="$slots.leftPanel && showLeftPanel"
          :class="`${PANEL_SIZES.width} ${PANEL_SIZES.minWidth} ${PANEL_SIZES.maxWidth}`"
        >
          <slot name="leftPanel"></slot>
        </nav>
      </Transition>

      <div class="flex-1 flex bg-neutral-50 dark-theme:bg-neutral-900">
        <div class="flex-1 flex flex-col">
          <header
            v-if="$slots.header"
            class="w-full h-16 px-6 py-4 flex justify-between gap-2"
          >
            <div>
              <IconButton v-if="!notMobile" @click="toggleLeftPanel">
                <i-lucide:panel-left class="text-sm" />
              </IconButton>
              <slot name="header"></slot>
            </div>
            <div class="flex gap-2 pr-12">
              <slot name="header-right-area"></slot>
              <IconButton
                v-if="notMobile && !hideDesktopToggle"
                @click="toggleLeftPanel"
              >
                <i-lucide:panel-left-close
                  v-if="showLeftPanel"
                  class="text-sm"
                />
                <i-lucide:panel-left v-else class="text-sm" />
              </IconButton>
            </div>
          </header>
          <main class="flex-1">
            <slot name="content"></slot>
          </main>
        </div>
        <!-- <aside v-if="$slots.rightPanel">
          <slot name="rightPanel"></slot>
        </aside> -->
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useBreakpoints } from '@vueuse/core'
import { computed, inject, ref, watch } from 'vue'

import IconButton from '@/components/custom/button/IconButton.vue'
import { OnCloseKey } from '@/types/custom_components/widgetTypes'

const BREAKPOINTS = { sm: 480 }
const PANEL_SIZES = {
  width: 'w-1/3',
  minWidth: 'min-w-40',
  maxWidth: 'max-w-56'
}

const { hideDesktopToggle = false } = defineProps<{
  hideDesktopToggle?: boolean
}>()

const closeDialog = inject(OnCloseKey, () => {})

const breakpoints = useBreakpoints(BREAKPOINTS)
const notMobile = breakpoints.greater('sm')

const isLeftPanelOpen = ref<boolean>(true)
const mobileMenuOpen = ref<boolean>(false)

watch(notMobile, (isDesktop) => {
  if (!isDesktop) mobileMenuOpen.value = false
})

const showLeftPanel = computed(() => {
  if (notMobile.value) {
    return isLeftPanelOpen.value
  }
  return mobileMenuOpen.value
})

const toggleLeftPanel = () => {
  if (notMobile.value) {
    isLeftPanelOpen.value = !isLeftPanelOpen.value
  } else {
    mobileMenuOpen.value = !mobileMenuOpen.value
  }
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

/* Slide transition for left panel */
.slide-panel-enter-active,
.slide-panel-leave-active {
  transition: all 0.3s ease;
}

.slide-panel-enter-from,
.slide-panel-leave-to {
  margin-left: -16rem; /* -256px for w-56 max width */
  opacity: 0;
}

.slide-panel-enter-to,
.slide-panel-leave-from {
  margin-left: 0;
  opacity: 1;
}
</style>
