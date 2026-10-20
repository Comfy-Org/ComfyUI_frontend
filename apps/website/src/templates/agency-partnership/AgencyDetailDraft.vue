<script setup lang="ts">
import SectionHeader from '@/components/common/SectionHeader.vue'
import Button from '@/components/ui/button/Button.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import AgencyWorkDraft from './AgencyWorkDraft.vue'
import AgencyLogoDraft from './AgencyLogoDraft.vue'
import type { AgencyDraft, AgencyDraftLabels } from './draftTypes'

defineProps<{
  agency: AgencyDraft
  labels: AgencyDraftLabels
}>()
</script>

<template>
  <section
    class="mx-auto flex max-w-4xl flex-col items-center px-6 pt-12 pb-8 text-center lg:pt-20"
  >
    <h1 class="sr-only">{{ agency.name }}</h1>
    <div aria-hidden="true" class="flex h-20 items-center justify-center">
      <div class="scale-150">
        <AgencyLogoDraft :agency :labels />
      </div>
    </div>
    <div class="mt-6 flex flex-wrap justify-center gap-2">
      <Badge
        v-for="specialty in agency.specialties"
        :key="specialty"
        variant="subtle"
        size="md"
      >
        {{ specialty }}
      </Badge>
    </div>
    <Button
      :href="agency.contactHref"
      :disabled="!agency.contactHref"
      :target="agency.contactHref ? '_blank' : undefined"
      :rel="agency.contactHref ? 'noopener noreferrer' : undefined"
      size="lg"
      class="mt-10 max-w-full"
    >
      {{ labels.contact }} {{ agency.name.toUpperCase() }}
      <template v-if="agency.contactHref" #append
        ><span aria-hidden="true">↗</span></template
      >
    </Button>
    <p
      v-if="!agency.contactHref"
      class="mt-4 text-sm text-primary-comfy-canvas"
    >
      {{ labels.pendingContact }}
    </p>
  </section>
  <AgencyWorkDraft :agency :labels />
  <section class="mx-auto max-w-3xl px-6 py-16 text-center lg:py-24">
    <SectionHeader>{{ labels.about }} {{ agency.name }}</SectionHeader>
    <p
      class="mx-auto mt-8 max-w-xl text-xl/relaxed font-light text-primary-comfy-canvas"
    >
      {{ agency.background }}
    </p>
  </section>
  <section class="mx-auto max-w-9xl px-6 py-16 text-center lg:py-24">
    <SectionHeader>{{ labels.contactTitle }} {{ agency.name }}</SectionHeader>
    <Button
      :href="agency.contactHref"
      :disabled="!agency.contactHref"
      :target="agency.contactHref ? '_blank' : undefined"
      :rel="agency.contactHref ? 'noopener noreferrer' : undefined"
      size="lg"
      class="mt-8 max-w-full"
    >
      {{ labels.contact }} {{ agency.name.toUpperCase() }}
      <template v-if="agency.contactHref" #append
        ><span aria-hidden="true">↗</span></template
      >
    </Button>
    <p
      v-if="!agency.contactHref"
      class="mt-4 text-sm text-primary-comfy-canvas"
    >
      {{ labels.pendingContact }}
    </p>
  </section>
</template>
