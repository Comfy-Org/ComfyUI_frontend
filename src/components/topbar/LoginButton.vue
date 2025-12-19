<template>
  <Button
    v-if="!isLoggedIn"
    variant="secondary"
    size="icon"
    class="rounded-full bg-secondary-background text-base-foreground hover:bg-secondary-background-hover"
    @click="handleSignIn()"
    @mouseenter="showPopover"
    @mouseleave="hidePopover"
  >
    <i class="icon-[lucide--user] size-4" />
  </Button>
  <Popover
    ref="popoverRef"
    class="p-2"
    @mouseout="hidePopover"
    @mouseover="cancelHidePopover"
  >
    <div>
      <div class="mb-1">{{ t('auth.loginButton.tooltipHelp') }}</div>
      <a
        :href="apiNodesOverviewUrl"
        target="_blank"
        class="text-neutral-500 hover:text-primary"
        >{{ t('auth.loginButton.tooltipLearnMore') }}</a
      >
    </div>
  </Popover>
</template>

<script setup lang="ts">
import Popover from 'primevue/popover'
import { ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useExternalLink } from '@/composables/useExternalLink'
import { t } from '@/i18n'

const { isLoggedIn, handleSignIn } = useCurrentUser()
const { buildDocsUrl } = useExternalLink()
const apiNodesOverviewUrl = buildDocsUrl(
  '/tutorials/api-nodes/overview#api-nodes',
  {
    includeLocale: true
  }
)
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
