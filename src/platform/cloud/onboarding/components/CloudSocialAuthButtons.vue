<template>
  <Button
    type="button"
    variant="brand-ghost"
    size="brand"
    class="w-full gap-3"
    @click="emit('google')"
  >
    <i class="icon-[simple-icons--google] size-5" />
    <span class="relative top-[0.15em] inline-block">{{ googleLabel }}</span>
  </Button>

  <Button
    type="button"
    variant="brand-ghost"
    size="brand"
    class="w-full gap-3"
    @click="emit('github')"
  >
    <i class="icon-[simple-icons--github] size-5" />
    <span class="relative top-[0.15em] inline-block">{{ githubLabel }}</span>
  </Button>

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

import Button from '@/components/ui/button/Button.vue'

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
