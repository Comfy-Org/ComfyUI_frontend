<script setup lang="ts">
import {
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger
} from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import { usePersonalWorkspaceSwitch } from '../../../composables/usePersonalWorkspaceSwitch'
import { useSignInHref } from '../../../composables/useSignInHref'
import { requestWorkshopBuyCredits } from '../../../config/workshop-buy-credits'
import { leaveForSignIn } from '../../../config/workshop-return'
import type { ShotEstimate } from '../../../lib/workshop/cinematic-studio/estimate'
import {
  formatCreditRange,
  takesWithin
} from '../../../lib/workshop/cinematic-studio/estimate'
import type { StudioGate } from '../../../lib/workshop/cinematic-studio/gate'
import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'

const {
  gate,
  workspaceName,
  rendering,
  canGenerate,
  blockedNote,
  estimate,
  credits,
  wide = false,
  locale = 'en'
} = defineProps<{
  gate: StudioGate
  workspaceName?: string
  rendering: boolean
  canGenerate: boolean
  blockedNote?: string
  estimate?: ShotEstimate
  credits?: number
  wide?: boolean
  locale?: Locale
}>()

const emit = defineEmits<{
  generate: []
  cancel: []
  reduceTakes: [takes: number]
}>()

const signInHref = useSignInHref(locale)
const personal = usePersonalWorkspaceSwitch()

const creditGate = computed(
  () => gate === 'noCredits' || gate === 'memberNoCredits'
)
const shortfall = computed(() => {
  if (!creditGate.value || !estimate || credits === undefined) return undefined
  const key =
    estimate.takes === 1
      ? 'cinematic.credits.shortOne'
      : 'cinematic.credits.short'
  return {
    note: tc(key, locale)
      .replace('{takes}', String(estimate.takes))
      .replace('{credits}', formatCreditRange(estimate.total, locale))
      .replace('{balance}', credits.toLocaleString(locale)),
    fits: Math.min(takesWithin(credits, estimate.perTake), estimate.takes - 1)
  }
})
const note = computed(() => {
  const workspace = () => workspaceName ?? ''
  if (shortfall.value) return shortfall.value.note
  if (gate === 'noCredits')
    return t('workshop.error.noCreditsCloud', locale).replace(
      '{workspace}',
      workspace
    )
  if (gate === 'memberNoCredits')
    return t('workshop.error.memberNoCredits', locale).replace(
      '{workspace}',
      workspace
    )
  if (gate === 'unavailable') return tc('cinematic.output.unavailable', locale)
  return undefined
})
const cost = computed(() => {
  if (!estimate)
    return {
      label: tc('cinematic.credits.varies', locale),
      hint: tc('cinematic.credits.variesHint', locale)
    }
  return {
    label: tc('cinematic.credits.estimate', locale).replace(
      '{credits}',
      formatCreditRange(estimate.total, locale)
    ),
    detail:
      estimate.takes > 1
        ? tc('cinematic.credits.perTake', locale)
            .replace('{takes}', String(estimate.takes))
            .replace('{credits}', formatCreditRange(estimate.perTake, locale))
        : undefined
  }
})
const showCost = computed(
  () => !rendering && gate !== 'unavailable' && gate !== 'pending'
)
const buttonClass = computed(() =>
  wide ? 'w-full rounded-full px-5' : 'shrink-0 rounded-full px-6'
)
</script>

<template>
  <div :class="cn('flex flex-col gap-2.5', !wide && 'shrink-0 items-end')">
    <p
      v-if="shortfall"
      role="status"
      data-testid="cinematic-credit-note"
      :class="
        cn('text-xs text-primary-warm-white', !wide && 'max-w-72 text-right')
      "
    >
      {{ shortfall.note }}
    </p>
    <p v-else-if="wide && note" class="text-xs text-content-secondary">
      {{ note }}
    </p>
    <p
      v-if="blockedNote"
      role="status"
      :class="
        cn('text-xs text-content-secondary', !wide && 'max-w-64 text-right')
      "
    >
      {{ blockedNote }}
    </p>
    <p
      v-if="personal.failed.value"
      role="alert"
      class="text-xs text-primary-comfy-red"
    >
      {{ t('nav.workspaceSwitchError', locale) }}
    </p>
    <div
      :class="
        cn(
          'flex items-center gap-3',
          wide && 'flex-col items-stretch gap-2',
          !wide && 'flex-wrap justify-end'
        )
      "
    >
      <span
        v-if="showCost"
        data-testid="cinematic-estimate"
        :title="cost.hint"
        :class="
          cn('flex flex-col leading-tight', wide ? 'items-center' : 'items-end')
        "
      >
        <span class="text-xs text-primary-warm-white">{{ cost.label }}</span>
        <span v-if="cost.detail" class="text-[11px] text-primary-warm-gray">
          {{ cost.detail }}
        </span>
      </span>
      <Button
        v-if="shortfall && shortfall.fits > 0"
        variant="outline"
        :class="buttonClass"
        @click="emit('reduceTakes', shortfall.fits)"
      >
        {{
          shortfall.fits === 1
            ? tc('cinematic.credits.reduceOne', locale)
            : tc('cinematic.credits.reduce', locale).replace(
                '{takes}',
                String(shortfall.fits)
              )
        }}
      </Button>
      <Button
        v-if="gate === 'signedOut'"
        as="a"
        :href="signInHref"
        :class="buttonClass"
        @click="leaveForSignIn($event, signInHref)"
      >
        {{ t('workshop.run.signIn', locale) }}
      </Button>
      <Button
        v-else-if="gate === 'pending'"
        disabled
        :class="buttonClass"
        data-testid="cinematic-generate"
      >
        {{ tc('cinematic.output.checking', locale) }}
      </Button>
      <Button
        v-else-if="rendering"
        variant="outline"
        :class="buttonClass"
        @click="emit('cancel')"
      >
        {{ tc('cinematic.output.cancel', locale) }}
      </Button>
      <TooltipProvider v-else :delay-duration="150">
        <TooltipRoot :disabled="wide || !note || !!shortfall">
          <TooltipTrigger as-child>
            <Button
              v-if="gate === 'noCredits'"
              :class="buttonClass"
              :aria-description="note"
              @click="requestWorkshopBuyCredits"
            >
              {{ t('workshop.run.buyCredits', locale) }}
            </Button>
            <Button
              v-else-if="gate === 'memberNoCredits'"
              :class="buttonClass"
              :aria-description="note"
              :disabled="personal.pending.value"
              @click="personal.switchToPersonal"
            >
              {{
                t(
                  personal.pending.value
                    ? 'workshop.run.preparingSession'
                    : 'workshop.run.switchPersonal',
                  locale
                )
              }}
            </Button>
            <span v-else :class="cn('inline-flex shrink-0', wide && 'w-full')">
              <Button
                :class="buttonClass"
                :disabled="!canGenerate"
                :aria-description="note"
                data-testid="cinematic-generate"
                @click="emit('generate')"
              >
                {{ tc('cinematic.output.generate', locale) }}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipPortal>
            <TooltipContent
              side="top"
              :side-offset="8"
              class="z-60 max-w-64 rounded-xl border border-transparency-white-t8 bg-primary-comfy-ink-light px-3 py-2 text-xs/relaxed text-primary-comfy-canvas shadow-lg"
            >
              {{ note }}
            </TooltipContent>
          </TooltipPortal>
        </TooltipRoot>
      </TooltipProvider>
    </div>
  </div>
</template>
