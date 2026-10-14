<template>
  <div
    :class="
      cn(
        'relative overflow-hidden rounded-2xl border border-border-default bg-base-background shadow-lg',
        sizeClasses
      )
    "
    @keydown.esc.capture="handleEscape"
  >
    <div
      class="grid size-full transition-[grid-template-columns] duration-300 ease-out"
      :style="gridStyle"
    >
      <nav
        class="flex h-full flex-col overflow-hidden bg-modal-panel-background"
        :inert="!showLeftPanel"
        :aria-hidden="!showLeftPanel"
      >
        <header
          data-component-id="LeftPanelHeader"
          class="flex h-18 w-full shrink-0 items-center-safe gap-2 pr-3 pl-6"
        >
          <slot name="leftPanelHeaderTitle" />
          <Button
            v-if="!notMobile && showLeftPanel"
            size="lg"
            class="ml-auto w-10 p-0"
            :aria-label="t('g.hideLeftPanel')"
            @click="toggleLeftPanel"
          >
            <i class="icon-[lucide--panel-left-close]" />
          </Button>
        </header>
        <slot name="leftPanel" />
      </nav>

      <div class="flex flex-col overflow-hidden bg-base-background">
        <header v-if="$slots.header" :class="headerClass">
          <div :class="headerContentClass">
            <Button
              v-if="!notMobile && !showLeftPanel"
              size="lg"
              class="w-10 p-0"
              :aria-label="t('g.showLeftPanel')"
              @click="toggleLeftPanel"
            >
              <i class="icon-[lucide--panel-left]" />
            </Button>
            <slot name="header" />
          </div>
          <slot name="header-right-area" />
          <template v-if="!isRightPanelOpen">
            <Button
              v-if="hasRightPanel"
              size="lg"
              class="w-10 p-0"
              :aria-label="t('g.showRightPanel')"
              @click="toggleRightPanel"
            >
              <i class="icon-[lucide--panel-right] size-4" />
            </Button>
            <Button
              size="lg"
              class="w-10"
              :variant="closeButtonVariant"
              :aria-label="t('g.closeDialog')"
              @click="closeDialog"
            >
              <i class="pi pi-times" />
            </Button>
          </template>
        </header>

        <main class="flex min-h-0 flex-1 flex-col">
          <slot name="contentFilter" />
          <h2
            v-if="!hasLeftPanel"
            class="m-0 px-6 pt-2 pb-6 text-2xl capitalize select-none"
          >
            {{ contentTitle }}
          </h2>
          <div
            ref="contentContainer"
            data-testid="base-modal-content"
            :class="contentContainerClass"
          >
            <slot name="content" />
          </div>
        </main>
      </div>

      <aside
        v-if="hasRightPanel"
        class="overflow-hidden"
        :inert="!isRightPanelOpen"
        :aria-hidden="!isRightPanelOpen"
      >
        <div
          class="flex h-full w-72 min-w-72 flex-col bg-modal-panel-background"
        >
          <header
            data-component-id="RightPanelHeader"
            class="flex h-18 shrink-0 items-center gap-2 px-6"
          >
            <h2
              v-if="rightPanelTitle"
              class="flex-1 text-base font-semibold select-none"
            >
              {{ rightPanelTitle }}
            </h2>
            <div v-else class="flex-1">
              <slot name="rightPanelHeaderTitle" />
            </div>
            <slot name="rightPanelHeaderActions" />
            <Button
              size="lg"
              class="w-10 p-0"
              :aria-label="t('g.hideRightPanel')"
              @click="toggleRightPanel"
            >
              <i class="icon-[lucide--panel-right-close] size-4" />
            </Button>
            <Button
              size="lg"
              class="w-10 p-0"
              :variant="closeButtonVariant"
              :aria-label="t('g.closeDialog')"
              @click="closeDialog"
            >
              <i class="pi pi-times" />
            </Button>
          </header>
          <div class="min-h-0 flex-1 overflow-y-auto">
            <slot name="rightPanel" />
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useBreakpoints } from '@vueuse/core'
import { computed, inject, ref, useSlots, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type { ButtonVariants } from '@comfyorg/design-system/button.variants'
import { OnCloseKey } from '@/types/widgetTypes'
import { cn } from '@comfyorg/tailwind-utils'

const { t } = useI18n()

const SIZE_CLASSES = {
  md: 'h-[80vh] w-[90vw] max-w-[1400px]',
  lg: 'h-[80vh] max-h-[1026px] w-[90vw] max-w-[1280px] min-[1450px]:max-w-[1724px] min-[3000px]:max-h-[1320px] min-[3000px]:max-w-[2200px]'
} as const

type ModalSize = keyof typeof SIZE_CLASSES
type ContentPadding = 'default' | 'compact' | 'none'
type HeaderPadding = 'default' | 'symmetric'

const {
  contentTitle,
  rightPanelTitle,
  size = 'lg',
  leftPanelWidth = '14rem',
  contentPadding = 'default',
  headerPadding = 'default',
  closeButtonVariant
} = defineProps<{
  contentTitle: string
  rightPanelTitle?: string
  size?: ModalSize
  leftPanelWidth?: string
  contentPadding?: ContentPadding
  headerPadding?: HeaderPadding
  closeButtonVariant?: ButtonVariants['variant']
}>()

const sizeClasses = computed(() => SIZE_CLASSES[size])

const isRightPanelOpen = defineModel<boolean>('rightPanelOpen', {
  default: false
})

const slots = useSlots()
const hasLeftPanel = computed(() => !!slots.leftPanel)
const hasRightPanel = computed(() => !!slots.rightPanel)

const BREAKPOINTS = { md: 880 }

const closeDialog = inject(OnCloseKey, () => {})

const breakpoints = useBreakpoints(BREAKPOINTS)
const notMobile = breakpoints.greater('md')

const isLeftPanelOpen = ref<boolean>(true)
const mobileMenuOpen = ref<boolean>(false)
const contentContainer = ref<HTMLElement | null>(null)

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

const headerClass = computed(() =>
  cn(
    'flex w-full items-center justify-between gap-2',
    headerPadding === 'symmetric' ? 'px-6 py-5' : 'h-18 px-6'
  )
)

const headerContentClass = computed(() =>
  cn(
    'flex min-w-0 flex-1 gap-2',
    headerPadding === 'symmetric' && 'min-h-10 items-center'
  )
)

const contentContainerClass = computed(() =>
  cn(
    'flex scrollbar-custom min-h-0 flex-1 flex-col overflow-y-auto',
    contentPadding === 'default' && 'px-6 pt-0 pb-10',
    contentPadding === 'compact' && 'px-6 pt-0 pb-2'
  )
)

const gridStyle = computed(() => ({
  gridTemplateColumns: hasRightPanel.value
    ? `${hasLeftPanel.value && showLeftPanel.value ? leftPanelWidth : '0rem'} 1fr ${isRightPanelOpen.value ? '18rem' : '0rem'}`
    : `${hasLeftPanel.value && showLeftPanel.value ? leftPanelWidth : '0rem'} 1fr`
}))

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
  const target = event.target
  if (!(target instanceof HTMLElement)) return
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  ) {
    return
  }
  if (isRightPanelOpen.value) {
    event.stopPropagation()
    isRightPanelOpen.value = false
  }
}

defineExpose({
  getContentScrollTop: () => contentContainer.value?.scrollTop ?? 0,
  setContentScrollTop: (scrollTop: number) => {
    if (contentContainer.value) contentContainer.value.scrollTop = scrollTop
  }
})
</script>
