<script setup lang="ts">
import type { TagsInputItemDeleteProps } from 'reka-ui'
import { TagsInputItemDelete, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { cn } from '@/utils/tailwindUtil'

const { class: className, ...restProps } = defineProps<
  TagsInputItemDeleteProps & { class?: HTMLAttributes['class'] }
>()

const forwardedProps = useForwardProps(restProps)
const { t } = useI18n()
</script>

<template>
  <TagsInputItemDelete
    v-bind="forwardedProps"
    :as="Button"
    variant="textonly"
    size="icon-sm"
    :aria-label="t('g.removeTag')"
    :class="
      cn(
        'w-4 overflow-hidden opacity-60 transition-[opacity,width] duration-150 hover:bg-transparent hover:opacity-100 data-[disabled]:pointer-events-none data-[disabled]:w-0 data-[disabled]:opacity-0',
        className
      )
    "
  >
    <slot>
      <i class="icon-[lucide--x] size-4" />
    </slot>
  </TagsInputItemDelete>
</template>
