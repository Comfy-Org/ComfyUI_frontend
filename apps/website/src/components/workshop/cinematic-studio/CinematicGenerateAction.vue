<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import { useSignInHref } from '../../../composables/useSignInHref'
import { requestWorkshopBuyCredits } from '../../../config/workshop-buy-credits'
import { leaveForSignIn } from '../../../config/workshop-return'
import type { StudioGate } from '../../../lib/workshop/cinematic-studio/gate'
import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'

const {
  gate,
  workspaceName,
  rendering,
  canGenerate,
  wide = false,
  locale = 'en'
} = defineProps<{
  gate: StudioGate
  workspaceName?: string
  rendering: boolean
  canGenerate: boolean
  wide?: boolean
  locale?: Locale
}>()

const emit = defineEmits<{ generate: []; cancel: [] }>()

const signInHref = useSignInHref(locale)
</script>

<template>
  <div
    :class="
      cn(
        'flex gap-3',
        wide ? 'flex-col-reverse *:w-full' : 'items-center justify-end'
      )
    "
  >
    <p
      v-if="gate === 'unavailable'"
      class="max-w-64 text-xs text-primary-warm-gray"
    >
      {{ tc('cinematic.output.unavailable', locale) }}
    </p>
    <Button
      v-if="gate === 'signedOut'"
      as="a"
      :href="signInHref"
      class="rounded-full px-5"
      @click="leaveForSignIn($event, signInHref)"
    >
      {{ t('workshop.run.signIn', locale) }}
    </Button>
    <template v-else-if="gate === 'noCredits'">
      <p class="max-w-64 text-xs text-content-secondary">
        {{
          t('workshop.error.noCreditsCloud', locale).replace(
            '{workspace}',
            () => workspaceName ?? ''
          )
        }}
      </p>
      <Button class="rounded-full px-5" @click="requestWorkshopBuyCredits">
        {{ t('workshop.run.buyCredits', locale) }}
      </Button>
    </template>
    <p
      v-else-if="gate === 'memberNoCredits'"
      class="max-w-64 text-xs text-content-secondary"
    >
      {{
        t('workshop.error.memberNoCredits', locale).replace(
          '{workspace}',
          () => workspaceName ?? ''
        )
      }}
    </p>
    <Button
      v-else-if="rendering"
      variant="outline"
      class="rounded-full px-5"
      @click="emit('cancel')"
    >
      {{ tc('cinematic.output.cancel', locale) }}
    </Button>
    <Button
      v-else
      class="rounded-full pr-4 pl-5"
      :disabled="!canGenerate"
      data-testid="cinematic-generate"
      @click="emit('generate')"
    >
      {{ tc('cinematic.output.generate', locale) }}
      <ArrowRight aria-hidden="true" />
    </Button>
  </div>
</template>
