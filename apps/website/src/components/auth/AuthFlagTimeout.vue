<script setup lang="ts">
/**
 * The website's counterpart of the cloud app's CloudAuthTimeoutView: shown
 * when the auth flag never answers, with the same copy. Restart reloads,
 * since no session exists to sign out of.
 */
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const CAUSES = [
  'auth.timeout.causes.firewall',
  'auth.timeout.causes.vpn',
  'auth.timeout.causes.extensions',
  'auth.timeout.causes.regional',
  'auth.timeout.causes.differentBrowser'
] as const

function restart() {
  window.location.reload()
}
</script>

<template>
  <section
    role="alert"
    class="mx-auto w-full max-w-md rounded-2xl border border-primary-comfy-canvas/15 bg-primary-comfy-canvas/4 p-8 text-center"
  >
    <h1 class="text-xl font-semibold text-primary-comfy-canvas">
      {{ t('auth.timeout.title', locale) }}
    </h1>
    <p class="mt-3 text-sm text-primary-comfy-canvas/70">
      {{ t('auth.timeout.message', locale) }}
    </p>

    <div
      class="mt-4 rounded-xl bg-primary-comfy-canvas/5 px-3 py-2 text-left text-sm"
    >
      <h2 class="mb-2 text-sm font-semibold text-primary-comfy-canvas">
        {{ t('auth.timeout.troubleshooting', locale) }}
      </h2>
      <ul class="my-0 list-none space-y-1.5 p-0 text-primary-comfy-canvas/70">
        <li v-for="cause in CAUSES" :key="cause" class="flex gap-2">
          <span>•</span>
          <span>{{ t(cause, locale) }}</span>
        </li>
      </ul>
    </div>

    <p class="mt-4 text-sm text-primary-comfy-canvas/55">
      {{ t('auth.timeout.helpText', locale) }}
      <a
        href="https://support.comfy.org"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary-comfy-canvas underline"
      >
        {{ t('auth.timeout.supportLink', locale) }}</a
      >.
    </p>

    <button
      type="button"
      class="hover:bg-primary-comfy-yellow/90 bg-primary-comfy-yellow mt-6 flex h-12 w-full items-center justify-center rounded-xl font-semibold text-primary-comfy-ink transition-colors"
      @click="restart"
    >
      {{ t('auth.timeout.restart', locale) }}
    </button>
  </section>
</template>
