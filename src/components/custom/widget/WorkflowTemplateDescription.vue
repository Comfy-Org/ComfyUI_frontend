<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useResizeObserver } from '@vueuse/core'
import { nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { description } = defineProps<{ description: string }>()
const { t } = useI18n()

/**
 * Whether three lines clip this text depends on the rendered width, so it is
 * measured rather than guessed from a character count, and remeasured on resize.
 */
const showFullDescription = ref(false)
const descriptionElement =
  useTemplateRef<HTMLParagraphElement>('descriptionElement')
const descriptionOverflows = ref(false)

function measureDescriptionOverflow() {
  const element = descriptionElement.value
  descriptionOverflows.value =
    !!element && element.scrollHeight > element.clientHeight + 1
}

onMounted(measureDescriptionOverflow)
useResizeObserver(descriptionElement, measureDescriptionOverflow)

/**
 * A clamped paragraph keeps its height when the text changes, so the resize
 * observer never fires and both the measurement and the expanded state would
 * describe the previous template.
 */
watch(
  () => description,
  () => {
    showFullDescription.value = false
    void nextTick(measureDescriptionOverflow)
  }
)
</script>

<template>
  <p
    ref="descriptionElement"
    :class="
      cn(
        'm-0 max-w-2xl overflow-hidden text-sm/relaxed wrap-break-word text-muted-foreground transition-[max-height] duration-200 ease-out [interpolate-size:allow-keywords] motion-reduce:transition-none',
        showFullDescription ? 'max-h-max' : 'line-clamp-3 max-h-[3lh]'
      )
    "
  >
    {{ description }}
  </p>
  <!--
    Expanding removes the overflow that revealed this control, so the expanded
    state has to keep it rendered or there is no way back to three lines.
  -->
  <button
    v-if="descriptionOverflows || showFullDescription"
    type="button"
    class="m-0 flex w-fit cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-sm text-base-foreground hover:underline"
    :aria-expanded="showFullDescription"
    @click="showFullDescription = !showFullDescription"
  >
    {{
      t(
        showFullDescription
          ? 'templateWorkflows.detail.descriptionLess'
          : 'templateWorkflows.detail.descriptionMore'
      )
    }}
    <i
      aria-hidden="true"
      :class="
        cn(
          'icon-[lucide--chevron-down] size-3.5 transition-transform duration-200 motion-reduce:transition-none',
          showFullDescription && 'rotate-180'
        )
      "
    />
  </button>
</template>
