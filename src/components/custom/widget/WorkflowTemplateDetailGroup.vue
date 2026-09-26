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
            'flex min-h-14 items-center gap-3 rounded-md p-2',
            row.status?.kind === 'installed' && 'opacity-60'
          )
        "
      >
        <span
          class="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-secondary-background text-muted-foreground"
        >
          <img
            v-if="row.kind === 'input' && row.preview?.mediaType === 'image'"
            :src="row.preview.src"
            alt=""
            loading="lazy"
            class="size-full object-cover"
          />
          <video
            v-else-if="
              row.kind === 'input' && row.preview?.mediaType === 'video'
            "
            :src="row.preview.src"
            aria-hidden="true"
            muted
            playsinline
            preload="metadata"
            class="size-full object-cover"
          />
          <i
            v-else
            aria-hidden="true"
            :class="
              row.kind === 'input'
                ? 'icon-[lucide--file-input] size-4'
                : 'icon-[lucide--box] size-4'
            "
          />
        </span>
        <span class="flex min-w-0 flex-1 flex-col gap-0.5">
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
