<template>
  <BuilderDialog @close="emit('close')">
    <template #title>
      {{ $t('builderToolbar.saveAs') }}
    </template>

    <div class="flex flex-col gap-2">
      <label :for="inputId" class="text-sm text-muted-foreground">
        {{ $t('builderToolbar.filename') }}
      </label>
      <input
        :id="inputId"
        v-model="filename"
        autofocus
        type="text"
        class="focus-visible:ring-ring flex h-10 min-h-8 items-center self-stretch rounded-lg border-none bg-secondary-background pl-4 text-sm text-base-foreground"
        @keydown.enter="
          filename.trim() && emit('save', filename.trim(), openAsApp)
        "
      />
    </div>

    <div class="flex flex-col gap-2">
      <label :id="radioGroupLabelId" class="text-sm text-muted-foreground">
        {{ $t('builderToolbar.defaultViewLabel') }}
      </label>
      <ViewTypeRadioGroup
        v-model="openAsApp"
        :aria-labelledby="radioGroupLabelId"
      />
    </div>

    <template #footer>
      <Button variant="muted-textonly" size="lg" @click="emit('close')">
        {{ $t('g.cancel') }}
      </Button>
      <Button
        variant="secondary"
        size="lg"
        :disabled="!filename.trim()"
        @click="emit('save', filename.trim(), openAsApp)"
      >
        {{ $t('g.save') }}
      </Button>
    </template>
  </BuilderDialog>
</template>

<script setup lang="ts">
import { ref, useId } from 'vue'

import Button from '@/components/ui/button/Button.vue'

import BuilderDialog from './BuilderDialog.vue'
import ViewTypeRadioGroup from './ViewTypeRadioGroup.vue'

const { defaultFilename, defaultOpenAsApp = true } = defineProps<{
  defaultFilename: string
  defaultOpenAsApp?: boolean
}>()

const emit = defineEmits<{
  save: [filename: string, openAsApp: boolean]
  close: []
}>()

const inputId = useId()
const radioGroupLabelId = useId()
const filename = ref(defaultFilename)
const openAsApp = ref(defaultOpenAsApp)
</script>
