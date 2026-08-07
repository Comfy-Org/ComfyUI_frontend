<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import type { HTMLAttributes } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'

import Dialog from '../ui/dialog/Dialog.vue'
import DialogContent from '../ui/dialog/DialogContent.vue'
import DialogDescription from '../ui/dialog/DialogDescription.vue'
import DialogTitle from '../ui/dialog/DialogTitle.vue'
import DialogTrigger from '../ui/dialog/DialogTrigger.vue'
import IconButton from '../ui/icon-button/IconButton.vue'

const {
  name,
  avatarSrc,
  bio,
  workflowsHref,
  workflowsLabel,
  closeLabel,
  // Explicit undefined default keeps Vue from coercing the absent boolean to
  // false, which would lock the reka-ui DialogRoot into controlled-closed mode.
  open = undefined,
  defaultOpen = undefined,
  class: className
} = defineProps<{
  name: string
  avatarSrc: string
  bio: readonly string[]
  workflowsHref?: string
  workflowsLabel?: string
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
    <DialogContent :close-label :class="cn('sm:max-w-6xl', className)">
      <div class="flex flex-col gap-8 sm:flex-row sm:items-center sm:gap-11">
        <img
          :src="avatarSrc"
          alt=""
          class="size-36 shrink-0 rounded-full object-cover lg:size-47"
        />
        <div class="flex flex-col items-start gap-5 sm:pr-16">
          <DialogTitle>{{ name }}</DialogTitle>
          <a
            v-if="workflowsHref && workflowsLabel"
            :href="workflowsHref"
            class="group flex items-center gap-4"
          >
            <IconButton
              as="span"
              variant="solid"
              size="sm"
              class="rounded-xl transition-opacity group-hover:opacity-90"
            >
              <ChevronRight class="size-5" />
            </IconButton>
            <span
              class="text-primary-comfy-yellow text-sm font-extrabold tracking-wider uppercase"
            >
              {{ workflowsLabel }}
            </span>
          </a>
        </div>
      </div>
      <DialogDescription as="div" class="mt-8 space-y-4 lg:mt-10">
        <p v-for="(paragraph, index) in bio" :key="index">{{ paragraph }}</p>
      </DialogDescription>
    </DialogContent>
  </Dialog>
</template>
