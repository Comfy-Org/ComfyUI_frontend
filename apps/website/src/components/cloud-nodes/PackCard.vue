<script setup lang="ts">
import type { Pack } from '../../data/cloudNodes'
import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import NodeList from './NodeList.vue'
import PackBanner from './PackBanner.vue'

const { locale = 'en', pack } = defineProps<{
  locale?: Locale
  pack: Pack
}>()

function nodeCountLabel(nodeCount: number): string {
  const key =
    new Intl.PluralRules(locale).select(nodeCount) === 'one'
      ? 'cloudNodes.card.nodeCountOne'
      : 'cloudNodes.card.nodeCountOther'
  return t(key, locale).replace('{count}', String(nodeCount))
}
</script>

<template>
  <article
    class="bg-transparency-white-t5 border-primary-warm-gray/20 flex h-full flex-col overflow-hidden rounded-3xl border"
    data-testid="cloud-node-pack-card"
  >
    <PackBanner
      :banner-url="pack.bannerUrl"
      :icon-url="pack.iconUrl"
      :name="pack.displayName"
    />

    <div class="flex flex-1 flex-col gap-5 p-5 md:p-6">
      <div class="flex flex-col gap-2">
        <h3
          class="text-primary-comfy-canvas text-2xl/tight font-semibold"
        >
          {{ pack.displayName }}
        </h3>
        <p class="text-primary-warm-gray text-sm/relaxed">
          {{
            pack.description ||
            t('cloudNodes.card.unavailableDescription', locale)
          }}
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3 text-sm">
        <a
          v-if="pack.repoUrl"
          :href="pack.repoUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary-comfy-yellow hover:text-primary-comfy-yellow/85 font-semibold underline"
        >
          {{ t('cloudNodes.card.viewRepo', locale) }}
        </a>
        <span v-else class="text-primary-warm-gray">
          {{ t('cloudNodes.card.viewRepo', locale) }}
        </span>
        <span class="text-primary-warm-gray">•</span>
        <span class="text-primary-comfy-canvas">{{
          nodeCountLabel(pack.nodes.length)
        }}</span>
      </div>

      <NodeList :locale="locale" :nodes="pack.nodes" class="mt-auto" />
    </div>
  </article>
</template>
