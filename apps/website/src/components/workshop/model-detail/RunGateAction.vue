<script setup lang="ts">
import { Play } from '@lucide/vue'

import Button from '@/components/ui/button/Button.vue'
import { leaveForSignIn } from '@/config/workshop-return'
import type { Locale, TranslationKey } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

type RunGate =
  | 'unavailable'
  | 'resolving'
  | 'rollingOut'
  | 'pending'
  | 'signedOut'
  | 'noCredits'
  | 'memberNoCredits'
  | 'ready'

const {
  gate,
  signInHref,
  workspaceName = '',
  switchPending = false,
  switchFailed = false,
  running = false,
  blockedLabel,
  locale = 'en'
} = defineProps<{
  gate: RunGate
  signInHref: string
  workspaceName?: string
  switchPending?: boolean
  switchFailed?: boolean
  running?: boolean
  blockedLabel: TranslationKey
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{
  buyCredits: []
  switchPersonal: []
  showApi: []
  run: []
  cancel: []
}>()

function runOrCancel() {
  if (running) emit('cancel')
  else emit('run')
}
</script>

<template>
  <Button
    v-if="gate === 'signedOut'"
    as="a"
    :href="signInHref"
    size="lg"
    class="w-full px-5"
    data-testid="run-button"
    data-gate="signedOut"
    @click="leaveForSignIn($event, signInHref)"
  >
    {{ t('workshop.run.signIn') }}
  </Button>
  <!-- The MVP rail (DES-1015): buying happens on platform, in a new
     tab, so this page and its inputs stay alive and the return is a
     balance re-read. Naming the workspace is what makes topping up
     the wrong wallet visible before it happens. -->
  <template v-else-if="gate === 'noCredits'">
    <p
      class="mb-2 text-sm font-bold text-content-secondary"
      data-testid="gate-note"
    >
      {{ t('workshop.error.noCreditsCloud', { workspace: workspaceName }) }}
    </p>
    <Button
      size="lg"
      class="w-full px-5"
      data-testid="run-button"
      data-gate="noCredits"
      @click="emit('buyCredits')"
    >
      {{ t('workshop.run.buyCredits') }}
    </Button>
  </template>
  <template v-else-if="gate === 'memberNoCredits'">
    <div class="mb-2 flex flex-col gap-1" data-testid="gate-note">
      <p class="text-sm font-bold text-content-secondary">
        {{ t('workshop.error.creditsTitle') }}
      </p>
      <p class="text-xs text-content-secondary">
        {{ t('workshop.error.memberNoCredits', { workspace: workspaceName }) }}
      </p>
    </div>
    <Button
      variant="outline"
      size="lg"
      class="w-full px-5"
      :disabled="switchPending"
      data-testid="run-button"
      data-gate="memberNoCredits"
      @click="emit('switchPersonal')"
    >
      {{
        t(
          switchPending
            ? 'workshop.run.preparingSession'
            : 'workshop.run.switchPersonal'
        )
      }}
    </Button>
    <p v-if="switchFailed" class="text-xs text-red-400" role="alert">
      {{ t('nav.workspaceSwitchError') }}
    </p>
  </template>
  <p
    v-else-if="gate === 'rollingOut'"
    class="flex min-h-14 flex-wrap items-center justify-center gap-x-1.5 px-2 text-center text-xs text-content-secondary sm:text-sm"
    data-testid="run-rollout-note"
  >
    {{ t('workshop.run.rollingOut') }}
    <button
      type="button"
      class="cursor-pointer font-bold text-primary-warm-white underline underline-offset-2 hover:text-primary-comfy-yellow"
      @click="emit('showApi')"
    >
      {{ t('workshop.run.rollingOutApi') }}
    </button>
  </p>
  <Button
    v-else-if="gate === 'ready'"
    size="lg"
    class="w-full px-5"
    data-testid="run-button"
    data-gate="ready"
    @click="runOrCancel"
  >
    <template v-if="!running" #prepend>
      <Play class="size-5 fill-current" aria-hidden="true" />
    </template>
    {{ t(running ? 'workshop.run.cancel' : 'workshop.run.run') }}
  </Button>
  <Button
    v-else
    size="lg"
    class="h-auto min-h-14 w-full px-5 py-3 text-center whitespace-normal"
    disabled
    data-testid="run-button"
    :data-gate="gate"
  >
    {{ t(blockedLabel) }}
  </Button>
</template>
