<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Pack } from '../../data/cloudNodes'
import type { Locale } from '../../i18n/translations'

import { useNodesByCategory } from '../../composables/useNodesByCategory'
import { t } from '../../i18n/translations'
import { formatMediumDate, formatNumber } from '../../utils/format'
import PackBanner from './PackBanner.vue'

const { pack, locale = 'en' } = defineProps<{
  pack: Pack
  locale?: Locale
}>()

const backHref =
  locale === 'zh-CN' ? '/zh-CN/cloud/supported-nodes' : '/cloud/supported-nodes'

const { groupedNodes } = useNodesByCategory(() => pack.nodes)
</script>

<template>
  <article
    class="px-6 pb-20 md:px-20 md:pb-28"
    data-testid="cloud-node-pack-detail"
  >
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <a
        :href="backHref"
        class="text-primary-comfy-yellow hover:text-primary-comfy-yellow/85 w-fit text-sm font-semibold underline"
      >
        {{ t('cloudNodes.detail.back', locale) }}
      </a>

      <div
        class="bg-transparency-white-t5 border-primary-warm-gray/20 overflow-hidden rounded-3xl border"
      >
        <PackBanner
          :banner-url="pack.bannerUrl"
          :icon-url="pack.iconUrl"
          :name="pack.displayName"
        />

        <div class="flex flex-col gap-7 p-5 md:p-6">
          <header class="flex flex-col gap-2">
            <h1
              class="text-primary-comfy-canvas text-3xl/tight font-semibold md:text-4xl"
            >
              {{ pack.displayName }}
            </h1>
            <p
              class="text-primary-warm-gray text-sm/relaxed md:text-base/relaxed"
            >
              {{
                pack.description ||
                t('cloudNodes.card.unavailableDescription', locale)
              }}
            </p>
          </header>

          <dl class="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
            <div class="flex flex-col gap-1">
              <dt class="text-primary-warm-gray">
                {{ t('cloudNodes.card.viewRepo', locale) }}
              </dt>
              <dd>
                <a
                  v-if="pack.repoUrl"
                  :href="pack.repoUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary-comfy-yellow hover:text-primary-comfy-yellow/85 font-semibold underline"
                >
                  {{ pack.repoUrl }}
                </a>
                <span v-else class="text-primary-comfy-canvas">—</span>
              </dd>
            </div>

            <div class="flex flex-col gap-1">
              <dt class="text-primary-warm-gray">
                {{ t('cloudNodes.detail.publisher', locale) }}
              </dt>
              <dd class="text-primary-comfy-canvas">
                {{ pack.publisher?.name || pack.publisher?.id || '—' }}
              </dd>
            </div>

            <div class="flex flex-col gap-1">
              <dt class="text-primary-warm-gray">
                {{ t('cloudNodes.detail.downloads', locale) }}
              </dt>
              <dd class="text-primary-comfy-canvas">
                {{ formatNumber(pack.downloads, locale) }}
              </dd>
            </div>

            <div class="flex flex-col gap-1">
              <dt class="text-primary-warm-gray">
                {{ t('cloudNodes.detail.stars', locale) }}
              </dt>
              <dd class="text-primary-comfy-canvas">
                {{ formatNumber(pack.githubStars, locale) }}
              </dd>
            </div>

            <div class="flex flex-col gap-1">
              <dt class="text-primary-warm-gray">
                {{ t('cloudNodes.detail.latestVersion', locale) }}
              </dt>
              <dd class="text-primary-comfy-canvas">
                {{ pack.latestVersion || '—' }}
              </dd>
            </div>

            <div class="flex flex-col gap-1">
              <dt class="text-primary-warm-gray">
                {{ t('cloudNodes.detail.license', locale) }}
              </dt>
              <dd class="text-primary-comfy-canvas">
                {{ pack.license || '—' }}
              </dd>
            </div>

            <div class="flex flex-col gap-1">
              <dt class="text-primary-warm-gray">
                {{ t('cloudNodes.detail.lastUpdated', locale) }}
              </dt>
              <dd class="text-primary-comfy-canvas">
                {{ formatMediumDate(pack.lastUpdated, locale) }}
              </dd>
            </div>
          </dl>

          <section class="flex flex-col gap-4">
            <h2
              class="text-primary-comfy-canvas text-xl font-semibold md:text-2xl"
            >
              {{ t('cloudNodes.detail.nodesHeading', locale) }}
            </h2>

            <section
              v-for="group in groupedNodes"
              :key="group.category"
              class="border-primary-warm-gray/20 rounded-2xl border p-4"
            >
              <h3 class="text-primary-comfy-canvas text-base font-semibold">
                {{ group.category }}
              </h3>
              <ul class="mt-3 flex flex-col gap-3">
                <li
                  v-for="node in group.nodes"
                  :key="node.name"
                  class="border-primary-warm-gray/20 rounded-xl border p-3"
                  data-testid="cloud-node-pack-detail-node"
                >
                  <div class="flex flex-wrap items-center gap-2">
                    <span
                      class="text-primary-comfy-canvas text-sm font-semibold"
                    >
                      {{ node.displayName }}
                    </span>
                    <span
                      v-if="node.experimental"
                      :class="
                        cn(
                          'bg-primary-comfy-yellow/20 text-primary-comfy-canvas rounded-full px-2 py-0.5 text-xs font-semibold'
                        )
                      "
                    >
                      {{ t('cloudNodes.detail.experimental', locale) }}
                    </span>
                    <span
                      v-if="node.deprecated"
                      :class="
                        cn(
                          'text-primary-comfy-canvas rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold'
                        )
                      "
                    >
                      {{ t('cloudNodes.detail.deprecated', locale) }}
                    </span>
                  </div>
                  <p
                    v-if="node.description"
                    class="text-primary-warm-gray mt-2 text-sm/relaxed"
                  >
                    {{ node.description }}
                  </p>
                </li>
              </ul>
            </section>
          </section>
        </div>
      </div>
    </div>
  </article>
</template>
