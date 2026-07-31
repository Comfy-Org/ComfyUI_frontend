<template>
  <div>
    <Button
      v-if="!isOpen"
      variant="secondary"
      size="lg"
      class="self-start"
      @click="open"
    >
      {{ $t('subscription.preview.addPromoCode') }}
    </Button>
    <Input
      v-else
      ref="inputRef"
      v-model="model"
      class="w-full"
      :placeholder="$t('subscription.preview.promotionCodePlaceholder')"
      autocomplete="off"
      @blur="onBlur"
    />
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'

const model = defineModel<string>({ required: true })

const isOpen = ref(false)
const inputRef = ref<InstanceType<typeof Input>>()

function open() {
  isOpen.value = true
  void nextTick(() => {
    const el = inputRef.value?.$el
    if (el instanceof HTMLInputElement) el.focus()
  })
}

// An empty field collapses back to the button on blur; a typed code keeps
// the field so the entered value stays visible.
function onBlur() {
  if (!model.value.trim()) isOpen.value = false
}
</script>
