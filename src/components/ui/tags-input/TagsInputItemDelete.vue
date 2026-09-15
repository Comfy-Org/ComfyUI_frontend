<script setup lang="ts">
import type { TagsInputItemDeleteProps } from 'reka-ui'
import { TagsInputItemDelete, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { useI18n } from 'vue-i18n'

import TagRemoveButton from '@/components/chip/TagRemoveButton.vue'

const { class: className, ...restProps } = defineProps<
  TagsInputItemDeleteProps & { class?: HTMLAttributes['class'] }
>()

const forwardedProps = useForwardProps(restProps)
const { t } = useI18n()
</script>

<template>
  <TagsInputItemDelete
    v-bind="forwardedProps"
    :as="TagRemoveButton"
    :label="t('g.removeTag')"
    :class="className"
  >
    <slot>
      <i class="icon-[lucide--x] size-4" />
    </slot>
  </TagsInputItemDelete>
</template>
