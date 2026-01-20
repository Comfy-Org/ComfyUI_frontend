<template>
  <div class="base-widget-layout relative overflow-hidden rounded-2xl">
    <Button
      v-show="!isRightPanelOpen && hasRightPanel"
      size="lg"
      :class="
        cn('absolute top-4 right-18 z-10', 'transition-opacity duration-200', {
          'pointer-events-none opacity-0': isRightPanelOpen || !hasRightPanel
        })
      "
      @click="toggleRightPanel"
    >
      <i class="icon-[lucide--panel-right]" />
    </Button>
    <Button
      size="lg"
      class="absolute top-4 right-6 z-10 w-10 transition-opacity duration-200"
      @click="closeDialog"
    >
      <i class="pi pi-times" />
    </Button>
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
          <slot name="leftPanel" />
        </nav>
      </Transition>

      <div class="flex flex-1 bg-base-background">
        <div class="flex h-full w-full flex-col">
          <header
            v-if="$slots.header"
            class="flex h-18 w-full items-center justify-between gap-2 px-6"
          >
            <div class="flex flex-1 shrink-0 gap-2">
              <Button
                v-if="!notMobile"
                size="icon"
                @click="toggleLeftPanel"
              >
                <i
                  :class="
                    cn(
                      showLeftPanel
                        ? 'icon-[lucide--panel-left]'
                        : 'icon-[lucide--panel-left-close]'
                    )
                  "
                />
              </Button>
              <slot name="header" />
            </div>
            <slot name="header-right-area" />
            <div
              :class="
                cn(
                  'flex w-0 justify-end gap-2',
                  hasRightPanel && !isRightPanelOpen ? 'min-w-22' : 'min-w-10'
                )
              "
            >
              <Button
                v-if="isRightPanelOpen && hasRightPanel"
                size="lg"
                @click="toggleRightPanel"
              >
                <i class="icon-[lucide--panel-right-close]" />
              </Button>
            </div>
          </header>

          <main class="flex min-h-0 flex-1 flex-col">
            <!-- Fallback title bar when no leftPanel is provided -->
            <slot name="contentFilter" />
            <h2
              v-if="!$slots.leftPanel"
              class="text-xxl m-0 px-6 pt-2 pb-6 capitalize"
            >
              {{ contentTitle }}
            </h2>
            <div
              class="scrollbar-custom min-h-0 flex-1 overflow-y-auto px-6 pt-0 pb-10"
            >
              <slot name="content" />
            </div>
          </main>
        </div>
        <aside
          v-if="hasRightPanel && isRightPanelOpen"
          class="w-1/4 max-w-80 min-w-40 pt-16 pb-8"
        >
          <slot name="rightPanel" />
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useBreakpoints } from '@vueuse/core'
import { computed, inject, ref, useSlots, watch } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { OnCloseKey } from '@/types/widgetTypes'
import { cn } from '@/utils/tailwindUtil'

const { contentTitle } = defineProps<{
  contentTitle: string
}>()

const isRightPanelOpen = defineModel<boolean>('rightPanelOpen', {
  default: false
})

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
</style>
