<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { cn } from '@comfyorg/tailwind-utils'

import type { ReplyAudioAsset } from '../../../utils/replyAssets'
import ReplyAudioCard from './ReplyAudioCard.vue'

const { assets, assetNames, collapsible, expanded } = defineProps<{
  assets: ReplyAudioAsset[]
  assetNames: Record<string, string>
  collapsible: boolean
  expanded: boolean
}>()

defineEmits<{ toggle: [] }>()

const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col gap-1">
    <ReplyAudioCard
      v-for="asset in assets"
      :key="asset.url"
      :asset
      :title="assetNames[asset.url] || asset.label || asset.filename"
    />
    <Button
      v-if="collapsible"
      type="button"
      variant="outline"
      size="sm"
      class="self-center rounded-full border-component-node-border"
      @click="$emit('toggle')"
    >
      {{ expanded ? t('agent.showLess') : t('agent.showMore') }}
      <span
        :class="
          cn('icon-[lucide--chevron-down] size-3', expanded && 'rotate-180')
        "
      />
    </Button>
  </div>
</template>
