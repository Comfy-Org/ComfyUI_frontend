<script setup lang="ts">
import type { WorkshopModel } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import { CARD_GRID_BESIDE_NAV } from '@/lib/workshop/card-layout'
import type { WorkflowSection } from '@/lib/workshop/workflow-sections'
import { sectionAnchor } from '@/lib/workshop/workflow-sections'
import WorkshopModelCard from './WorkshopModelCard.vue'

const { sections, locale = 'en' } = defineProps<{
  sections: readonly WorkflowSection[]
  locale?: Locale
}>()

const emit = defineEmits<{
  open: [model: WorkshopModel, position: number, section: string]
}>()
</script>

<template>
  <div class="flex flex-col gap-12">
    <section
      v-for="section in sections"
      :id="sectionAnchor(section.id)"
      :key="section.id"
      :aria-labelledby="`${sectionAnchor(section.id)}-heading`"
      class="scroll-mt-44 lg:scroll-mt-52"
      :data-testid="`workflow-section-${section.id}`"
    >
      <h2
        :id="`${sectionAnchor(section.id)}-heading`"
        class="mb-5 text-xl font-medium text-primary-warm-white"
      >
        {{ section.label }}
      </h2>
      <ul
        :class="CARD_GRID_BESIDE_NAV"
        :aria-label="section.label"
        data-testid="workflow-grid"
      >
        <li v-for="(model, index) in section.models" :key="model.slug">
          <WorkshopModelCard
            :model
            :locale
            @click="emit('open', model, index, section.id)"
          />
        </li>
      </ul>
    </section>
  </div>
</template>
