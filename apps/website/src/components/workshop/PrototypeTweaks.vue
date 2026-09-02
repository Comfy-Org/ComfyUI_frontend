<script setup lang="ts">
import { Settings2 } from '@lucide/vue'
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger
} from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { AccountKind } from '../../composables/useMockSession'
import {
  EXISTING_CREDITS,
  WELCOME_CREDITS,
  useMockSession
} from '../../composables/useMockSession'
import type {
  ModelState,
  RunOutcome,
  Scope
} from '../../composables/usePrototypeTweaks'
import {
  MODEL_STATES,
  OUTPUT_COUNTS,
  RUN_OUTCOMES,
  SCOPES,
  usePrototypeTweaks
} from '../../composables/usePrototypeTweaks'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en', showRunControls = false } = defineProps<{
  locale?: Locale
  showRunControls?: boolean
}>()

const { session, signIn, signOut, setCredits, setSubscribed } = useMockSession()
const { outcome, modelState, scope, showStatuses, outputCount } =
  usePrototypeTweaks()

type SessionChoice = 'signedOut' | AccountKind
const SESSION_CHOICES: readonly SessionChoice[] = [
  'signedOut',
  'new',
  'existing'
]
const sessionLabel: Record<SessionChoice, TranslationKey> = {
  signedOut: 'workshop.proto.session.signedOut',
  new: 'workshop.proto.session.new',
  existing: 'workshop.proto.session.existing'
}

const account = computed(() =>
  session.value.status === 'signedIn' ? session.value.account : undefined
)
const sessionChoice = computed<SessionChoice>(() =>
  !account.value
    ? 'signedOut'
    : account.value.credits === WELCOME_CREDITS && !account.value.subscribed
      ? 'new'
      : 'existing'
)
const zeroBalance = computed(() => account.value?.credits === 0)

function onSessionChange(event: Event) {
  const choice = (event.target as HTMLSelectElement).value as SessionChoice
  if (choice === 'signedOut') signOut()
  else signIn(choice)
}

const scopeLabel: Record<Scope, TranslationKey> = {
  v1: 'workshop.proto.scope.v1',
  v2: 'workshop.proto.scope.v2'
}

const outcomeLabel: Record<RunOutcome, TranslationKey> = {
  success: 'workshop.proto.outcome.success',
  nsfw: 'workshop.proto.outcome.nsfw',
  validation: 'workshop.proto.outcome.validation',
  provider: 'workshop.proto.outcome.provider',
  rateLimit: 'workshop.proto.outcome.rateLimit'
}
const modelStateLabel: Record<ModelState, TranslationKey> = {
  none: 'workshop.proto.gate.none',
  policy: 'workshop.proto.gate.policy',
  unavailable: 'workshop.proto.gate.unavailable'
}

const switchClass = (on: boolean) =>
  cn(
    'relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-40',
    on ? 'bg-primary-comfy-yellow' : 'bg-transparency-white-t20'
  )
const knobClass = (on: boolean) =>
  cn(
    'absolute top-0.5 left-0.5 size-4 rounded-full bg-primary-comfy-ink transition-transform',
    on && 'translate-x-4'
  )
