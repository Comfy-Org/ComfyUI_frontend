<template>
  <TextTooltip
    v-if="hasDeployments"
    :text="$t('deploymentSwitcher.manageDeploymentsTooltip')"
    side="right"
  >
    <MenuItem as-child :class="switcherItemClass">
      <a
        :href="buildsUrl"
        target="_blank"
        :rel="platformLinkRel()"
        class="text-foreground no-underline"
        data-testid="deployment-switcher-builds"
        @click="trackDeploymentLinkOpened($event, 'manage_deployments')"
      >
        <i
          class="icon-[lucide--arrow-up-right] size-3.5 text-muted-foreground"
          aria-hidden="true"
        />
        {{ $t('deploymentSwitcher.manageDeployments') }}
      </a>
    </MenuItem>
  </TextTooltip>
  <MenuItem
    v-else
    :class="switcherItemClass"
    data-testid="deployment-switcher-create"
    @select="emit('createCustomDeployment')"
  >
    <i
      class="icon-[lucide--plus] size-3.5 text-muted-foreground"
      aria-hidden="true"
    />
    {{ $t('deploymentSwitcher.createCustomDeployment') }}
  </MenuItem>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import MenuItem from '@comfyorg/design-system/menu/MenuItem'
import TextTooltip from '@comfyorg/design-system/tooltip/TextTooltip'
import { trackDeploymentLinkOpened } from '@/platform/workspace/platformFrame/customDeploymentTelemetry'
import {
  platformSurfaceLink,
  platformLinkRel
} from '@/platform/workspace/utils/platformLink'
import { switcherItemClass } from './deploymentSwitcherStyles'

const { hasDeployments } = defineProps<{ hasDeployments: boolean }>()
const emit = defineEmits<{ createCustomDeployment: [] }>()
const buildsUrl = computed(() =>
  platformSurfaceLink('/profile/builds', 'deployment-switcher')
)
</script>
