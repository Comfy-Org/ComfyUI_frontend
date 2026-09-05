<script setup lang="ts">
import SectionHeader from '../../components/common/SectionHeader.vue'
import CopyableField from '../../components/ui/copyable-field/CopyableField.vue'
import { externalLinks } from '../../config/routes'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

// Bundled skills installed by `comfy skills install`
// (docs.comfy.org/agent-tools/cli).
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
}[] = [
  {
    id: 'packshots',
    titleKey: 'cli.skills.card.packshots.title',
    promptKey: 'cli.skills.card.packshots.prompt',
    skill: 'comfy-fragments'
  },
  {
    id: 'keyframes',
    titleKey: 'cli.skills.card.keyframes.title',
    promptKey: 'cli.skills.card.keyframes.prompt',
    skill: 'comfy-director'
  },
  {
    id: 'character-sheets',
    titleKey: 'cli.skills.card.characterSheets.title',
    promptKey: 'cli.skills.card.characterSheets.prompt',
    skill: 'comfy'
  },
  {
    id: 'set-extension',
    titleKey: 'cli.skills.card.setExtension.title',
    promptKey: 'cli.skills.card.setExtension.prompt',
    skill: 'comfy'
  },
  {
    id: 'hero-props',
    titleKey: 'cli.skills.card.heroProps.title',
    promptKey: 'cli.skills.card.heroProps.prompt',
    skill: 'comfy'
  },
  {
    id: 'key-art',
    titleKey: 'cli.skills.card.keyArt.title',
    promptKey: 'cli.skills.card.keyArt.prompt',
    skill: 'comfy'
  }
]

const copyLabel = t('ui.copy', locale)
const copiedLabel = t('ui.copied', locale)
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-16 lg:py-24">
    <SectionHeader
      max-width="xl"
      :label="t('cli.skills.label', locale)"
      align="start"
    >
      {{ t('cli.skills.heading', locale) }}
      <template #subtitle>
        <p class="mt-4 max-w-xl text-sm text-smoke-700 lg:text-base">
          {{ t('cli.skills.subtitle', locale) }}
        </p>
        <div class="mt-6 max-w-md">
          <CopyableField
            value="comfy skills install"
            :copy-label="copyLabel"
            :copied-label="copiedLabel"
          />
        </div>
      </template>
    </SectionHeader>

    <div class="mt-10 flex flex-col gap-3 lg:mt-14">
      <p
        class="text-xs font-bold tracking-widest text-primary-comfy-canvas uppercase"
      >
        {{ t('cli.skills.bundledLabel', locale) }}
      </p>
      <ul class="flex flex-wrap gap-2.5">
        <li
          v-for="skill in bundledSkills"
          :key="skill.name"
          class="flex items-baseline gap-2 rounded-xl border border-white/15 bg-white/4 px-3.5 py-2"
        >
          <span class="text-primary-comfy-yellow font-mono text-xs">
            {{ skill.name }}
          </span>
          <span class="text-xs text-smoke-700">
            {{ t(skill.descriptionKey, locale) }}
          </span>
        </li>
      </ul>
    </div>

    <div class="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="card in cards"
        :key="card.id"
        class="bg-transparency-white-t4 flex flex-col gap-4 rounded-3xl p-6"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3
            class="text-primary-comfy-yellow font-formula text-sm font-extrabold tracking-[0.7px] uppercase"
          >
            {{ t(card.titleKey, locale) }}
          </h3>
          <span class="font-mono text-xs text-white/40">{{ card.skill }}</span>
        </div>
        <p class="flex-1 text-sm text-primary-comfy-canvas/80">
          {{ t(card.promptKey, locale) }}
        </p>
        <CopyableField
          :value="t(card.promptKey, locale)"
          :copy-label="copyLabel"
          :copied-label="copiedLabel"
        />
      </article>
    </div>

    <p class="mt-8 text-sm text-smoke-700">
      {{ t('cli.skills.moreSkillsPrefix', locale)
      }}<a
        :href="externalLinks.mcpSkills"
        target="_blank"
        rel="noopener noreferrer"
        class="focus-visible:ring-primary-comfy-yellow/50 rounded-sm text-primary-comfy-canvas underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
        >{{ t('cli.skills.moreSkillsLinkLabel', locale) }}</a
      >{{ t('cli.skills.moreSkillsSuffix', locale) }}
    </p>
  </section>
</template>
