<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { ref } from 'vue'

import InputGroup from '@comfyorg/design-system/input-group/InputGroup'
import InputGroupAddon from '@comfyorg/design-system/input-group/InputGroupAddon'
import InputGroupButton from '@comfyorg/design-system/input-group/InputGroupButton'
import InputGroupInput from '@comfyorg/design-system/input-group/InputGroupInput'

const {
  class: className,
  disabled = false,
  hidePasswordLabel,
  showPasswordLabel
} = defineProps<{
  hidePasswordLabel: string
  showPasswordLabel: string
  class?: HTMLAttributes['class']
  disabled?: boolean
}>()

const modelValue = defineModel<string>()
const visible = ref(false)

defineOptions({ inheritAttrs: false })
</script>

<template>
  <InputGroup :class="className">
    <InputGroupInput
      v-model="modelValue"
      v-bind="$attrs"
      :type="visible ? 'text' : 'password'"
      :disabled
    />
    <InputGroupAddon align="inline-end">
      <InputGroupButton
        size="icon-sm"
        :disabled
        :aria-label="visible ? hidePasswordLabel : showPasswordLabel"
        :aria-pressed="visible"
        @click="visible = !visible"
      >
        <i
          :class="visible ? 'icon-[lucide--eye-off]' : 'icon-[lucide--eye]'"
          class=""
        />
      </InputGroupButton>
    </InputGroupAddon>
  </InputGroup>
</template>
