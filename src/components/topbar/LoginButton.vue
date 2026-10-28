<template>
  <PopoverRoot v-model:open="open">
    <PopoverAnchor as-child>
      <Button
        v-if="!isLoggedIn"
        ref="buttonRef"
        data-testid="login-button"
        variant="textonly"
        size="icon"
        :class="cn('group rounded-full p-0', className)"
        :aria-label="t('g.login')"
        @click="handleSignIn()"
        @mouseenter="showPopover"
        @mouseleave="hidePopover"
      >
        <span
          class="flex size-full items-center justify-center rounded-full bg-secondary transition-colors group-hover:bg-transparent"
        >
          <i class="icon-[lucide--user]" />
        </span>
      </Button>
    </PopoverAnchor>
    <PopoverContent
      class="w-auto rounded-lg border-border/50 p-2 shadow-lg data-[state=closed]:animate-none data-[state=open]:animate-none"
      @open-auto-focus.prevent
      @close-auto-focus.prevent
      @interact-outside="onInteractOutside"
      @mouseout="hidePopover"
      @mouseover="cancelHidePopover"
    >
      <div data-testid="login-button-popover">
        <div class="mb-1">{{ t('auth.loginButton.tooltipHelp') }}</div>
        <a
          data-testid="login-button-popover-learn-more"
          :href="apiNodesOverviewUrl"
          target="_blank"
          class="text-muted-foreground hover:text-primary"
          >{{ t('auth.loginButton.tooltipLearnMore') }}</a
        >
      </div>
    </PopoverContent>
  </PopoverRoot>
</template>

<script setup lang="ts">
import { unrefElement, useTimeoutFn } from '@vueuse/core'
import { PopoverAnchor, PopoverRoot } from 'reka-ui'
import type { FocusOutsideEvent, PointerDownOutsideEvent } from 'reka-ui'
import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
import type { HTMLAttributes } from 'vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import { usePopoverViewportDismiss } from '@comfyorg/design-system/lib/popover/usePopoverViewportDismiss'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useExternalLink } from '@/composables/useExternalLink'
import { cn } from '@comfyorg/tailwind-utils'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()

const { t } = useI18n()
const { isLoggedIn, handleSignIn } = useCurrentUser()
const { buildDocsUrl } = useExternalLink()
const apiNodesOverviewUrl = buildDocsUrl(
  '/tutorials/api-nodes/overview#api-nodes',
  {
    includeLocale: true
  }
)
const open = ref(false)
const buttonRef = ref<InstanceType<typeof Button> | null>(null)
function onInteractOutside(event: FocusOutsideEvent | PointerDownOutsideEvent) {
  const target = event.detail.originalEvent.target
  const anchor = unrefElement(buttonRef)
  if (
    target instanceof Node &&
    anchor instanceof HTMLElement &&
    anchor.contains(target)
  )
    event.preventDefault()
}
const { start: startShow, stop: stopShow } = useTimeoutFn(
  () => {
    open.value = true
  },
  200,
  { immediate: false }
)
const { start: startHide, stop: cancelHidePopover } = useTimeoutFn(
  () => {
    open.value = false
  },
  150,
  { immediate: false }
)
function showPopover() {
  cancelHidePopover()
  startShow()
}
function hidePopover() {
  stopShow()
  startHide()
}
usePopoverViewportDismiss(open, () => unrefElement(buttonRef))
</script>
