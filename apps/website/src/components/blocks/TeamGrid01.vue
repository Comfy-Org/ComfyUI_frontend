<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'

import BrandButton from '../common/BrandButton.vue'
import Card from '../ui/card/Card.vue'
import type { CardWorkflowItem } from './CardWorkflow01.vue'
import TeamMemberDialog01 from './TeamMemberDialog01.vue'

type Profile = {
  id: string
  name: string
  avatarSrc: string
  description: string
  ctaLabel?: string
  tags?: readonly string[]
  workflows?: readonly CardWorkflowItem[]
}

const {
  heading,
  lead,
  people,
  closeLabel,
  class: className
} = defineProps<{
  heading?: string
  lead?: string
  people: readonly Profile[]
  closeLabel: string
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <section :class="cn('max-w-9xl mx-auto px-6 py-16 lg:py-24', className)">
    <h2
      v-if="heading"
      class="text-center text-4xl font-light tracking-tight text-primary-comfy-canvas lg:text-6xl"
    >
      {{ heading }}
    </h2>
    <p
      v-if="lead"
      class="mx-auto mt-6 max-w-2xl text-center text-base font-light text-primary-comfy-canvas lg:mt-8"
    >
      {{ lead }}
    </p>

    <div
      class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
      :class="(heading || lead) && 'mt-12 lg:mt-16'"
    >
      <Card
        v-for="person in people"
        :key="person.id"
        class="group relative gap-0 p-2"
      >
        <TeamMemberDialog01
          :name="person.name"
          :avatar-src="person.avatarSrc"
          :description="person.description"
          :tags="person.tags"
          :workflows="person.workflows"
          :close-label="closeLabel"
        >
          <template #trigger>
            <button
              :aria-label="person.ctaLabel ?? person.name"
              class="rounded-4.5xl focus-visible:ring-primary-comfy-yellow absolute inset-0 z-10 cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            />
          </template>
        </TeamMemberDialog01>
        <div class="flex justify-center pt-8">
          <img
            :src="person.avatarSrc"
            alt=""
            class="size-56 rounded-full object-cover lg:size-60"
          />
        </div>
        <div class="flex flex-col gap-4 px-4 pt-8 pb-6">
          <h3 class="text-2xl font-medium text-white lg:text-3xl">
            {{ person.name }}
          </h3>
          <p
            class="line-clamp-4 text-sm/[1.35] font-semibold text-primary-comfy-canvas"
          >
            {{ person.description }}
          </p>
          <BrandButton
            v-if="person.ctaLabel"
            variant="outline"
            aria-hidden="true"
            tabindex="-1"
            class="group-hover:bg-primary-comfy-yellow pointer-events-none mt-1 h-12 min-w-40 self-start border-2 px-5 text-sm font-extrabold uppercase group-hover:text-primary-comfy-ink"
          >
            {{ person.ctaLabel }}
          </BrandButton>
        </div>
      </Card>
    </div>
  </section>
</template>
