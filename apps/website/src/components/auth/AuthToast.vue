<script setup lang="ts">
import { removeToast, useAuthToasts } from '../../config/auth-toast-state'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import AuthToastMessage from './AuthToastMessage.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const { messages } = useAuthToasts()
</script>

<template>
  <div
    class="pointer-events-none fixed top-[calc(anchor(--graph-canvas-panel_top,1rem)+0.25rem)] left-[calc(anchor(--graph-canvas-panel_right,anchor(--docked-agent-panel_left,calc(100vw-0.75rem)))-25.5rem)] z-10000 h-fit w-100 [word-break:break-word] whitespace-pre-line"
    style="right: 20px; bottom: 20px"
  >
    <TransitionGroup
      tag="div"
      enter-from-class="translate-y-1/2 opacity-0"
      enter-active-class="transition-[transform,opacity] duration-300"
      leave-from-class="max-h-[1000px]"
      leave-active-class="[transition:max-height_0.45s_cubic-bezier(0,1,0,1),opacity_0.3s,margin-bottom_0.3s]"
      leave-to-class="toast-leaving max-h-0 overflow-hidden opacity-0"
    >
      <AuthToastMessage
        v-for="message in messages"
        :key="message.id"
        :message="message"
        :close-label="t('auth.toast.close', locale)"
        @close="removeToast"
      />
    </TransitionGroup>
  </div>
</template>
