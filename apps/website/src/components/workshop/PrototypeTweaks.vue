<script setup lang="ts">
import { Check, ChevronDown, Link, Settings2 } from '@lucide/vue'
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger
} from 'reka-ui'
import { computed, onMounted, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import {
  EXISTING_CREDITS,
  LOW_CREDITS,
  WELCOME_CREDITS,
  useMockSession
} from '../../composables/useMockSession'
import type {
  ModelState,
  RunOutcome,
  TopUpOutcome,
  Version
} from '../../composables/usePrototypeTweaks'
import {
  MODEL_STATES,
  RUN_OUTCOMES,
  TOP_UP_OUTCOMES,
  VERSIONS,
  usePrototypeTweaks
} from '../../composables/usePrototypeTweaks'
import type { SessionChoice, ShareState } from '../../config/workshop-share'
import {
  decodeShareSearch,
  encodeShareSearch
} from '../../config/workshop-share'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en', showRunControls = false } = defineProps<{
  locale?: Locale
  showRunControls?: boolean
}>()

const { session, signIn, signOut, setCredits, setSubscribed, setRole } =
  useMockSession()
const {
  outcome,
  modelState,
  version,
  showStatuses,
  groupVersions,
  topUpOutcome
} = usePrototypeTweaks()

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
const lowBalance = computed(() => account.value?.credits === LOW_CREDITS)
const isMember = computed(() => account.value?.role === 'member')

// A link from the panel reproduces its setup: the query wins over what the
// browser remembered.
onMounted(() => {
  const shared = decodeShareSearch(location.search)
  if (shared.version) version.value = shared.version
  if (shared.showStatuses !== undefined)
    showStatuses.value = shared.showStatuses
  if (shared.groupVersions !== undefined)
    groupVersions.value = shared.groupVersions
  if (shared.outcome) outcome.value = shared.outcome
  if (shared.modelState) modelState.value = shared.modelState
  if (shared.topUpOutcome) topUpOutcome.value = shared.topUpOutcome
  if (shared.session === 'signedOut') signOut()
  else if (shared.session) signIn(shared.session)
  if (shared.subscribed !== undefined) setSubscribed(shared.subscribed)
  if (shared.balance === 'zero') setCredits(0)
  else if (shared.balance === 'low') setCredits(LOW_CREDITS)
  if (shared.member) setRole('member')
  pageUrl.value = `${location.origin}${location.pathname}`
  pageSearch.value = location.search
})

const pageUrl = ref('')
const pageSearch = ref('')
const shareState = computed<ShareState>(() => ({
  version: version.value,
  showStatuses: showStatuses.value,
  groupVersions: groupVersions.value,
  session: sessionChoice.value,
  subscribed: account.value?.subscribed ?? true,
  balance: zeroBalance.value ? 'zero' : lowBalance.value ? 'low' : 'normal',
  member: isMember.value,
  outcome: outcome.value,
  modelState: modelState.value,
  topUpOutcome: topUpOutcome.value
}))
const shareUrl = computed(
  () =>
    `${pageUrl.value}${encodeShareSearch(shareState.value, pageSearch.value)}`
)
const copied = ref(false)
const copyLabel = computed(() =>
  copied.value
    ? t('workshop.proto.shareCopied', locale)
    : t('workshop.proto.shareCopy', locale)
)

async function copyShareUrl() {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    /* clipboard unavailable: the field below stays selectable */
  }
}

function onSessionChange(event: Event) {
  const choice = (event.target as HTMLSelectElement).value as SessionChoice
  if (choice === 'signedOut') signOut()
  else signIn(choice)
}

const versionLabel: Record<Version, TranslationKey> = {
  v1: 'workshop.proto.version.v1',
  'v1.1': 'workshop.proto.version.v1_1',
  'v1.2': 'workshop.proto.version.v1_2',
  v2: 'workshop.proto.version.v2'
}

