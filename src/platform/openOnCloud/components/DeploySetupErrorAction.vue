<template>
  <div v-if="isOffered">
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="outline"
          size="unset"
          class="min-h-8 max-w-full gap-1.5 rounded-lg px-3 py-1.75 text-left text-xs font-normal whitespace-normal"
          data-testid="deploy-setup-error-action"
          @click="deploySetup"
        >
          <i class="icon-[lucide--cloud] size-3.5" aria-hidden="true" />
          {{ $t('openOnCloud.deploySetup') }}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" class="max-w-62.5">
        {{ $t('openOnCloud.outOfMemoryTooltip') }}
      </TooltipContent>
    </Tooltip>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import TooltipContent from '@/components/ui/tooltip/TooltipContent.vue'
import TooltipTrigger from '@/components/ui/tooltip/TooltipTrigger.vue'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import { openDeploySetupDialog } from '@/platform/openOnCloud/openDeploySetupDialog'

const { flags } = useFeatureFlags()
const isOffered = computed(() => !isCloud && flags.openOnCloudEnabled)
const { toastErrorHandler } = useErrorHandling()

function deploySetup() {
  openDeploySetupDialog().catch(toastErrorHandler)
}
</script>
