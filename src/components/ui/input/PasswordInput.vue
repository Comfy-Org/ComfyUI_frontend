<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { ref } from 'vue'

import InputGroup from '@/components/ui/input-group/InputGroup.vue'
import InputGroupAddon from '@/components/ui/input-group/InputGroupAddon.vue'
import InputGroupButton from '@/components/ui/input-group/InputGroupButton.vue'
import InputGroupInput from '@/components/ui/input-group/InputGroupInput.vue'

const { class: className, disabled = false } = defineProps<{
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
        :aria-label="$t(visible ? 'auth.hidePassword' : 'auth.showPassword')"
        :aria-pressed="visible"
        @click="visible = !visible"
      >
        <i
          :class="visible ? 'icon-[lucide--eye-off]' : 'icon-[lucide--eye]'"
          class="size-4"
        />
      </InputGroupButton>
    </InputGroupAddon>
  </InputGroup>
</template>
