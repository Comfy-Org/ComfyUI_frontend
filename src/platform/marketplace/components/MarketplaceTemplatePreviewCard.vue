<template>
  <CardContainer
    size="tall"
    variant="ghost"
    rounded="lg"
    :has-cursor="false"
    data-testid="preview-card"
  >
    <template #top>
      <CardTop ratio="square">
        <template #default>
          <div
            v-if="thumbnailUrl"
            class="relative size-full overflow-hidden rounded-lg"
          >
            <DefaultThumbnail
              :src="thumbnailUrl"
              :alt="title"
              :hover-zoom="0"
              :is-hovered="false"
              object-fit="cover"
            />
          </div>
          <slot v-else name="thumbnail-placeholder">
            <div
              class="flex size-full flex-col items-center justify-center gap-2 rounded-lg bg-dialog-surface"
              data-testid="preview-thumbnail-placeholder"
            >
              <i class="icon-[lucide--image] size-10 text-muted" />
              <span class="text-xs text-muted">
                {{ $t('marketplace.noThumbnailYet') }}
              </span>
            </div>
          </slot>
        </template>
        <template #bottom-right>
          <template v-if="tags?.length">
            <SquareChip v-for="tag in tags" :key="tag" :label="tag" />
          </template>
        </template>
      </CardTop>
    </template>
    <template #bottom>
      <CardBottom>
        <div class="flex flex-col gap-2 pt-3">
          <h3 class="m-0 line-clamp-1 text-sm" :title="title">
            {{ title }}
          </h3>
          <p class="m-0 line-clamp-2 text-sm text-muted">
            {{ shortDescription }}
          </p>
          <p class="m-0 text-sm">
            {{ description }}
          </p>
          <span class="text-xs text-muted">
            {{ licenseLabel }}
          </span>
        </div>
      </CardBottom>
    </template>
  </CardContainer>
</template>

<script setup lang="ts">
import CardBottom from '@/components/card/CardBottom.vue'
import CardContainer from '@/components/card/CardContainer.vue'
import CardTop from '@/components/card/CardTop.vue'
import SquareChip from '@/components/chip/SquareChip.vue'
import DefaultThumbnail from '@/components/templates/thumbnails/DefaultThumbnail.vue'

defineProps<{
  title: string
  shortDescription: string
  description: string
  licenseLabel: string
  tags?: string[]
  thumbnailUrl?: string | null
}>()
</script>
