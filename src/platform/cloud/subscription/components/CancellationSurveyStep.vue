<template>
  <CancellationStepLayout
    :title="$t('subscription.cancelFlow.survey.title')"
    :subtitle="$t('subscription.cancelFlow.survey.subtitle')"
    :on-close="() => exit('closed')"
  >
    <div class="flex flex-col gap-6">
      <RadioGroupRoot
        :model-value="reason"
        :aria-label="$t('subscription.cancelFlow.survey.title')"
        class="flex flex-col gap-2"
        @update:model-value="selectReason"
      >
        <RadioGroupItem
          v-for="option in CANCELLATION_REASONS"
          :key="option"
          :value="option"
          :class="
            cn(
              'flex w-full cursor-pointer items-center gap-2 rounded-[10px] border border-border-subtle bg-transparent p-2.5 text-left text-sm text-base-foreground transition-colors hover:bg-secondary-background-hover focus-visible:ring-1 focus-visible:ring-border-default focus-visible:outline-none',
              reason === option && 'border-transparent bg-secondary-background'
            )
          "
        >
          <span
            :class="
              cn(
                'flex size-4 shrink-0 items-center justify-center rounded-full border border-border-subtle',
                reason === option && 'border-base-foreground bg-base-foreground'
              )
            "
            aria-hidden="true"
          >
            <span
              v-if="reason === option"
              class="size-2 rounded-full bg-base-background"
            />
          </span>
          {{ $t(`subscription.cancelFlow.survey.reasons.${option}`) }}
        </RadioGroupItem>
      </RadioGroupRoot>

      <div class="flex flex-col gap-3">
        <label :for="commentId" class="text-sm text-base-foreground">
          {{ $t('subscription.cancelFlow.survey.commentLabel') }}
        </label>
        <Textarea
          :id="commentId"
          v-model="comment"
          class="h-24 resize-none font-inter"
          :placeholder="$t('subscription.cancelFlow.survey.commentPlaceholder')"
          maxlength="2000"
        />
      </div>
    </div>

    <template #actions>
      <Button variant="textonly" size="lg" @click="exit('keep_plan')">
        {{ $t('subscription.cancelFlow.keepPlan') }}
      </Button>
      <Button
        variant="secondary"
        size="lg"
        @click="exit('continue_cancelling')"
      >
        {{ $t('subscription.cancelFlow.continueCancelling') }}
      </Button>
    </template>
  </CancellationStepLayout>
</template>

<script setup lang="ts">
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { onMounted, ref, useId } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import CancellationStepLayout from '@/platform/cloud/subscription/components/CancellationStepLayout.vue'
import type {
  CancellationReason,
  CancellationSurveyExit
} from '@/platform/cloud/subscription/utils/cancellationSurvey'
import {
  CANCELLATION_REASONS,
  cancellationSurveyExitEvent
} from '@/platform/cloud/subscription/utils/cancellationSurvey'
import { useTelemetry } from '@/platform/telemetry'

const { surveyId, experimentVariant, onExit } = defineProps<{
  surveyId: string
  experimentVariant?: string
  onExit: (exit: CancellationSurveyExit) => void
}>()

const telemetry = useTelemetry()
const reason = ref<CancellationReason>()
const comment = ref('')
const commentId = useId()

onMounted(() => {
  telemetry?.trackInAppSurvey('shown', { surveyId })
})

function selectReason(value: unknown) {
  reason.value = CANCELLATION_REASONS.find((option) => option === value)
}

function exit(choice: CancellationSurveyExit) {
  const { stage, event } = cancellationSurveyExitEvent({
    surveyId,
    answers: { reason: reason.value, comment: comment.value },
    exit: choice,
    experimentVariant
  })
  telemetry?.trackInAppSurvey(stage, event)
  onExit(choice)
}
</script>
