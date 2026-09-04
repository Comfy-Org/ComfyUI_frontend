<script setup lang="ts">
import { Check } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { AccordionStep } from '../../components/blocks/StepsAccordion01.vue'
import type { Locale } from '../../i18n/translations'

import StepsAccordion01 from '../../components/blocks/StepsAccordion01.vue'
import Button from '../../components/ui/button/Button.vue'
import { externalLinks } from '../../config/routes'
import { t } from '../../i18n/translations'
import { resolveRel } from '../../utils/cta'

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

// Two of the three toolkit items carry a sub-description and the third does
// not, so the body is optional rather than a parallel array of pairs.
const toolkit = computed(() =>
  (['item1', 'item2', 'item3'] as const).map((key) => ({
    key,
    title: t(`events.host.step4.${key}.title`, locale),
    body: key === 'item3' ? '' : t(`events.host.step4.${key}.body`, locale)
  }))
)

const bodyClass = 'text-sm text-primary-comfy-canvas/70'
const checkItemClass = 'flex gap-3 text-sm text-primary-warm-white'
const checkIconClass = 'text-primary-comfy-yellow mt-0.5 size-4 shrink-0'

// The content lead's copy puts an "Apply to host" button inside two of the
// steps, on top of the section-level CTA the block already renders.
const applyHref = externalLinks.eventHostApplicationForm
const applyLabel = computed(() => t('events.host.applyToHost', locale))
</script>

<template>
  <StepsAccordion01
    class="lg:px-20"
    :title="t('events.host.title', locale)"
    title-class="font-bold"
    :lead="t('events.host.lead', locale)"
    :cta="{ label: applyLabel, href: applyHref, newTab: true }"
    :steps
  >
    <template #step1>
      <p :class="bodyClass">{{ t('events.host.step1.intro', locale) }}</p>

      <div class="mt-6 lg:pl-8">
        <p :class="bodyClass">
          {{ t('events.host.step1.checklistLead', locale) }}
        </p>
        <ul class="mt-3 space-y-2">
          <li v-for="item in checklist" :key="item" :class="checkItemClass">
            <Check :class="checkIconClass" aria-hidden="true" />
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
      <!-- Points at the directory on this same page, which is what "past
      events by the Comfy community" refers to. -->
      <Button
        as="a"
        variant="underlineLink"
        class="mt-3 text-sm"
        href="#events-directory"
      >
        {{ t('events.host.step2.browseLink', locale) }}
      </Button>
    </template>

    <template #step3>
      <p :class="bodyClass">{{ t('events.host.step3.body', locale) }}</p>
      <Button
        as="a"
        class="mt-6"
        :href="applyHref"
        target="_blank"
        :rel="resolveRel({ target: '_blank' })"
      >
        {{ applyLabel }}
      </Button>
    </template>

    <template #step4>
      <p :class="bodyClass">{{ t('events.host.step4.body', locale) }}</p>
      <ul class="mt-4 space-y-4 lg:pl-8">
        <li v-for="item in toolkit" :key="item.key">
          <div :class="checkItemClass">
            <Check :class="checkIconClass" aria-hidden="true" />
            <span>{{ item.title }}</span>
          </div>
          <p v-if="item.body" :class="cn('mt-1 pl-7', bodyClass)">
            {{ item.body }}
          </p>
        </li>
      </ul>
    </template>

    <template #step5>
      <p :class="bodyClass">{{ t('events.host.step5.body', locale) }}</p>
      <Button
        as="a"
        class="mt-6"
        :href="applyHref"
        target="_blank"
        :rel="resolveRel({ target: '_blank' })"
      >
        {{ applyLabel }}
      </Button>
    </template>
  </StepsAccordion01>
</template>
