<!-- The deployment switcher's footer for a workspace owner (BE-17480): the
     workspace's default deployment, and the buttons that set it to this
     browser's pick or clear it. -->
<template>
  <div
    class="flex shrink-0 flex-col gap-1 border-t border-border-default px-4 py-2 text-xs text-muted-foreground"
    data-testid="deployment-switcher-owner"
  >
    <span>{{ summary }}</span>
    <div class="flex gap-3">
      <button
        v-if="canSetPicked"
        type="button"
        :class="linkClass"
        :disabled="disabled"
        data-testid="deployment-switcher-set-default"
        @click="emit('setDefault')"
      >
        {{ $t('deploymentSwitcher.setAsDefault') }}
      </button>
      <button
        v-if="defaultLabel !== null"
        type="button"
        :class="linkClass"
        :disabled="disabled"
        data-testid="deployment-switcher-clear-default"
        @click="emit('clearDefault')"
      >
        {{ $t('deploymentSwitcher.clearDefault') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { defaultLabel, canSetPicked, disabled } = defineProps<{
  /** The default deployment's label, or null when the workspace has none. */
  defaultLabel: string | null
  /** This browser picked a deployment that is not already the default. */
  canSetPicked: boolean
  disabled: boolean
}>()

const emit = defineEmits<{
  setDefault: []
  clearDefault: []
}>()

const { t } = useI18n()

const linkClass =
  'cursor-pointer appearance-none border-0 bg-transparent p-0 text-xs text-base-foreground underline disabled:cursor-wait'

const summary = computed(() =>
  defaultLabel === null
    ? t('deploymentSwitcher.noWorkspaceDefault')
    : t('deploymentSwitcher.workspaceDefaultIs', { deployment: defaultLabel })
)
</script>
