<template>
  <CardContainer
    variant="ghost"
    rounded="lg"
    role="button"
    tabindex="0"
    :data-testid="`getting-started-card-${template.name}`"
    :aria-label="title"
    class="group/card focus-visible:ring-ring hover:bg-node-component-surface focus-visible:ring-1 focus-visible:outline-none"
    @click="emit('select', template.name)"
    @keydown.enter.prevent="emit('select', template.name)"
    @keydown.space.prevent="emit('select', template.name)"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <template #top>
      <CardTop ratio="square">
        <div class="relative size-full overflow-hidden rounded-lg">
          <DefaultThumbnail
            :src="thumbnailSrc"
            :alt="title"
            :is-hovered="isHovered"
            :is-video="isVideo"
            :hover-zoom="5"
          />
        </div>
      </CardTop>
    </template>
    <template #bottom>
      <CardBottom>
        <h3 class="m-0 line-clamp-1 pt-3 text-sm text-base-foreground" :title>
          {{ title }}
        </h3>
      </CardBottom>
    </template>
  </CardContainer>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import CardBottom from '@/components/card/CardBottom.vue'
import CardContainer from '@/components/card/CardContainer.vue'
import CardTop from '@/components/card/CardTop.vue'
import DefaultThumbnail from '@/components/templates/thumbnails/DefaultThumbnail.vue'
import { useTemplateWorkflows } from '@/platform/workflow/templates/composables/useTemplateWorkflows'
import type { TemplateInfo } from '@/platform/workflow/templates/types/template'

const { template } = defineProps<{ template: TemplateInfo }>()

const emit = defineEmits<{ select: [id: string] }>()

const { getTemplateThumbnailUrl, getTemplateTitle } = useTemplateWorkflows()

const isHovered = ref(false)

const thumbnailSrc = computed(() =>
  getTemplateThumbnailUrl(template, 'default')
)
const title = computed(() => getTemplateTitle(template, 'default'))
const isVideo = computed(
  () => template.mediaType === 'video' || template.mediaSubtype === 'webp'
)
</script>
