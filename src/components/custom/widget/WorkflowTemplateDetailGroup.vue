<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import WorkflowTemplateModelStatus from '@/components/custom/widget/WorkflowTemplateModelStatus.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import type { TemplateDetailGroup } from '@/platform/workflow/templates/types/templateDetail'

const { group, titleId } = defineProps<{
  group: TemplateDetailGroup
  titleId: string
}>()
const emit = defineEmits<{ 'download-model': [rowId: string] }>()
</script>

<template>
  <section
    :aria-labelledby="titleId"
    class="border-t border-border-subtle/60 pb-2 first:border-t-0"
  >
    <div class="flex h-10 items-center gap-2 px-2">
      <h3 :id="titleId" class="m-0 text-sm font-medium">{{ group.label }}</h3>
      <Badge severity="secondary" variant="badge">
        {{ group.rows.length }}
      </Badge>
      <span v-if="group.total" class="ml-auto text-sm text-muted-foreground">
        {{ group.total }}
      </span>
    </div>
    <ul class="m-0 list-none p-0">
      <li
        v-for="row in group.rows"
        :key="row.id"
        :class="
          cn(
            'grid min-h-14 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-md p-2',
            row.status?.kind === 'installed' && 'opacity-60'
          )
        "
      >
        <span
          class="col-start-1 row-start-1 flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary-background text-muted-foreground"
        >
          <i aria-hidden="true" class="icon-[comfy--ai-model] size-4" />
        </span>
        <span class="col-start-2 row-start-1 flex min-w-0 flex-col gap-0.5">
          <span class="truncate text-sm" :title="row.name">{{ row.name }}</span>
          <span
            class="truncate text-xs text-muted-foreground"
            :title="row.description"
          >
            {{ row.description }}
          </span>
        </span>
        <WorkflowTemplateModelStatus
          :row
          @download="emit('download-model', row.id)"
        />
      </li>
    </ul>
  </section>
</template>
