<script setup lang="ts">
import Card from '@/components/ui/card/Card.vue'
import SectionHeader from '@/components/common/SectionHeader.vue'
import Button from '@/components/ui/button/Button.vue'
import AgencyMediaDraft from './AgencyMediaDraft.vue'
import type { AgencyDraft, AgencyDraftLabels } from './draftTypes'

defineProps<{ agency: AgencyDraft; labels: AgencyDraftLabels }>()
</script>

<template>
  <section class="mx-auto max-w-9xl px-6 py-16 lg:py-24">
    <SectionHeader>{{ labels.work }}</SectionHeader>
    <div v-if="agency.work.length" class="mt-8 grid gap-6 md:grid-cols-2">
      <Card v-for="item in agency.work" :key="item.id" class="gap-0 p-2">
        <AgencyMediaDraft :item />
        <div class="flex grow flex-col gap-4 p-6">
          <h3 class="text-2xl font-light [overflow-wrap:anywhere]">
            {{ item.title }}
          </h3>
          <p v-if="item.reviewNote" class="text-sm text-primary-comfy-canvas">
            {{ item.reviewNote }}
          </p>
          <Button
            :href="item.sourceUrl"
            target="_blank"
            rel="noopener noreferrer"
            variant="link"
            class="mt-auto self-start"
            >{{ labels.source
            }}<template #append
              ><span aria-hidden="true">↗</span></template
            ></Button
          >
        </div>
      </Card>
    </div>
    <Card
      v-else
      class="mt-8 aspect-video items-center justify-center border border-dashed border-primary-comfy-canvas/30 p-8 text-center"
    >
      <p class="max-w-md text-base text-primary-comfy-canvas">
        {{ agency.name }} · {{ labels.pendingWork }}
      </p>
    </Card>
  </section>
</template>
