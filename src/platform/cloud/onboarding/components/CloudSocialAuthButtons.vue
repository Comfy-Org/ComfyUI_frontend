<template>
  <SocialAuthButtons
    :google-label="googleLabel"
    :github-label="githubLabel"
    :button-class="
      cn(
        buttonVariants({ variant: 'brand-ghost', size: 'brand' }),
        'w-full gap-3'
      )
    "
    label-class="relative top-[0.15em] inline-block"
    @google="emit('google')"
    @github="emit('github')"
  />

  <p
    v-if="showInAppBrowserNotice"
    class="my-0 text-xs/5 text-primary-comfy-canvas/60"
    data-testid="google-sso-in-app-browser-notice"
  >
    {{ t('auth.login.googleSsoInAppBrowserNotice') }}
  </p>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import SocialAuthButtons from '@comfyorg/account/SocialAuthButtons.vue'
import { cn } from '@comfyorg/tailwind-utils'

import { buttonVariants } from '@/components/ui/button/button.variants'

const {
  googleLabel,
  githubLabel,
  showInAppBrowserNotice = false
} = defineProps<{
  googleLabel: string
  githubLabel: string
  showInAppBrowserNotice?: boolean
}>()

const emit = defineEmits<{
  google: []
  github: []
}>()

const { t } = useI18n()
</script>
