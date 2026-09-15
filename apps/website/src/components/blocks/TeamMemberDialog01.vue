<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'

import type { CardWorkflowItem } from './CardWorkflow01.vue'
import CardWorkflow01 from './CardWorkflow01.vue'
import Badge from '../ui/badge/Badge.vue'
import Dialog from '../ui/dialog/Dialog.vue'
import DialogContent from '../ui/dialog/DialogContent.vue'
import DialogDescription from '../ui/dialog/DialogDescription.vue'
import DialogTitle from '../ui/dialog/DialogTitle.vue'
import DialogTrigger from '../ui/dialog/DialogTrigger.vue'

const {
  name,
  avatarSrc,
  description,
  tags = [],
  workflows = [],
  closeLabel,
  // Explicit undefined default keeps Vue from coercing the absent boolean to
  // false, which would lock the reka-ui DialogRoot into controlled-closed mode.
  open = undefined,
  defaultOpen = undefined,
  class: className
} = defineProps<{
  name: string
  avatarSrc: string
  description: string
  tags?: readonly string[]
  workflows?: readonly CardWorkflowItem[]
  closeLabel: string
  open?: boolean
  defaultOpen?: boolean
  class?: HTMLAttributes['class']
}>()

const emit = defineEmits<{ 'update:open': [value: boolean] }>()
</script>

<template>
  <Dialog :open :default-open @update:open="emit('update:open', $event)">
    <DialogTrigger v-if="$slots.trigger" as-child>
      <slot name="trigger" />
    </DialogTrigger>
    <DialogContent
      :close-label
      :class="cn('scrollbar-none sm:max-w-6xl', className)"
    >
      <div class="flex flex-col gap-8 sm:flex-row sm:items-center sm:gap-11">
        <img
          :src="avatarSrc"
          alt=""
          class="size-36 shrink-0 rounded-full object-cover lg:size-47"
        />
        <div class="flex flex-col items-start gap-6 sm:pr-16">
          <DialogTitle>{{ name }}</DialogTitle>
          <div
            v-if="tags.length"
            class="flex min-w-0 flex-wrap items-center gap-1.5"
          >
            <Badge
              v-for="tag in tags"
              :key="tag"
              variant="subtle"
              size="md"
              class="shrink-0 py-2 uppercase"
            >
              {{ tag }}
            </Badge>
          </div>
        </div>
      </div>
      <DialogDescription class="mt-8 font-semibold">
        {{ description }}
      </DialogDescription>
      <div
        v-if="workflows.length"
        class="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3"
      >
        <CardWorkflow01
          v-for="workflow in workflows"
          :key="workflow.id"
          :item="workflow"
        />
      </div>
    </DialogContent>
  </Dialog>
</template>
