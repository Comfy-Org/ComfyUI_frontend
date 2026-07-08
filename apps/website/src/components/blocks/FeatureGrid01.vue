<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Component } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import CopyableField from '@/components/ui/copyable-field/CopyableField.vue'

import SectionHeader from '../common/SectionHeader.vue'

type CardAction =
  | {
      type: 'link'
      label: string
      href: string
      target?: '_blank'
      icon?: Component
      variant?: 'default' | 'outline'
    }
  | { type: 'code'; value: string }

export interface FeatureCard {
  id: string
  label?: string
  title: string
  description: string
  action?: CardAction
}

type ColumnCount = 2 | 3 | 4

const {
  cards,
  columns = 3,
  copiedLabel,
  copyLabel,
  eyebrow,
  heading,
  subtitle
} = defineProps<{
  cards: readonly FeatureCard[]
  columns?: ColumnCount
  copiedLabel?: string
  copyLabel?: string
  eyebrow?: string
  heading: string
  subtitle?: string
}>()

const columnClass: Record<ColumnCount, string> = {
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4'
}
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-16 lg:py-24">
    <SectionHeader max-width="xl" :label="eyebrow" align="start">
      {{ heading }}
      <template v-if="subtitle" #subtitle>
        <p class="mt-4 max-w-xl text-sm text-smoke-700 lg:text-base">
          {{ subtitle }}
        </p>
      </template>
    </SectionHeader>

    <div :class="cn('mt-16 grid grid-cols-1 gap-6', columnClass[columns])">
      <div
        v-for="card in cards"
        :key="card.id"
        class="bg-transparency-white-t4 flex flex-col rounded-3xl p-6 lg:p-8"
      >
        <p
          v-if="card.label"
          class="text-primary-comfy-yellow text-xs font-bold tracking-widest uppercase"
        >
          {{ card.label }}
        </p>
        <h3
          :class="
            cn(
              'text-xl font-light text-primary-comfy-canvas lg:text-2xl',
              card.label && 'mt-3'
            )
          "
        >
          {{ card.title }}
        </h3>
        <p class="mt-3 text-sm text-smoke-700">
          {{ card.description }}
        </p>

        <div v-if="card.action" class="mt-6">
          <Button
            v-if="card.action.type === 'link'"
            as="a"
            :href="card.action.href"
            :target="card.action.target"
            :rel="
              card.action.target === '_blank'
                ? 'noopener noreferrer'
                : undefined
            "
            :variant="card.action.variant ?? 'outline'"
            :append-icon="card.action.icon"
          >
            {{ card.action.label }}
          </Button>
          <CopyableField
            v-else
            :value="card.action.value"
            :copy-label="copyLabel"
            :copied-label="copiedLabel"
          />
        </div>
      </div>
    </div>
  </section>
</template>
