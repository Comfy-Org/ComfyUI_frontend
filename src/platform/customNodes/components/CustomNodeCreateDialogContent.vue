<template>
  <form
    class="flex flex-col gap-4 pt-2"
    data-testid="custom-node-create-dialog"
    @submit.prevent="submit"
  >
    <label
      v-if="!targetPackName"
      class="flex flex-col gap-1.5 text-sm text-muted-foreground"
    >
      {{ $t('customNodePacks.createDialog.packName') }}
      <Input
        v-model="packName"
        type="text"
        maxlength="80"
        autocomplete="off"
        spellcheck="false"
        :aria-label="$t('customNodePacks.createDialog.packName')"
        :aria-invalid="packError ? 'true' : undefined"
      />
    </label>
    <p v-else class="m-0 text-sm text-muted-foreground">
      {{
        $t('customNodePacks.createDialog.addingTo', { name: targetPackName })
      }}
    </p>
    <p
      v-if="packError"
      class="m-0 text-xs text-destructive-background"
      role="alert"
    >
      {{ packError }}
    </p>

    <label class="flex flex-col gap-1.5 text-sm text-muted-foreground">
      {{ $t('customNodePacks.createDialog.nodeName') }}
      <Input
        v-model="nodeName"
        type="text"
        maxlength="80"
        autocomplete="off"
        spellcheck="false"
        autofocus
        :aria-label="$t('customNodePacks.createDialog.nodeName')"
        :aria-invalid="nodeError ? 'true' : undefined"
      />
    </label>
    <p
      v-if="nodeError"
      class="m-0 text-xs text-destructive-background"
      role="alert"
    >
      {{ nodeError }}
    </p>

    <label class="flex flex-col gap-1.5 text-sm text-muted-foreground">
      {{ $t('customNodePacks.createDialog.promptLabel') }}
      <Textarea
        v-model="prompt"
        class="max-h-40 min-h-16 font-inter text-sm"
        maxlength="4096"
        :placeholder="$t('customNodePacks.createDialog.promptPlaceholder')"
        :aria-label="$t('customNodePacks.createDialog.promptLabel')"
      />
      <span class="text-xs text-muted-foreground">
        {{ $t('customNodePacks.createDialog.promptHint') }}
      </span>
    </label>

    <div class="flex justify-end gap-2">
      <Button variant="secondary" size="md" type="button" @click="onCancel">
        {{ $t('g.cancel') }}
      </Button>
      <Button variant="primary" size="md" type="submit" :disabled="!isValid">
        {{ $t('customNodePacks.createDialog.confirm') }}
      </Button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'

import { isValidCustomNodeName, nodeClassNameFor } from '../utils/nodeNaming'

export interface CustomNodeCreateRequest {
  packName: string
  nodeName: string
  prompt: string
}

const {
  targetPackName,
  defaultPackName = '',
  defaultNodeName = '',
  existingPackNames = [],
  existingNodeClassNames = [],
  onSubmit,
  onCancel
} = defineProps<{
  /** Set when adding a node to an existing pack; omitted for a new pack. */
  targetPackName?: string
  defaultPackName?: string
  defaultNodeName?: string
  existingPackNames?: string[]
  /** Generated class names of nodes the target pack already registers. */
  existingNodeClassNames?: string[]
  onSubmit: (request: CustomNodeCreateRequest) => void
  onCancel: () => void
}>()

const { t } = useI18n()
const packName = ref(defaultPackName)
const nodeName = ref(defaultNodeName)
const prompt = ref('')

const taken = computed(
  () => new Set(existingPackNames.map((name) => name.trim().toLowerCase()))
)

const packError = computed(() => {
  if (targetPackName) return ''
  const value = packName.value.trim()
  if (value === '') return t('customNodePacks.createDialog.packRequired')
  if (!isValidCustomNodeName(value))
    return t('customNodePacks.createDialog.invalidName')
  if (taken.value.has(value.toLowerCase()))
    return t('customNodePacks.createDialog.packTaken')
  return ''
})

const takenNodes = computed(() => new Set(existingNodeClassNames))

const nodeError = computed(() => {
  const value = nodeName.value.trim()
  if (value === '') return t('customNodePacks.createDialog.nodeRequired')
  if (!isValidCustomNodeName(value))
    return t('customNodePacks.createDialog.invalidName')
  if (takenNodes.value.has(nodeClassNameFor(value)))
    return t('customNodePacks.createDialog.nodeTaken')
  return ''
})

const isValid = computed(() => packError.value === '' && nodeError.value === '')

function submit() {
  if (!isValid.value) return
  onSubmit({
    packName: (targetPackName ?? packName.value).trim(),
    nodeName: nodeName.value.trim(),
    prompt: prompt.value.trim()
  })
}
</script>
