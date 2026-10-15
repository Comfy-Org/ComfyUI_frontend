<script setup lang="ts">
import { Download, FileBox } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import IconButton from '@/components/ui/icon-button/IconButton.vue'
import { translationsFor } from '@/i18n/translations'

const { t } = translationsFor('en')

const { name, href, type, folder, downloadUrl } = defineProps<{
  name: string
  href?: string
  type?: string
  folder?: string
  downloadUrl?: string
}>()
</script>

<template>
  <div
    class="flex items-start gap-2.5 border-t border-transparency-white-t8 py-2.5"
    data-testid="workflow-file"
  >
    <FileBox
      class="mt-0.5 size-4 shrink-0 text-primary-warm-gray"
      aria-hidden="true"
    />
    <component
      :is="href ? 'a' : 'div'"
      :href
      class="group flex min-w-0 flex-1 flex-col gap-1 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
    >
      <span
        :class="
          cn(
            'font-mono text-xs break-all text-primary-comfy-canvas',
            href && 'transition-colors group-hover:text-primary-comfy-yellow'
          )
        "
      >
        {{ name }}
      </span>
      <span
        v-if="type || folder"
        class="text-xs text-primary-warm-gray"
        data-testid="workflow-file-place"
      >
        {{ type && folder ? `${type} · ` : type
        }}<span v-if="folder" class="font-mono">{{ folder }}</span>
      </span>
    </component>
    <IconButton
      v-if="downloadUrl"
      as="a"
      :href="downloadUrl"
      size="sm"
      class="rounded-lg border border-transparency-white-t8"
      :aria-label="t('workshop.workflow.downloadFile', { name })"
      data-testid="workflow-file-download"
    >
      <Download class="size-4" aria-hidden="true" />
    </IconButton>
  </div>
</template>
