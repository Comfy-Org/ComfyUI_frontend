<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import { useSignInHref } from '../../../composables/useSignInHref'
import { requestWorkshopBuyCredits } from '../../../config/workshop-buy-credits'
import { leaveForSignIn } from '../../../config/workshop-return'
import type { StudioGate } from '../../../lib/workshop/cinematic-studio/gate'
import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'
import { tc, tcPlural } from '../../../lib/workshop/cinematic-studio/copy'

const {
  gate,
  workspaceName,
  rendering,
  canGenerate,
  takes,
  locale = 'en'
} = defineProps<{
  gate: StudioGate
  workspaceName?: string
  rendering: boolean
  canGenerate: boolean
  takes: number
  locale?: Locale
}>()

const emit = defineEmits<{ generate: []; cancel: [] }>()

const signInHref = useSignInHref(locale)
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <Button
      v-if="gate === 'signedOut'"
      as="a"
      :href="signInHref"
      class="h-12 w-full"
      @click="leaveForSignIn($event, signInHref)"
    >
      {{ t('workshop.run.signIn', locale) }}
    </Button>
    <template v-else-if="gate === 'noCredits'">
      <p class="text-xs text-content-secondary">
        {{
          t('workshop.error.noCreditsCloud', locale).replace(
            '{workspace}',
            () => workspaceName ?? ''
          )
        }}
      </p>
      <Button class="h-12 w-full" @click="requestWorkshopBuyCredits">
        {{ t('workshop.run.buyCredits', locale) }}
      </Button>
    </template>
    <p
      v-else-if="gate === 'memberNoCredits'"
      class="text-xs text-content-secondary"
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
      class="h-12 w-full"
      @click="emit('cancel')"
    >
      {{ tc('cinematic.output.cancel', locale) }}
    </Button>
    <Button
      v-else
      class="h-12 w-full justify-between px-5"
      :disabled="!canGenerate"
      data-testid="cinematic-generate"
      @click="emit('generate')"
    >
      {{ tc('cinematic.output.generate', locale) }}
      <span class="text-xs font-bold tracking-wider">
        {{ tcPlural('cinematic.output.takeCount', takes, locale) }}
      </span>
    </Button>
    <p v-if="gate === 'unavailable'" class="text-xs text-primary-warm-gray">
      {{ tc('cinematic.output.unavailable', locale) }}
    </p>
  </div>
</template>
