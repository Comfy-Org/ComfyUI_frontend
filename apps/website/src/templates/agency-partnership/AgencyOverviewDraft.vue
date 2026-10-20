<script setup lang="ts">
import HeroCentered01 from '@/components/blocks/HeroCentered01.vue'
import SectionHeader from '@/components/common/SectionHeader.vue'
import Card from '@/components/ui/card/Card.vue'
import Button from '@/components/ui/button/Button.vue'
import AgencyLogoDraft from './AgencyLogoDraft.vue'
import AgencyMediaDraft from './AgencyMediaDraft.vue'
import type { AgencyDraft, AgencyDraftLabels } from './draftTypes'

defineProps<{
  agencies: readonly AgencyDraft[]
  labels: AgencyDraftLabels
  title: string
  subtitle: string
}>()
</script>

<template>
  <HeroCentered01
    :eyebrow="labels.program"
    :title
    :subtitle
    class="pt-16 pb-8 lg:pt-24"
  >
    <Button href="#agencies" size="lg" class="mt-10">{{
      labels.explore
    }}</Button>
  </HeroCentered01>
  <section id="agencies" class="mx-auto max-w-9xl px-6 py-16 lg:py-24">
    <SectionHeader align="start">{{ labels.roster }}</SectionHeader>
    <div class="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      <Card v-for="agency in agencies" :key="agency.id" class="gap-0 p-2">
        <AgencyMediaDraft v-if="agency.work[0]" :item="agency.work[0]" />
        <div
          v-else
          class="flex aspect-video items-center justify-center rounded-3xl border border-dashed border-primary-comfy-canvas/30 p-6 text-center text-sm text-primary-comfy-canvas"
        >
          {{ labels.pendingWork }}
        </div>
        <div class="flex h-24 items-center px-6 pt-4">
          <AgencyLogoDraft :agency :labels />
        </div>
        <div class="px-6 pt-4">
          <h3 class="text-3xl font-light text-primary-warm-white">
            {{ agency.name }}
          </h3>
          <p class="mt-4 text-base/relaxed text-primary-comfy-canvas">
            {{ agency.specialty }}
          </p>
        </div>
        <Button :href="agency.reviewHref" variant="link" class="m-6 self-start"
          >{{ labels.profile
          }}<template #append
            ><span aria-hidden="true">→</span></template
          ></Button
        >
      </Card>
    </div>
  </section>
</template>
