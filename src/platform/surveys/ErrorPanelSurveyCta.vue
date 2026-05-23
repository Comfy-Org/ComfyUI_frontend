<template>
  <div
    v-if="shouldRenderCta"
    data-testid="error-panel-survey-cta"
    class="flex min-w-0 shrink-0 items-center justify-between gap-2 border-t border-interface-stroke px-4 py-3"
  >
    <span class="min-w-0 flex-1 text-sm/tight text-muted-foreground">
      {{ t('errorPanelSurvey.ctaText') }}
    </span>
    <div class="flex shrink-0 items-center gap-1">
      <Button variant="overlay-white" size="sm" @click="open">
        {{ t('errorPanelSurvey.ctaButton') }}
      </Button>
      <Button
        variant="muted-textonly"
        size="icon-sm"
        :aria-label="t('g.close')"
        @click="markSeen"
      >
        <i class="icon-[lucide--x] size-4" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

import { getSurveyConfig } from './surveyRegistry'
import { useErrorSurveyPopoverState } from './useErrorSurveyPopoverState'
import { useSurveyEligibility } from './useSurveyEligibility'
import { isTypeformIdValid } from './useTypeformEmbed'

const { t } = useI18n()

const config = getSurveyConfig('error-panel')

const { isEligible, markSurveyShown } = useSurveyEligibility(
  () => config ?? { featureId: 'error-panel', typeformId: '' }
)

const { open } = useErrorSurveyPopoverState()

const shouldRenderCta = computed(
  () => !!config && isEligible.value && isTypeformIdValid(config.typeformId)
)

function markSeen() {
  markSurveyShown()
}
</script>