const outcomeLabel: Record<RunOutcome, TranslationKey> = {
  success: 'workshop.proto.outcome.success',
  nsfw: 'workshop.proto.outcome.nsfw',
  expired: 'workshop.proto.outcome.expired',
  validation: 'workshop.proto.outcome.validation',
  provider: 'workshop.proto.outcome.provider',
  rateLimit: 'workshop.proto.outcome.rateLimit',
  timeout: 'workshop.proto.outcome.timeout'
}
const topUpOutcomeLabel: Record<TopUpOutcome, TranslationKey> = {
  landed: 'workshop.proto.topUp.landed',
  settling: 'workshop.proto.topUp.settling',
  unresolved: 'workshop.proto.topUp.unresolved'
}
const modelStateLabel: Record<ModelState, TranslationKey> = {
  none: 'workshop.proto.gate.none',
  degraded: 'workshop.proto.gate.degraded',
  deprecated: 'workshop.proto.gate.deprecated',
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
  'focus-visible:ring-primary-comfy-yellow/50 h-8 w-full appearance-none rounded-lg border border-transparency-white-t20 bg-transparency-white-t4 ps-2 pe-7 text-xs text-primary-warm-white outline-none focus-visible:ring-3'
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
        class="border-primary-comfy-ink-light bg-site-dropdown z-50 w-80 rounded-2xl border p-3 text-xs shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      >
        <p
          class="text-primary-comfy-yellow mb-3 text-[10px] font-bold tracking-widest uppercase"
        >
          {{ t('workshop.proto.title', locale) }}
        </p>

        <div class="flex flex-col gap-3">
          <label class="flex flex-col gap-1">
            <span class="text-primary-warm-gray">
              {{ t('workshop.proto.version', locale) }}
            </span>
            <span class="relative flex items-center">
              <select
                v-model="version"
                data-testid="tweak-version"
                :class="selectClass"
              >
                <option
                  v-for="option in VERSIONS"
                  :key="option"
                  :value="option"
                  class="bg-primary-comfy-ink"
                >
                  {{ t(versionLabel[option], locale) }}
                </option>
              </select>
              <ChevronDown
                class="pointer-events-none absolute right-2 size-3.5 text-primary-warm-gray"
                aria-hidden="true"
              />
            </span>
          </label>

          <label class="flex items-center justify-between gap-3">
            <span class="text-primary-comfy-canvas">
              {{ t('workshop.proto.families', locale) }}
            </span>
            <button
              type="button"
              role="switch"
              :aria-checked="groupVersions"
              data-testid="tweak-families"
              :class="switchClass(groupVersions)"
              @click="groupVersions = !groupVersions"
            >
              <span :class="knobClass(groupVersions)" />
            </button>
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
            <span class="relative flex items-center">
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
              <ChevronDown
                class="pointer-events-none absolute right-2 size-3.5 text-primary-warm-gray"
                aria-hidden="true"
              />
            </span>
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

          <label class="flex items-center justify-between gap-3">
            <span
              :class="
                cn(
                  'text-primary-comfy-canvas',
                  !account && 'text-primary-warm-gray'
                )
              "
            >
              {{ t('workshop.proto.lowBalance', locale) }}
            </span>
            <button
              type="button"
              role="switch"
              :aria-checked="lowBalance"
              :disabled="!account"
              data-testid="tweak-low-balance"
              :class="switchClass(lowBalance)"
              @click="setCredits(lowBalance ? EXISTING_CREDITS : LOW_CREDITS)"
            >
              <span :class="knobClass(lowBalance)" />
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
              {{ t('workshop.proto.member', locale) }}
            </span>
            <button
              type="button"
              role="switch"
              :aria-checked="isMember"
              :disabled="!account"
              data-testid="tweak-member"
              :class="switchClass(isMember)"
              @click="setRole(isMember ? 'owner' : 'member')"
            >
              <span :class="knobClass(isMember)" />
            </button>
          </label>

          <label class="flex flex-col gap-1">
            <span class="text-primary-warm-gray">
              {{ t('workshop.proto.topUp', locale) }}
            </span>
            <span class="relative flex items-center">
              <select
                v-model="topUpOutcome"
                data-testid="tweak-topup"
                :class="selectClass"
              >
                <option
                  v-for="option in TOP_UP_OUTCOMES"
                  :key="option"
                  :value="option"
                  class="bg-primary-comfy-ink"
                >
                  {{ t(topUpOutcomeLabel[option], locale) }}
                </option>
              </select>
              <ChevronDown
                class="pointer-events-none absolute right-2 size-3.5 text-primary-warm-gray"
                aria-hidden="true"
              />
            </span>
          </label>

          <template v-if="showRunControls">
            <label class="flex flex-col gap-1">
              <span class="text-primary-warm-gray">
                {{ t('workshop.proto.outcome', locale) }}
              </span>
              <span class="relative flex items-center">
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
                <ChevronDown
                  class="pointer-events-none absolute right-2 size-3.5 text-primary-warm-gray"
                  aria-hidden="true"
                />
              </span>
            </label>
            <p class="text-[10px] text-primary-warm-gray">
              {{ t('workshop.proto.outcomeHint', locale) }}
            </p>
            <label class="flex flex-col gap-1">
              <span class="text-primary-warm-gray">
                {{ t('workshop.proto.gate', locale) }}
              </span>
              <span class="relative flex items-center">
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
                <ChevronDown
                  class="pointer-events-none absolute right-2 size-3.5 text-primary-warm-gray"
                  aria-hidden="true"
                />
              </span>
            </label>
          </template>

          <div
            class="flex flex-col gap-2 border-t border-transparency-white-t8 pt-3"
          >
            <span class="text-primary-warm-gray">
              {{ t('workshop.proto.share', locale) }}
            </span>
            <div class="flex items-center gap-2">
              <input
                :value="shareUrl"
                readonly
                data-testid="tweak-share-url"
                :class="cn(selectClass, 'min-w-0 flex-1 truncate pe-2')"
                @focus="($event.target as HTMLInputElement).select()"
              />
              <button
                type="button"
                data-testid="tweak-share-copy"
                :aria-label="copyLabel"
                :title="copyLabel"
                :class="
                  cn(
                    'grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg transition-colors',
                    copied
                      ? 'bg-primary-comfy-yellow/20 text-primary-comfy-yellow'
                      : 'bg-primary-comfy-yellow text-primary-comfy-ink hover:opacity-90'
                  )
                "
                @click="copyShareUrl"
              >
                <Check v-if="copied" class="size-4" aria-hidden="true" />
                <Link v-else class="size-4" aria-hidden="true" />
              </button>
            </div>
            <p class="text-[10px] text-primary-warm-gray">
              {{ t('workshop.proto.shareHint', locale) }}
            </p>
          </div>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