const selectClass =
  'h-8 w-full rounded-lg border border-transparency-white-t20 bg-transparency-white-t4 px-2 text-xs text-primary-warm-white outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50'
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger
      data-testid="prototype-tweaks"
      :aria-label="t('workshop.proto.title', locale)"
      :title="t('workshop.proto.title', locale)"
      class="border-primary-comfy-ink-light bg-site-dropdown focus-visible:ring-primary-comfy-yellow/50 fixed right-4 bottom-4 z-40 grid size-9 cursor-pointer place-items-center rounded-full border text-primary-warm-gray shadow-lg transition-colors outline-none hover:text-primary-warm-white focus-visible:ring-3"
    >
      <Settings2 class="size-4" aria-hidden="true" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        align="end"
        side="top"
        :side-offset="8"
        class="border-primary-comfy-ink-light bg-site-dropdown z-50 w-72 rounded-2xl border p-3 text-xs shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      >
        <p
          class="text-primary-comfy-yellow mb-3 text-[10px] font-bold tracking-widest uppercase"
        >
          {{ t('workshop.proto.title', locale) }}
        </p>

        <div class="flex flex-col gap-3">
          <label class="flex flex-col gap-1">
            <span class="text-primary-warm-gray">
              {{ t('workshop.proto.scope', locale) }}
            </span>
            <select
              v-model="scope"
              data-testid="tweak-scope"
              :class="selectClass"
            >
              <option
                v-for="option in SCOPES"
                :key="option"
                :value="option"
                class="bg-primary-comfy-ink"
              >
                {{ t(scopeLabel[option], locale) }}
              </option>
            </select>
          </label>

          <label class="flex items-center justify-between gap-3">
            <span class="text-primary-comfy-canvas">
              {{ t('workshop.proto.statuses', locale) }}
            </span>
            <button
              type="button"
              role="switch"
              :aria-checked="showStatuses"
              data-testid="tweak-statuses"
              :class="switchClass(showStatuses)"
              @click="showStatuses = !showStatuses"
            >
              <span :class="knobClass(showStatuses)" />
            </button>
          </label>

          <label class="flex flex-col gap-1">
            <span class="text-primary-warm-gray">
              {{ t('workshop.proto.session', locale) }}
            </span>
            <select
              :value="sessionChoice"
              data-testid="tweak-session"
              :class="selectClass"
              @change="onSessionChange"
            >
              <option
                v-for="choice in SESSION_CHOICES"
                :key="choice"
                :value="choice"
                class="bg-primary-comfy-ink"
              >
                {{ t(sessionLabel[choice], locale) }}
              </option>
            </select>
          </label>

          <label class="flex items-center justify-between gap-3">
            <span
              :class="
                cn(
                  'text-primary-comfy-canvas',
                  !account && 'text-primary-warm-gray'
                )
              "
            >
              {{ t('workshop.proto.subscribed', locale) }}
            </span>
            <button
              type="button"
              role="switch"
              :aria-checked="account?.subscribed ?? false"
              :disabled="!account"
              data-testid="tweak-subscribed"
              :class="switchClass(account?.subscribed ?? false)"
              @click="setSubscribed(!account?.subscribed)"
            >
              <span :class="knobClass(account?.subscribed ?? false)" />
            </button>
          </label>

          <label class="flex items-center justify-between gap-3">
            <span
              :class="
                cn(
                  'text-primary-comfy-canvas',
                  !account && 'text-primary-warm-gray'
                )
              "
            >
              {{ t('workshop.proto.zeroBalance', locale) }}
            </span>
            <button
              type="button"
              role="switch"
              :aria-checked="zeroBalance"
              :disabled="!account"
              data-testid="tweak-zero-balance"
              :class="switchClass(zeroBalance)"
              @click="setCredits(zeroBalance ? EXISTING_CREDITS : 0)"
            >
              <span :class="knobClass(zeroBalance)" />
            </button>
          </label>

          <template v-if="showRunControls">
            <label class="flex flex-col gap-1">
              <span class="text-primary-warm-gray">
                {{ t('workshop.proto.outcome', locale) }}
              </span>
              <select
                v-model="outcome"
                data-testid="tweak-outcome"
                :class="selectClass"
              >
                <option
                  v-for="option in RUN_OUTCOMES"
                  :key="option"
                  :value="option"
                  class="bg-primary-comfy-ink"
                >
                  {{ t(outcomeLabel[option], locale) }}
                </option>
              </select>
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-primary-warm-gray">
                {{ t('workshop.proto.gate', locale) }}
              </span>
              <select
                v-model="modelState"
                data-testid="tweak-model-state"
                :class="selectClass"
              >
                <option
                  v-for="option in MODEL_STATES"
                  :key="option"
                  :value="option"
                  class="bg-primary-comfy-ink"
                >
                  {{ t(modelStateLabel[option], locale) }}
                </option>
              </select>
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-primary-warm-gray">
                {{ t('workshop.proto.outputs', locale) }}
              </span>
              <select
                v-model="outputCount"
                data-testid="tweak-outputs"
                :class="selectClass"
              >
                <option
                  v-for="count in OUTPUT_COUNTS"
                  :key="count"
                  :value="count"
                  class="bg-primary-comfy-ink"
                >
                  {{ count }}
                </option>
              </select>
            </label>
          </template>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
