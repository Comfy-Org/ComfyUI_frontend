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
import type { StudioGate } from '../../../lib/workshop/cinematic-studio/gate'
import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'

const {
  gate,
  rendering,
  canGenerate,
  note,
  tooltip,
  wide = false,
  locale = 'en'
} = defineProps<{
  gate: StudioGate
  rendering: boolean
  canGenerate: boolean
  /** Why the slot is what it is, read out with the button. */
  note?: string
  /** Whether the note also shows as a tooltip. */
  tooltip: boolean
  wide?: boolean
  locale?: Locale
}>()

const emit = defineEmits<{ generate: []; cancel: [] }>()

const signInHref = useSignInHref(locale)
const personal = usePersonalWorkspaceSwitch()

const buttonClass = computed(() =>
  wide ? 'w-full rounded-full px-5' : 'shrink-0 rounded-full px-6'
)
const switchLabel = computed(() =>
  t(
    personal.pending.value
      ? 'workshop.run.preparingSession'
      : 'workshop.run.switchPersonal',
    locale
  )
)
</script>

<template>
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
    <TooltipRoot :disabled="!tooltip">
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
          {{ switchLabel }}
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
  <p
    v-if="personal.failed.value"
    role="alert"
    class="text-xs text-primary-comfy-red"
  >
    {{ t('nav.workspaceSwitchError', locale) }}
  </p>
</template>
