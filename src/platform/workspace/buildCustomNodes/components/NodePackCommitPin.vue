<template>
  <div class="border-t border-border p-1 pt-2">
    <Button
      v-if="!editing"
      variant="textonly"
      size="md"
      class="w-full justify-start"
      :aria-label="
        $t('buildCustomNodes.picker.pinCommitLabel', { pack: packName })
      "
      @click="editing = true"
    >
      {{ $t('buildCustomNodes.picker.pinCommit') }}
    </Button>
    <form v-else class="flex flex-col gap-1.5" @submit.prevent="pin">
      <div class="flex gap-1.5">
        <Input
          v-model="draft"
          autofocus
          :aria-label="$t('buildCustomNodes.picker.commitField')"
          :placeholder="$t('buildCustomNodes.picker.commitField')"
          :aria-invalid="invalid || undefined"
          :aria-describedby="invalid ? errorId : undefined"
          class="h-8 font-mono text-xs"
        />
        <Button
          type="submit"
          variant="inverted"
          size="md"
          :disabled="draft.trim() === ''"
        >
          {{ $t('buildCustomNodes.picker.pin') }}
        </Button>
      </div>
      <small v-if="invalid" :id="errorId" role="alert" class="text-destructive">
        {{ $t('buildCustomNodes.picker.notCommit') }}
      </small>
    </form>
  </div>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import Input from '@comfyorg/design-system/input/Input'
import { ref, useId } from 'vue'

import { isCommitHash } from '@/platform/workspace/buildCustomNodes/nodePackChoice'

const { packName } = defineProps<{
  packName: string
}>()

const emit = defineEmits<{
  pin: [hash: string]
}>()

const editing = ref(false)
const draft = ref('')
const invalid = ref(false)
const errorId = useId()

function pin() {
  const hash = draft.value.trim()
  invalid.value = !isCommitHash(hash)
  if (!invalid.value) emit('pin', hash)
}
</script>
