<script setup lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger
} from 'reka-ui'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Popover from '@/components/ui/Popover.vue'
import { useCreditsBadgesInGraph } from '@/composables/node/usePriceBadge'
import PartnerNodeItem from '@/renderer/extensions/linearMode/PartnerNodeItem.vue'

defineProps<{ mobile?: boolean }>()

const creditsBadges = useCreditsBadgesInGraph()
const { t } = useI18n()
</script>
<template>
  <Popover v-if="mobile && creditsBadges.length" side="top">
    <template #button>
      <Button class="mr-2 size-10">
        <i class="icon-[comfy--credits] bg-credit" />
      </Button>
    </template>
    <section
      class="max-h-(--reka-popover-content-available-height) scroll-shadows-comfy-menu-bg overflow-y-auto"
    >
      <PartnerNodeItem
        v-for="[title, price, key] in creditsBadges"
        :key
        :title
        :price
      />
    </section>
  </Popover>
  <div v-else-if="creditsBadges.length === 1">
    <PartnerNodeItem
      v-for="[title, price, key] in creditsBadges"
      :key
      :title
      :price
      class="border-t border-border-subtle pt-2"
    />
  </div>
  <CollapsibleRoot
    v-else-if="creditsBadges.length"
    v-slot="{ open }"
    class="flex max-h-1/2 w-full flex-col"
  >
    <div class="mb-1 w-full border-b border-border-subtle" />
    <CollapsibleTrigger as-child>
      <Button variant="textonly" class="w-full text-sm">
        <i class="icon-[comfy--credits] size-4 bg-credit" />
        {{ t('linearMode.hasCreditCost') }}
        <i v-if="open" class="ml-auto icon-[lucide--chevron-up]" />
        <i v-else class="ml-auto icon-[lucide--chevron-down]" />
      </Button>
    </CollapsibleTrigger>
    <CollapsibleContent class="scroll-shadows-comfy-menu-bg overflow-y-auto">
      <PartnerNodeItem
        v-for="[title, price, key] in creditsBadges"
        :key
        :title
        :price
      />
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
