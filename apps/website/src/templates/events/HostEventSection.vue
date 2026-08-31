<script setup lang="ts">
import { Check } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { AccordionStep } from '../../components/blocks/StepsAccordion01.vue'
import type { Locale } from '../../i18n/translations'

import StepsAccordion01 from '../../components/blocks/StepsAccordion01.vue'
import { externalLinks } from '../../config/routes'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

// Step ids double as the block's slot names, so each body composes its own
// rich content below instead of going through a string format.
const STEP_IDS = ['step1', 'step2', 'step3', 'step4', 'step5'] as const

const steps = computed<AccordionStep[]>(() =>
  STEP_IDS.map((id) => ({
    id,
    title: t(`events.host.${id}.title`, locale)
  }))
)

const checklist = computed(() =>
  (['check1', 'check2', 'check3'] as const).map((key) =>
    t(`events.host.step1.${key}`, locale)
  )
)

const bodyClass = 'text-sm text-primary-comfy-canvas/70'
</script>

<template>
  <StepsAccordion01
    :title="t('events.host.title', locale)"
    :lead="t('events.host.lead', locale)"
    :cta="{
      label: t('events.host.applyToHost', locale),
      href: externalLinks.eventHostApplicationForm
    }"
    :steps
  >
    <template #step1>
      <p :class="bodyClass">{{ t('events.host.step1.intro', locale) }}</p>

      <div class="mt-6 lg:pl-8">
        <p :class="bodyClass">
          {{ t('events.host.step1.checklistLead', locale) }}
        </p>
        <ul class="mt-3 space-y-2">
          <li
            v-for="item in checklist"
            :key="item"
            class="flex gap-3 text-sm text-primary-warm-white"
          >
            <Check
              class="text-primary-comfy-yellow mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <span>{{ item }}</span>
          </li>
        </ul>

        <h3 class="mt-8 text-base text-primary-warm-white">
          {{ t('events.host.step1.whoTitle', locale) }}
        </h3>
        <p :class="cn('mt-2', bodyClass)">
          {{ t('events.host.step1.whoBody', locale) }}
        </p>
      </div>
    </template>

    <template #step2>
      <p :class="bodyClass">{{ t('events.host.step2.body', locale) }}</p>
    </template>
    <template #step3>
      <p :class="bodyClass">{{ t('events.host.step3.body', locale) }}</p>
    </template>
    <template #step4>
      <p :class="bodyClass">{{ t('events.host.step4.body', locale) }}</p>
    </template>
    <template #step5>
      <p :class="bodyClass">{{ t('events.host.step5.body', locale) }}</p>
    </template>
  </StepsAccordion01>
</template>
