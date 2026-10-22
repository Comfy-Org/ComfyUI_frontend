<script setup lang="ts">
import { Check } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { AccordionStep } from '@/components/blocks/StepsAccordion01.vue'
import type { Locale } from '@/i18n/translations'

import StepsAccordion01 from '@/components/blocks/StepsAccordion01.vue'
import SafeRichText from '@/components/common/SafeRichTextContent'
import Button from '@/components/ui/button/Button.vue'
import { translationsFor } from '@/i18n/translations'

const {
  locale = 'en',
  signupHref,
  submitHref
} = defineProps<{
  locale?: Locale
  signupHref: string
  submitHref: string
}>()
const { t } = translationsFor(locale)

const steps: AccordionStep[] = (
  ['Signup', 'Requirements', 'Prepare', 'Submit'] as const
).map((id) => ({ id, title: t(`eventChallenge.enter${id}Title`) }))

const sdkDocsHref = {
  en: 'https://docs.comfy.org/development/api-development/sdks',
  'zh-CN': 'https://docs.comfy.org/zh/development/api-development/sdks',
  ja: 'https://docs.comfy.org/ja/development/api-development/sdks'
} as const satisfies Record<Locale, string>

const requirements = ([1, 2, 3, 4, 5, 6] as const).map((item) =>
  t(`eventChallenge.requirement${item}`, { sdkDocsHref: sdkDocsHref[locale] })
)

const deliverables = (['Repo', 'Demo', 'Link', 'Social'] as const).map(
  (item) => ({
    id: item,
    title: t(`eventChallenge.enter${item}`),
    body: t(`eventChallenge.enter${item}Body`)
  })
)

const bodyClass = 'text-sm text-primary-comfy-canvas/70'
const checkItemClass = 'flex gap-3 text-sm text-primary-warm-white'
const checkIconClass = 'mt-0.5 size-4 shrink-0 text-primary-comfy-yellow'
</script>

<template>
  <StepsAccordion01
    id="how-to-enter"
    class="scroll-mt-40 lg:px-20"
    :title="t('eventChallenge.enter')"
    :lead="t('eventChallenge.enterLead')"
    :steps
  >
    <template #actions>
      <div class="mt-8 inline-flex flex-col gap-3">
        <Button as="a" :href="signupHref">
          {{ t('eventChallenge.enterSignupCta') }}
        </Button>
        <Button as="a" variant="outline" :href="submitHref">
          {{ t('eventChallenge.submit') }}
        </Button>
      </div>
    </template>

    <template #Signup>
      <p :class="bodyClass">
        {{ t('eventChallenge.enterSignupBody') }}
      </p>
      <Button
        as="a"
        variant="underlineLink"
        class="mt-6 text-sm"
        :href="signupHref"
      >
        {{ t('eventChallenge.enterSignupLink') }}
      </Button>
    </template>

    <template #Requirements>
      <ul class="space-y-2">
        <li v-for="item in requirements" :key="item" :class="checkItemClass">
          <Check :class="checkIconClass" aria-hidden="true" />
          <SafeRichText :html="item" />
        </li>
      </ul>
    </template>

    <template #Prepare>
      <p :class="bodyClass">
        {{ t('eventChallenge.enterIntro') }}
      </p>
      <ul class="mt-4 space-y-4 lg:pl-8">
        <li v-for="item in deliverables" :key="item.id">
          <div :class="checkItemClass">
            <Check :class="checkIconClass" aria-hidden="true" />
            <span>{{ item.title }}</span>
          </div>
          <p :class="cn('mt-1 pl-7', bodyClass)">
            {{ item.body }}
          </p>
        </li>
      </ul>
    </template>

    <template #Submit>
      <p :class="bodyClass">
        {{ t('eventChallenge.enterSubmitBody') }}
      </p>
      <Button as="a" class="mt-6" :href="submitHref">
        {{ t('eventChallenge.submit') }}
      </Button>
    </template>
  </StepsAccordion01>
</template>
