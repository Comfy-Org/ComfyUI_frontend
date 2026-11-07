<template>
  <div class="flex flex-col gap-1">
    <ul
      :aria-label="$t('buildCustomNodes.picker.license.heading')"
      class="m-0 flex max-h-64 list-none flex-col gap-1 overflow-y-auto p-0"
    >
      <li v-for="license in licenses" :key="license">
        <label
          class="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1.5 text-sm hover:bg-secondary"
        >
          <NodePackCheckbox
            :model-value="picked.has(license)"
            @update:model-value="toggle(license)"
          />
          <span class="truncate" :title="licenseText(license)">
            {{ licenseText(license) }}
          </span>
        </label>
      </li>
    </ul>
    <Button
      variant="muted-textonly"
      size="md"
      class="mt-1 w-full justify-start border-t border-border"
      :disabled="picked.size === 0"
      @click="picked = new Set()"
    >
      {{ $t('buildCustomNodes.picker.license.clear') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { useI18n } from 'vue-i18n'

import NodePackCheckbox from '@/platform/workspace/buildCustomNodes/components/NodePackCheckbox.vue'
import { UNLISTED_LICENSE } from '@/platform/workspace/buildCustomNodes/nodePackTable'

const { licenses } = defineProps<{
  licenses: readonly string[]
}>()

const picked = defineModel<ReadonlySet<string>>({ required: true })

const { t } = useI18n()

function licenseText(license: string): string {
  return license === UNLISTED_LICENSE
    ? t('buildCustomNodes.picker.license.unlisted')
    : license
}

function toggle(license: string) {
  const next = new Set(picked.value)
  if (!next.delete(license)) next.add(license)
  picked.value = next
}
</script>
