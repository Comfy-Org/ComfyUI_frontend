<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { AnchorHTMLAttributes, HTMLAttributes } from 'vue'

import GlassCard from '../common/GlassCard.vue'
import CheckIcon from '../icons/CheckIcon.vue'
import Badge from '../ui/badge/Badge.vue'
import Button from '../ui/button/Button.vue'
import { resolveRel } from '../../utils/cta'

type Cta = {
  label: string
  href: string
  target?: AnchorHTMLAttributes['target']
  rel?: AnchorHTMLAttributes['rel']
}

type ManifestItem = {
  id: string
  label: string
  value: string
}

type ReleaseLabel = {
  id: string
  label: string
  current?: boolean
}

type DeploymentTarget = {
  id: string
  label: string
}

const {
  eyebrow,
  heading,
  headingTag = 'h2',
  body,
  features = [],
  primaryCta,
  secondaryCta,
  manifestLabel,
  manifestName,
  manifestVersion,
  manifestItems,
  releaseLabels = [],
  deploymentTargets = [],
  class: className
} = defineProps<{
  eyebrow: string
  heading: string
  headingTag?: 'h1' | 'h2'
  body: string
  features?: readonly string[]
  primaryCta: Cta
  secondaryCta?: Cta
  manifestLabel: string
  manifestName: string
  manifestVersion: string
  manifestItems: readonly ManifestItem[]
  releaseLabels?: readonly ReleaseLabel[]
  deploymentTargets?: readonly DeploymentTarget[]
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <section
    :class="
      cn('max-w-9xl mx-auto w-full px-6 py-14 md:py-20 lg:px-12', className)
    "
  >
    <GlassCard>
      <div class="flex flex-col gap-2 lg:flex-row">
        <div
          class="order-last flex w-full flex-col justify-center rounded-4xl bg-primary-comfy-ink p-6 md:p-8 lg:order-first lg:flex-1 lg:p-10"
        >
          <Badge variant="category" size="md">
            {{ eyebrow }}
          </Badge>

          <component
            :is="headingTag"
            class="mt-5 text-3xl leading-[125%] font-light tracking-tight whitespace-pre-line text-primary-comfy-canvas md:text-4xl lg:text-5xl"
          >
            {{ heading }}
          </component>

          <p
            class="mt-5 max-w-2xl text-base/relaxed font-light text-primary-comfy-canvas/75 md:text-lg/relaxed"
          >
            {{ body }}
          </p>

          <ul v-if="features.length" class="mt-7 flex flex-col gap-3">
            <li
              v-for="feature in features"
              :key="feature"
              class="flex items-start gap-3 text-sm/relaxed text-primary-comfy-canvas md:text-base/relaxed"
            >
              <CheckIcon
                class="text-primary-comfy-yellow mt-0.5 size-5 shrink-0"
              />
              <span>{{ feature }}</span>
            </li>
          </ul>

          <div class="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button
              as="a"
              :href="primaryCta.href"
              :target="primaryCta.target"
              :rel="resolveRel(primaryCta)"
              size="lg"
            >
              {{ primaryCta.label }}
            </Button>
            <Button
              v-if="secondaryCta"
              as="a"
              :href="secondaryCta.href"
              :target="secondaryCta.target"
              :rel="resolveRel(secondaryCta)"
              variant="outline"
              size="lg"
            >
              {{ secondaryCta.label }}
            </Button>
          </div>
        </div>

        <div
          class="order-first w-full rounded-4xl bg-primary-comfy-canvas p-4 text-primary-comfy-ink md:p-6 lg:order-last lg:flex-1 lg:p-8"
        >
          <div
            class="flex h-full flex-col rounded-3xl bg-primary-comfy-ink p-5 text-primary-comfy-canvas md:p-6"
          >
            <div
              class="flex flex-col gap-4 border-b border-primary-comfy-canvas/10 pb-5 sm:flex-row sm:items-start sm:justify-between"
            >
              <div>
                <p
                  class="text-primary-comfy-yellow text-xs font-bold tracking-widest uppercase"
                >
                  {{ manifestLabel }}
                </p>
                <p class="mt-2 text-2xl font-light text-primary-warm-white">
                  {{ manifestName }}
                </p>
              </div>
              <Badge variant="accent" size="md">
                {{ manifestVersion }}
              </Badge>
            </div>

            <dl class="mt-5 grid gap-3 sm:grid-cols-2">
              <div
                v-for="item in manifestItems"
                :key="item.id"
                class="rounded-2xl bg-primary-comfy-canvas/5 p-4"
              >
                <dt
                  class="text-[0.65rem] font-bold tracking-[0.12em] text-primary-comfy-canvas/55 uppercase"
                >
                  {{ item.label }}
                </dt>
                <dd
                  class="mt-2 text-sm font-medium tracking-wide text-primary-comfy-canvas uppercase"
                >
                  {{ item.value }}
                </dd>
              </div>
            </dl>

            <div
              v-if="releaseLabels.length"
              class="mt-5 flex flex-wrap items-center gap-2 border-t border-primary-comfy-canvas/10 pt-5"
              aria-label="Build releases"
            >
              <Badge
                v-for="release in releaseLabels"
                :key="release.id"
                :variant="release.current ? 'accent' : 'subtle'"
                size="md"
              >
                {{ release.label }}
              </Badge>
            </div>

            <div
              v-if="deploymentTargets.length"
              class="mt-auto grid gap-2 pt-5 sm:grid-cols-2 xl:grid-cols-3"
              aria-label="Deployment targets"
            >
              <div
                v-for="target in deploymentTargets"
                :key="target.id"
                class="rounded-xl border border-primary-comfy-canvas/15 p-3 text-center text-[0.65rem] font-bold tracking-wide text-primary-comfy-canvas uppercase"
              >
                {{ target.label }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  </section>
</template>
