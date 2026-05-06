<script setup lang="ts">
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'

import { RemoteComboKey } from './state'
import type { RemoteComboContext } from './state'

const props = defineProps<{
  class?: string
  context?: RemoteComboContext
  disabled?: boolean
}>()

const injected = inject(RemoteComboKey, null)
const resolved = props.context ?? injected
if (!resolved) {
  throw new Error(
    'RemoteCombo.Refresh requires a RemoteComboContext (provide via Root or pass as prop)'
  )
}
const ctx = resolved

const { t } = useI18n()

async function handleClick() {
  await ctx.refresh()
}
</script>

<template>
  <Button
    variant="textonly"
    size="icon"
    type="button"
    :disabled="props.disabled"
    :aria-label="t('widgets.remoteCombo.refresh')"
    :title="t('widgets.remoteCombo.refresh')"
    :class="cn('shrink-0', props.class)"
    data-testid="remote-combo-refresh"
    @click.stop="handleClick"
  >
    <i
      :class="
        cn(
          'icon-[lucide--rotate-cw] size-4',
          ctx.isFetching.value && 'animate-spin'
        )
      "
      aria-hidden="true"
    />
  </Button>
</template>
