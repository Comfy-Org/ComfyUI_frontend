<script setup lang="ts">
import { ArrowUpRight } from '@lucide/vue'
import CopyTextButton from '@/components/ui/copy-text-button/CopyTextButton.vue'
import FeatureRows01 from '@/components/blocks/FeatureRows01.vue'
import type { FeatureRow } from '@/components/blocks/FeatureRows01.vue'
import BrandButton from '@/components/common/BrandButton.vue'
import Accordion from '@/components/ui/accordion/Accordion.vue'
import AccordionItem from '@/components/ui/accordion/AccordionItem.vue'
import AccordionTrigger from '@/components/ui/accordion/AccordionTrigger.vue'
import AccordionContent from '@/components/ui/accordion/AccordionContent.vue'
import CopyableField from '@/components/ui/copyable-field/CopyableField.vue'
import { externalLinks } from '@/config/routes'
import type { Locale, TranslationKey } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const bundledSkills: { name: string; descriptionKey: TranslationKey }[] = [
  { name: 'comfy', descriptionKey: 'cli.skills.bundled.comfy' },
  {
    name: 'comfy-fragments',
    descriptionKey: 'cli.skills.bundled.comfyFragments'
  },
  { name: 'comfy-debug', descriptionKey: 'cli.skills.bundled.comfyDebug' },
  { name: 'comfy-relay', descriptionKey: 'cli.skills.bundled.comfyRelay' },
  { name: 'comfy-director', descriptionKey: 'cli.skills.bundled.comfyDirector' }
]

const cards: {
  id: string
  titleKey: TranslationKey
  promptKey: TranslationKey
  skill: string
  src: string
  fit: 'cover' | 'contain'
}[] = [
  {
    id: 'packshots',
    src: 'https://media.comfy.org/website/learning/advertising3-thumb.png',
    fit: 'cover',
    titleKey: 'cli.skills.card.packshots.title',
    promptKey: 'cli.skills.card.packshots.prompt',
    skill: 'comfy-fragments'
  },
  {
    id: 'keyframes',
    src: 'https://media.comfy.org/website/learning/advertising2-thumb.png',
    fit: 'contain',
    titleKey: 'cli.skills.card.keyframes.title',
    promptKey: 'cli.skills.card.keyframes.prompt',
    skill: 'comfy-director'
  },
  {
    id: 'character-sheets',
    src: 'https://media.comfy.org/website/learning/animation1-thumb.jpg',
    fit: 'contain',
    titleKey: 'cli.skills.card.characterSheets.title',
    promptKey: 'cli.skills.card.characterSheets.prompt',
    skill: 'comfy'
  },
  {
    id: 'set-extension',
    src: 'https://media.comfy.org/website/mcp/hero-demo/set-extension.webp',
    fit: 'cover',
    titleKey: 'cli.skills.card.setExtension.title',
    promptKey: 'cli.skills.card.setExtension.prompt',
    skill: 'comfy'
  },
  {
    id: 'hero-props',
    src: 'https://media.comfy.org/website/learning/animation4-thumb.jpg',
    fit: 'cover',
    titleKey: 'cli.skills.card.heroProps.title',
    promptKey: 'cli.skills.card.heroProps.prompt',
    skill: 'comfy'
  },
  {
    id: 'key-art',
    src: 'https://media.comfy.org/website/learning/advertising1-thumb.png',
    fit: 'cover',
    titleKey: 'cli.skills.card.keyArt.title',
    promptKey: 'cli.skills.card.keyArt.prompt',
    skill: 'comfy'
  }
]

const skillsById = Object.fromEntries(
  cards.map((card) => [card.id, card.skill])
)
const rows: FeatureRow[] = cards.map((card) => ({
  id: card.id,
  title: t(card.titleKey),
  description: t(card.promptKey),
  media: {
    type: 'image',
    src: card.src,
    alt: t(card.titleKey),
    fit: card.fit
  }
}))

const exampleLabel = t('cli.skills.exampleLabel')
const promptCopyLabel = t('cli.skills.promptCopyLabel')
const copyLabel = t('ui.copy')
const copiedLabel = t('ui.copied')
</script>

<template>
  <FeatureRows01
    class="[&_img.object-contain]:bg-white [&_img.object-contain]:p-4 [&_img[src$='set-extension.webp']]:object-scale-down"
    :heading="t('cli.skills.heading')"
    :eyebrow="t('cli.skills.label')"
    :locale="locale"
    :rows="rows"
  >
    <template #subtitle>
      <p class="mx-auto mt-4 max-w-xl text-sm text-smoke-700 lg:text-base">
        {{ t('cli.skills.subtitle') }}
      </p>
      <div class="mx-auto mt-6 max-w-md">
        <CopyableField
          variant="cli"
          value="comfy skills install"
          :copy-label="copyLabel"
          :copied-label="copiedLabel"
        />
      </div>
      <p class="mt-6 text-xs text-smoke-700">{{ exampleLabel }}</p>
    </template>
    <template #row-actions="{ row }">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span
          class="font-mono text-2xs/relaxed whitespace-nowrap text-primary-comfy-yellow sm:text-xs/relaxed lg:text-sm/relaxed"
          >{{ skillsById[row.id] }}</span
        >
        <CopyTextButton
          class="uppercase"
          :value="row.description"
          :label="`${promptCopyLabel}: ${row.title}`"
          :copied-label="copiedLabel"
          >{{ promptCopyLabel }}</CopyTextButton
        >
      </div>
    </template>
    <template #footer>
      <div class="flex flex-col items-center gap-8">
        <BrandButton
          :href="externalLinks.mcpSkills"
          target="_blank"
          rel="noopener noreferrer"
          variant="outline"
          class="uppercase"
          >{{ t('cli.skills.moreSkillsLinkLabel')
          }}<ArrowUpRight class="size-4" aria-hidden="true"
        /></BrandButton>
        <Accordion type="single" collapsible class="w-full">
          <AccordionItem value="bundled-skills">
            <AccordionTrigger>
              {{ t('cli.skills.bundledLabel') }}
            </AccordionTrigger>
            <AccordionContent>
              <dl class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div v-for="skill in bundledSkills" :key="skill.name">
                  <dt
                    class="font-mono text-2xs/relaxed whitespace-nowrap text-primary-comfy-yellow sm:text-xs/relaxed lg:text-sm/relaxed"
                  >
                    {{ skill.name }}
                  </dt>
                  <dd class="mt-1 text-xs">{{ t(skill.descriptionKey) }}</dd>
                </div>
              </dl>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </template>
  </FeatureRows01>
</template>
