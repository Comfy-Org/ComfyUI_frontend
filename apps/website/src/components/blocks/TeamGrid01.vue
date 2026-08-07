<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { HTMLAttributes } from 'vue'

import Card from '../ui/card/Card.vue'
import CardContent from '../ui/card/CardContent.vue'
import CardDescription from '../ui/card/CardDescription.vue'
import CardTitle from '../ui/card/CardTitle.vue'

type Profile = {
  id: string
  name: string
  description: string
  avatarSrc: string
  imageSrc?: string
  imageAlt?: string
}

const {
  heading,
  lead,
  people,
  class: className
} = defineProps<{
  heading?: string
  lead?: string
  people: readonly Profile[]
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
        class="gap-0 overflow-hidden"
      >
        <div class="relative flex justify-center pt-8 lg:pt-10">
          <img
            v-if="person.imageSrc"
            :src="person.imageSrc"
            :alt="person.imageAlt ?? ''"
            class="absolute inset-0 size-full object-cover"
          />
          <img
            :src="person.avatarSrc"
            alt=""
            class="relative size-56 rounded-full object-cover lg:size-60"
          />
        </div>
        <CardContent class="flex flex-col gap-4 px-6 py-8 lg:px-8 lg:pb-10">
          <CardTitle
            class="text-2xl font-normal text-primary-warm-white lg:text-3xl"
          >
            {{ person.name }}
          </CardTitle>
          <CardDescription class="text-sm lg:text-base">
            {{ person.description }}
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  </section>
</template>
