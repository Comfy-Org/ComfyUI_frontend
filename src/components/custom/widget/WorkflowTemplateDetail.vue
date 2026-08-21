<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import Badge from '@/components/common/Badge.vue'
import Button from '@/components/ui/button/Button.vue'
import type {
  TemplateDetailGroup,
  TemplateDetailRow
} from '@/platform/workflow/templates/types/templateDetail'

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
}>()

const { t } = useI18n()

const rowIconClasses: Record<TemplateDetailRow['kind'], string> = {
  model: 'icon-[lucide--box]',
  'custom-node': 'icon-[lucide--blocks]'
}
</script>

<template>
  <article
    :aria-label="title"
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
          aria-labelledby="workflow-template-detail-cloud-title"
          class="flex shrink-0 flex-col gap-4 rounded-lg bg-secondary-background/50 p-4"
        >
          <span class="flex min-w-0 flex-col gap-2">
            <h3
              id="workflow-template-detail-cloud-title"
              class="m-0 text-[13px]/[18px] font-medium"
            >
              {{
                t(
                  isPartnerNode
                    ? 'templateWorkflows.detail.partnerNodeTitle'
                    : 'templateWorkflows.detail.cloudUpsellTitle'
                )
              }}
            </h3>
            <span class="text-xs/4 font-normal text-muted-foreground">
              {{
                t(
                  isPartnerNode
                    ? 'templateWorkflows.detail.partnerNodeDescription'
                    : 'templateWorkflows.detail.cloudUpsellDescription'
                )
              }}
            </span>
          </span>
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
        class="min-h-0 overflow-y-auto border-t border-border-subtle px-4 py-2"
      >
        <section
          v-for="group in groups"
          :key="group.id"
          :aria-labelledby="`workflow-template-detail-group-${group.id}`"
          class="border-t border-border-subtle/60 pb-2 first:border-t-0"
        >
          <div class="flex h-10 items-center gap-2 px-2">
            <h3
              :id="`workflow-template-detail-group-${group.id}`"
              class="m-0 text-sm font-medium"
            >
              {{ group.label }}
            </h3>
            <Badge
              :label="group.rows.length"
              severity="secondary"
              variant="circle"
              class="size-4"
            />
            <span
              v-if="group.total"
              class="ml-auto text-sm text-muted-foreground"
            >
              {{ group.total }}
            </span>
          </div>

          <ul class="m-0 list-none p-0">
            <li
              v-for="row in group.rows"
              :key="row.id"
              class="flex min-h-14 items-center gap-3 rounded-md p-2"
            >
              <span
                class="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary-background text-muted-foreground"
              >
                <i
                  aria-hidden="true"
                  :class="cn(rowIconClasses[row.kind], 'size-4')"
                />
              </span>

              <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                <span class="truncate text-sm" :title="row.name">
                  {{ row.name }}
                </span>
                <span
                  class="truncate text-xs text-muted-foreground"
                  :title="row.description"
                >
                  {{ row.description }}
                </span>
              </span>
            </li>
          </ul>
        </section>
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
