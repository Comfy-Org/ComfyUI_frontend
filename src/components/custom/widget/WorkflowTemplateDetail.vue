<script setup lang="ts">
import { ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import WorkflowTemplateDetailGroup from '@/components/custom/widget/WorkflowTemplateDetailGroup.vue'
import Button from '@/components/ui/button/Button.vue'
import type { TemplateDetailGroup } from '@/platform/workflow/templates/types/templateDetail'

const {
  title,
  description,
  groups,
  cloudUrl,
  isPartnerNode = false,
  openPending = false
} = defineProps<{
  title: string
  description: string
  groups: readonly TemplateDetailGroup[]
  cloudUrl?: string
  isPartnerNode?: boolean
  openPending?: boolean
}>()

const emit = defineEmits<{
  'open-template': []
  'download-model': [rowId: string]
}>()

const { t } = useI18n()
const detailRoot = ref<HTMLElement | null>(null)
const detailId = useId()
const cloudTitleId = `${detailId}-cloud-title`
const groupTitleId = (groupId: string) => `${detailId}-group-${groupId}`

defineExpose({
  focus: () => detailRoot.value?.focus()
})
</script>

<template>
  <article
    ref="detailRoot"
    :aria-label="title"
    tabindex="-1"
    class="@container/template-detail flex size-full min-h-0 flex-1 flex-col overflow-hidden bg-base-background text-base-foreground"
  >
    <div
      class="grid min-h-0 flex-1 grid-cols-1 overflow-hidden border-t border-border-subtle @[48rem]/template-detail:grid-cols-[minmax(20rem,5fr)_minmax(0,6fr)] @[48rem]/template-detail:grid-rows-[auto_minmax(0,1fr)]"
    >
      <aside
        class="flex min-h-0 shrink-0 flex-col gap-6 overflow-y-auto border-b border-border-subtle p-6 @[48rem]/template-detail:row-span-2 @[48rem]/template-detail:gap-8 @[48rem]/template-detail:border-r @[48rem]/template-detail:border-b-0 @[48rem]/template-detail:p-8"
      >
        <div class="w-full shrink-0 overflow-hidden rounded-lg">
          <slot name="preview" />
        </div>

        <section
          v-if="cloudUrl"
          :aria-labelledby="cloudTitleId"
          class="flex shrink-0 flex-col gap-4 rounded-lg bg-secondary-background/50 p-4"
        >
          <div class="flex min-w-0 flex-col gap-2">
            <h3 :id="cloudTitleId" class="m-0 text-sm font-medium">
              {{
                t(
                  isPartnerNode
                    ? 'templateWorkflows.detail.partnerNodeTitle'
                    : 'templateWorkflows.detail.cloudUpsellTitle'
                )
              }}
            </h3>
            <p class="m-0 text-xs/4 font-normal text-muted-foreground">
              {{
                t(
                  isPartnerNode
                    ? 'templateWorkflows.detail.partnerNodeDescription'
                    : 'templateWorkflows.detail.cloudUpsellDescription'
                )
              }}
            </p>
          </div>
          <Button
            as="a"
            :href="cloudUrl"
            target="_blank"
            rel="noopener noreferrer"
            variant="secondary"
            size="md"
            class="w-full text-base-foreground no-underline"
          >
            {{ t('templateWorkflows.detail.openInCloud') }}
          </Button>
        </section>
      </aside>

      <div
        class="flex shrink-0 flex-col gap-2 p-6 @[48rem]/template-detail:p-8"
      >
        <h2 class="m-0 text-base font-semibold wrap-break-word">
          {{ title }}
        </h2>
        <p
          class="m-0 max-w-2xl text-sm/relaxed wrap-break-word text-muted-foreground"
        >
          {{ description }}
        </p>
      </div>

      <div
        v-if="groups.length > 0"
        role="region"
        :aria-label="t('templateWorkflows.detail.requirements')"
        tabindex="0"
        class="min-h-0 overflow-y-auto border-t border-border-subtle px-4 py-2"
      >
        <WorkflowTemplateDetailGroup
          v-for="group in groups"
          :key="group.id"
          :group
          :title-id="groupTitleId(group.id)"
          @download-model="emit('download-model', $event)"
        />
      </div>
    </div>

    <footer
      class="flex min-h-15 shrink-0 items-center justify-end border-t border-border-subtle px-6 py-4"
    >
      <Button
        variant="inverted"
        size="sm"
        :loading="openPending"
        @click="emit('open-template')"
      >
        {{ t('templateWorkflows.detail.openTemplate') }}
      </Button>
    </footer>
  </article>
</template>
