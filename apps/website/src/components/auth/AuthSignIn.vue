<script setup lang="ts">
/**
 * Owns which of the two modes the page is in. Sign-in and sign-up are the
 * same page with different copy, so the links swap the panel in place with
 * a history entry instead of a reload: the shell, the hero and the settled
 * session stay mounted, as they do behind cloud's router.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { requestedReturnPath } from '../../config/workshop-return'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { AuthMode } from './AuthSignInPanel.vue'
import AuthSignInPanel from './AuthSignInPanel.vue'

const { mode: initialMode = 'signIn', locale = 'en' } = defineProps<{
  mode?: AuthMode
  locale?: Locale
}>()

const PATHS: Record<AuthMode, string> = {
  signIn: '/login/',
  signUp: '/signup/'
}
const TITLES = {
  signIn: 'auth.signIn.meta.title',
  signUp: 'auth.signUp.meta.title'
} as const

const mode = ref<AuthMode>(initialMode)

function show(next: AuthMode): void {
  mode.value = next
  document.title = t(TITLES[next], locale)
}

function switchMode(next: AuthMode): void {
  const destination = requestedReturnPath(window.location.search)
  window.history.pushState(
    {},
    '',
    destination
      ? `${PATHS[next]}?returnTo=${encodeURIComponent(destination)}`
      : PATHS[next]
  )
  show(next)
}

function onPopState(): void {
  const next = (Object.keys(PATHS) as AuthMode[]).find(
    (candidate) => PATHS[candidate] === window.location.pathname
  )
  if (next && next !== mode.value) show(next)
}

onMounted(() => window.addEventListener('popstate', onPopState))
onBeforeUnmount(() => window.removeEventListener('popstate', onPopState))
</script>

<template>
  <AuthSignInPanel
    :key="mode"
    :mode="mode"
    :locale="locale"
    @switch-mode="switchMode"
  />
</template>
