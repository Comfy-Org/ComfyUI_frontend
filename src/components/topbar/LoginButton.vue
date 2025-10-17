<template>
  <Button
    v-if="!isLoggedIn"
    :label="t('auth.login.loginButton')"
    outlined
    severity="secondary"
    class="text-neutral border-black/50 px-4 capitalize dark-theme:border-white/50 dark-theme:text-white"
    @click="handleSignIn()"
    @mouseenter="showPopover"
    @mouseleave="hidePopover"
  />

  <Popover
    ref="popoverRef"
    class="p-2"
    @mouseout="hidePopover"
    @mouseover="cancelHidePopover"
  >
    <div>
      <div class="mb-1">{{ t('auth.loginButton.tooltipHelp') }}</div>
      <a
        href="https://docs.comfy.org/tutorials/api-nodes/overview#api-nodes"
        target="_blank"
        class="text-neutral-500 hover:text-primary"
        >{{ t('auth.loginButton.tooltipLearnMore') }}</a
      >
    </div>
  </Popover>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import { ref } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { t } from '@/i18n'

const { isLoggedIn, handleSignIn } = useCurrentUser()
const popoverRef = ref<InstanceType<typeof Popover> | null>(null)
let hideTimeout: ReturnType<typeof setTimeout> | null = null
let showTimeout: ReturnType<typeof setTimeout> | null = null

const showPopover = (event: Event) => {
  // Clear any existing timeouts
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = null
  }
  if (showTimeout) {
    clearTimeout(showTimeout)
    showTimeout = null
  }

  showTimeout = setTimeout(() => {
    if (popoverRef.value) {
      popoverRef.value.show(event, event.target as HTMLElement)
    }
  }, 200)
}

const cancelHidePopover = () => {
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = null
  }
}

const hidePopover = () => {
  // Clear show timeout if mouse leaves before popover appears
  if (showTimeout) {
    clearTimeout(showTimeout)
    showTimeout = null
  }

  hideTimeout = setTimeout(() => {
    if (popoverRef.value) {
      popoverRef.value.hide()
    }
  }, 150) // Minimal delay to allow moving to popover
}
</script>
