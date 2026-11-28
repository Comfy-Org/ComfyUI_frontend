<template>
  <PopoverRoot v-model:open="open">
    <PopoverAnchor as="template" :reference="anchor ?? undefined" />
    <PopoverContent
      :side-offset="8"
      class="workflow-popover-fade w-fit rounded-xl border-none bg-transparent p-0 shadow-lg transition-opacity duration-150 ease-out data-[state=closed]:animate-none data-[state=open]:animate-none"
      @open-auto-focus="!clicked && $event.preventDefault()"
      @close-auto-focus.prevent="restoreFocus"
      @interact-outside="onInteractOutside"
      @mouseenter="stopHide"
      @mouseleave="handlePopoverMouseLeave"
    >
      <div
        class="flex max-w-62.5 flex-col overflow-hidden rounded-xl bg-popover text-foreground"
      >
        <div
          v-if="thumbnailUrl && !isActiveTab"
          class="workflow-preview-thumbnail relative p-2"
        >
          <img
            :src="thumbnailUrl"
            class="block h-50 rounded-lg bg-secondary object-cover p-2 shadow-lg"
            :style="{ width: `${POPOVER_WIDTH}px` }"
          />
        </div>
        <div class="px-3 pt-1 pb-2">
          <span class="block text-sm font-medium wrap-anywhere">
            {{ workflowFilename }}
          </span>
          <ul
            v-if="!isActiveTab && statuses.length > 0"
            data-testid="workflow-tab-popover-statuses"
            class="mt-1.5 flex list-none flex-col gap-1 p-0"
          >
            <li
              v-for="status in statuses"
              :key="status"
              class="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span
                aria-hidden="true"
                class="inline-flex size-3.5 shrink-0 items-center justify-center"
              >
                <i
                  v-if="STATUS_ICON_CLASSES[status]"
                  :class="STATUS_ICON_CLASSES[status]"
                />
                <span
                  v-else
                  :class="cn('size-2 rounded-full', STATUS_DOT_CLASSES[status])"
                />
              </span>
              <span>{{ t(TAB_POPOVER_STATUS_I18N_KEYS[status]) }}</span>
            </li>
          </ul>
        </div>
      </div>
    </PopoverContent>
  </PopoverRoot>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useTimeoutFn } from '@vueuse/core'
import { PopoverAnchor, PopoverRoot } from 'reka-ui'
import type { FocusOutsideEvent, PointerDownOutsideEvent } from 'reka-ui'
import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { usePopoverViewportDismiss } from '@comfyorg/design-system/lib/popover/usePopoverViewportDismiss'

import type { TabPopoverStatusKind } from './workflowTabStatus'
import { TAB_POPOVER_STATUS_I18N_KEYS } from './workflowTabStatus'

const POPOVER_WIDTH = 250

const STATUS_ICON_CLASSES: Partial<Record<TabPopoverStatusKind, string>> = {
  failed: 'icon-[lucide--octagon-alert] size-3.5 text-destructive',
  'agent-working':
    'icon-[lucide--loader-circle] size-3.5 text-muted-foreground motion-safe:animate-spin',
  'workflow-running':
    'icon-[lucide--loader-circle] size-3.5 text-muted-foreground motion-safe:animate-spin',
  'run-finished': 'icon-[lucide--circle-check] size-3.5 text-success'
}

const STATUS_DOT_CLASSES: Partial<Record<TabPopoverStatusKind, string>> = {
  waiting: 'bg-warning',
  'agent-replied': 'bg-primary',
  unsaved: 'bg-muted-foreground'
}

interface Props {
  anchor: HTMLElement | null
  hovered: boolean
  focused?: boolean
  workflowFilename: string
  thumbnailUrl?: string
  isActiveTab: boolean
  statuses?: readonly TabPopoverStatusKind[]
}

const {
  anchor,
  hovered,
  focused = false,
  workflowFilename,
  thumbnailUrl,
  isActiveTab,
  statuses = []
} = defineProps<Props>()
const { t } = useI18n()
const open = defineModel<boolean>('open', { default: false })
const clicked = defineModel<boolean>('clicked', { default: false })
const outside = ref(false)
watch(open, (value) => {
  stopShow()
  stopHide()
  if (value) outside.value = false
})
const { start: startShow, stop: stopShow } = useTimeoutFn(
  () => {
    clicked.value = false
    open.value = true
  },
  200,
  { immediate: false }
)
const { start: startHide, stop: stopHide } = useTimeoutFn(
  () => {
    open.value = false
  },
  100,
  { immediate: false }
)
function showPopover() {
  stopHide()
  startShow()
}
function hidePopover() {
  stopShow()
  startHide()
}
function handlePopoverMouseLeave() {
  if (!focused) hidePopover()
}
function restoreFocus() {
  if (clicked.value && !outside.value)
    anchor?.querySelector<HTMLElement>('[role="tab"]')?.focus()
}
function onInteractOutside(event: FocusOutsideEvent | PointerDownOutsideEvent) {
  const target = event.detail.originalEvent.target
  if (target instanceof Node && anchor?.contains(target)) {
    event.preventDefault()
  } else {
    outside.value = true
  }
}
watch(
  () => hovered,
  (isHovered) => {
    if (isHovered) showPopover()
    else if (!focused) hidePopover()
  }
)
watch(
  () => focused,
  (isFocused) => {
    if (isFocused) showPopover()
    else if (!hovered) hidePopover()
  }
)
usePopoverViewportDismiss(open, () => anchor)
</script>
