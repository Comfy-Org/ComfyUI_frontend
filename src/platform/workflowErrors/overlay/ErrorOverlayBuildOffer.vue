<template>
  <Button
    variant="secondary"
    size="sm"
    data-testid="error-overlay-custom-build"
    :title="
      offer.kind === 'switch'
        ? t(
            'errorOverlay.switchBuildTo',
            { build: offer.buildName },
            { escapeParameter: false }
          )
        : undefined
    "
    @click="emit('open')"
  >
    {{
      offer.kind === 'switch'
        ? t('errorOverlay.switchBuild')
        : t('errorOverlay.createCustomBuild')
    }}
  </Button>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import type { IssuesToastBuildOffer } from '@/platform/workspace/composables/useIssuesToastBuildOffer'

const { offer } = defineProps<{ offer: IssuesToastBuildOffer }>()

const emit = defineEmits<{ open: [] }>()

const { t } = useI18n()
</script>
