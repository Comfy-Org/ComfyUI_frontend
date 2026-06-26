<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { Check, Copy } from '@lucide/vue'

import type { Component } from 'vue'
import { ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'

import SectionLabel from '../common/SectionLabel.vue'

type CardAction =
  | {
      type: 'link'
      label: string
      href: string
      target?: '_blank'
      icon?: Component
    }
  | { type: 'code'; value: string }

export interface FeatureCard {
  id: string
  label?: string
  title: string
  description: string
  action?: CardAction
}

const {
  eyebrow,
  heading,
  subtitle,
  columns = 3,
  cards
} = defineProps<{
  eyebrow?: string
  heading: string
  subtitle?: string
  columns?: 2 | 3 | 4
  cards: readonly FeatureCard[]
}>()

const columnClass: Record<2 | 3 | 4, string> = {
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4'
}

const copiedId = ref<string | null>(null)
let resetTimer: ReturnType<typeof setTimeout> | null = null

async function copyToClipboard(id: string, value: string) {
  try {
    await navigator.clipboard.writeText(value)
  } catch {
    return
  }
  copiedId.value = id
  if (resetTimer) clearTimeout(resetTimer)
  resetTimer = setTimeout(() => {
    copiedId.value = null
  }, 2000)
}
</script>

<template>
  <section class="max-w-9xl mx-auto px-4 py-24 lg:px-20">
    <div class="mb-10">
      <SectionLabel v-if="eyebrow">{{ eyebrow }}</SectionLabel>
      <h2
        :class="
          cn(
            'text-3xl font-light text-primary-comfy-canvas lg:text-5xl/tight',
            eyebrow && 'mt-4'
          )
        "
      >
        {{ heading }}
      </h2>
      <p
        v-if="subtitle"
        class="mt-4 max-w-xl text-sm text-smoke-700 lg:text-base"
      >
        {{ subtitle }}
      </p>
    </div>

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
            variant="outline"
            :append-icon="card.action.icon"
          >
            {{ card.action.label }}
          </Button>
          <div
            v-else
            class="bg-transparency-white-t4 border-primary-warm-gray flex items-center gap-2 rounded-xl border px-4 py-3"
          >
            <span
              class="flex-1 truncate font-mono text-xs text-primary-comfy-canvas"
            >
              {{ card.action.value }}
            </span>
            <button
              type="button"
              :aria-label="copiedId === card.id ? 'Copied' : 'Copy'"
              class="text-primary-warm-gray shrink-0 cursor-pointer transition-colors hover:text-primary-comfy-canvas"
              @click="copyToClipboard(card.id, card.action.value)"
            >
              <component
                :is="copiedId === card.id ? Check : Copy"
                class="size-4"
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
