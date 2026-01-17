<template>
  <div
    class="base-widget-layout rounded-2xl overflow-hidden relative"
    @keydown.esc.capture="handleEscape"
  >
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

      <div class="flex-1 flex bg-base-background overflow-hidden">
        <div class="flex h-full w-full flex-col">
          <header
            v-if="$slots.header"
            class="w-full h-18 px-6 flex items-center justify-between gap-2"
          >
            <div class="flex flex-1 shrink-0 gap-2">
              <Button v-if="!notMobile" size="icon" @click="toggleLeftPanel">
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
              <slot name="header"></slot>
            </div>
            <slot name="header-right-area"></slot>
            <template v-if="!isRightPanelOpen">
              <Button
                v-if="showRightPanelButton"
                size="icon"
                @click="toggleRightPanel"
              >
                <i class="icon-[lucide--panel-right] text-sm" />
              </Button>
              <Button size="lg" class="w-10" @click="closeDialog">
                <i class="pi pi-times" />
              </Button>
            </template>
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
            <div
              class="min-h-0 flex-1 px-6 pt-0 pb-10 overflow-y-auto scrollbar-custom"
            >
              <slot name="content"></slot>
            </div>
          </main>
        </div>
        <Transition name="slide-panel-right">
          <aside
            v-if="hasRightPanel && isRightPanelOpen"
            key="right-panel"
            class="flex w-72 shrink-0 bg-modal-panel-background flex-col"
          >
            <header
              data-component-id="RightPanelHeader"
              class="flex h-16 shrink-0 items-center gap-2 px-4"
            >
              <h2 v-if="rightPanelTitle" class="flex-1 text-lg font-semibold">
                {{ rightPanelTitle }}
              </h2>
              <div v-else class="flex-1">
                <slot name="rightPanelHeaderTitle" />
              </div>
              <slot name="rightPanelHeaderActions" />
              <Button size="icon" @click="toggleRightPanel">
                <i class="icon-[lucide--panel-right-close] text-sm" />
              </Button>
              <Button size="icon" @click="closeDialog">
                <i class="pi pi-times" />
              </Button>
            </header>
            <div class="min-h-0 flex-1 overflow-y-auto">
              <slot name="rightPanel" />
            </div>
          </aside>
        </Transition>
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

const { contentTitle, rightPanelTitle } = defineProps<{
  contentTitle: string
  rightPanelTitle?: string
}>()

const isRightPanelOpen = defineModel<boolean>('rightPanelOpen', {
  default: false
})

const slots = useSlots()
const hasRightPanel = computed(() => !!slots.rightPanel)

const hideRightPanelButton = defineModel<boolean>('hideRightPanelButton', {
  default: false
})

const showRightPanelButton = computed(
  () => hasRightPanel.value && !hideRightPanelButton.value
)

const BREAKPOINTS = { md: 880 }
const PANEL_SIZES = {
  width: 'w-1/3',
  minWidth: 'min-w-40',
  maxWidth: 'max-w-56'
}

const closeDialog = inject(OnCloseKey, () => {})

const breakpoints = useBreakpoints(BREAKPOINTS)
const notMobile = breakpoints.greater('md')

const isLeftPanelOpen = ref<boolean>(true)
const mobileMenuOpen = ref<boolean>(false)

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

function handleEscape(event: KeyboardEvent) {
  if (isRightPanelOpen.value) {
    event.stopPropagation()
    isRightPanelOpen.value = false
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
  position: absolute;
  right: 0;
  top: 0;
  height: 100%;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
  backface-visibility: hidden;
}

.slide-panel-right-enter-from,
.slide-panel-right-leave-to {
  transform: translateX(100%);
}
</style>
