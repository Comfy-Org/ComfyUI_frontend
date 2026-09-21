<script setup lang="ts">
import { removeToast, useAuthToasts } from '../../config/auth-toast-state'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import AuthToastMessage from './AuthToastMessage.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const { messages } = useAuthToasts()
</script>

<template>
  <!-- Where the cloud app's toast lands on its login route (no canvas
       anchors there): top right, 1.25rem down and 0.75rem in. -->
  <div
    class="pointer-events-none fixed top-5 right-3 z-10000 h-fit w-[min(25rem,calc(100vw-1.5rem))] [word-break:break-word] whitespace-pre-line"
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
