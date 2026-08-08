<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'

import CardArrow from '../common/CardArrow.vue'
import Card from '../ui/card/Card.vue'
import type { CardWorkflowItem } from './CardWorkflow01.vue'
import TeamMemberDialog01 from './TeamMemberDialog01.vue'

type Profile = {
  id: string
  name: string
  avatarSrc: string
  description: string
  workflows?: readonly CardWorkflowItem[]
  workflowsHref?: string
}

const {
  heading,
  lead,
  people,
  closeLabel,
  workflowsLabel,
  tryNowLabel,
  class: className
} = defineProps<{
  heading?: string
  lead?: string
  people: readonly Profile[]
  closeLabel: string
  workflowsLabel?: string
  tryNowLabel?: string
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
      class="grid grid-cols-1 gap-4 md:grid-cols-3"
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
          :workflows="person.workflows"
          :workflows-href="person.workflowsHref"
          :workflows-label="workflowsLabel"
          :try-now-label="tryNowLabel"
          :close-label="closeLabel"
        >
          <template #trigger>
            <button
              :aria-label="person.name"
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
        <div class="flex flex-col gap-4 px-4 pt-8 pb-3">
          <h3 class="text-2xl font-medium text-white lg:text-3xl">
            {{ person.name }}
          </h3>
          <div class="flex items-center gap-6">
            <p
              class="line-clamp-3 flex-1 text-sm/[1.35] font-semibold text-primary-comfy-canvas"
            >
              {{ person.description }}
            </p>
            <CardArrow
              hover="group"
              class="size-8 shrink-0 rounded-xl bg-primary-warm-gray text-primary-warm-white"
            />
          </div>
        </div>
      </Card>
    </div>
  </section>
</template>
