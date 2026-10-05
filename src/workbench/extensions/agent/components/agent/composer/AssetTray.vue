<script setup lang="ts">
import { usePreferredReducedMotion, useScroll } from '@vueuse/core'
import { computed, onMounted, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'
import Button from '@/components/ui/button/Button.vue'
import { useOverflowObserver } from '@/composables/element/useOverflowObserver'

import type { ComposerAttachment } from '../../../types/composerAttachment'
import AttachmentChip from './AttachmentChip.vue'

const { attachments, highlightedIds = [] } = defineProps<{
  attachments: ComposerAttachment[]
  highlightedIds?: string[]
}>()
const emit = defineEmits<{ remove: [id: string] }>()
const { t } = useI18n()
const scrollContainer = useTemplateRef<HTMLElement>('scrollContainer')
const reducedMotion = usePreferredReducedMotion()
const { x, arrivedState, measure } = useScroll(scrollContainer, {
  behavior: () => (reducedMotion.value === 'reduce' ? 'auto' : 'smooth')
})
const { isOverflowing, checkOverflow } = useOverflowObserver(scrollContainer, {
  debounceTime: 0,
  onCheck: measure
})
onMounted(checkOverflow)
const hasMoreLeft = computed(() => isOverflowing.value && !arrivedState.left)
const hasMoreRight = computed(() => isOverflowing.value && !arrivedState.right)

function scrollPage(direction: -1 | 1): void {
  const element = scrollContainer.value
  if (!element) return
  x.value = Math.max(
    0,
    Math.min(
      element.scrollWidth - element.clientWidth,
      x.value + direction * element.clientWidth
    )
  )
}
</script>

<template>
  <div
    role="region"
    :aria-label="t('assetBrowser.assets')"
    class="relative max-w-full min-w-0 shrink-0 overflow-hidden rounded-t-lg"
  >
    <div
      ref="scrollContainer"
      data-testid="composer-asset-section"
      role="group"
      tabindex="0"
      :aria-label="
        t('g.asset', { count: attachments.length }, attachments.length)
      "
      class="flex scrollbar-custom max-w-full min-w-0 flex-nowrap gap-2 overflow-x-auto overflow-y-hidden p-3 focus-visible:ring-1 focus-visible:ring-border-default focus-visible:outline-none focus-visible:ring-inset"
    >
      <AttachmentChip
        v-for="item in attachments"
        :key="item.id"
        :name="item.name"
        :preview-url="item.previewUrl"
        :uploading="item.uploading"
        :highlighted="highlightedIds.includes(item.id)"
        @remove="emit('remove', item.id)"
      />
    </div>
    <template v-if="isOverflowing">
      <div
        :class="
          cn(
            'pointer-events-none absolute inset-y-0 left-0 z-10 flex w-12 items-center pl-2',
            hasMoreLeft &&
              'bg-linear-to-r from-secondary-background to-transparent'
          )
        "
      >
        <Button
          variant="base"
          size="icon"
          :aria-label="t('g.scrollLeft')"
          :disabled="!hasMoreLeft"
          class="pointer-events-auto size-7 shrink-0 rounded-full shadow-sm ring-1 ring-border-subtle"
          @click="scrollPage(-1)"
        >
          <span aria-hidden="true" class="icon-[lucide--chevron-left] size-4" />
        </Button>
      </div>
      <div
        :class="
          cn(
            'pointer-events-none absolute inset-y-0 right-0 z-10 flex w-12 items-center justify-end pr-2',
            hasMoreRight &&
              'bg-linear-to-l from-secondary-background to-transparent'
          )
        "
      >
        <Button
          variant="base"
          size="icon"
          :aria-label="t('g.scrollRight')"
          :disabled="!hasMoreRight"
          class="pointer-events-auto size-7 shrink-0 rounded-full shadow-sm ring-1 ring-border-subtle"
          @click="scrollPage(1)"
        >
          <span
            aria-hidden="true"
            class="icon-[lucide--chevron-right] size-4"
          />
        </Button>
      </div>
    </template>
  </div>
</template>
