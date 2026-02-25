<template>
  <div class="flex flex-col gap-6 p-6">
    <p class="text-muted-foreground">
      {{ t('templatePublishing.steps.submissionForReview.description') }}
    </p>
    <div class="flex justify-end">
      <Button size="lg" @click="stepper.nextStep()">
        {{ t('templatePublishing.submit') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { PublishingStepperKey } from '@/components/templatePublishing/types'

const { t } = useI18n()
const stepper = inject(PublishingStepperKey)!
</script>
