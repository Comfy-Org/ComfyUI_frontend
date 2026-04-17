<template>
  <div class="px-4 pb-2">
    <!-- Category groups (by directory) -->
    <div
      v-for="group in missingModelGroups"
      :key="`${group.isAssetSupported ? 'supported' : 'unsupported'}::${group.directory ?? '__unknown__'}`"
      class="flex w-full flex-col border-t border-interface-stroke py-2 first:border-t-0 first:pt-0"
    >
      <!-- Category header -->
      <div class="flex h-8 w-full items-center">
        <p
          class="min-w-0 flex-1 truncate text-sm font-medium"
          :class="
            (isCloud && !group.isAssetSupported) || group.directory === null
              ? 'text-warning-background'
              : 'text-destructive-background-hover'
          "
        >
          <span v-if="isCloud && !group.isAssetSupported">
            {{ t('rightSidePanel.missingModels.importNotSupported') }}
            ({{ group.models.length }})
          </span>
          <span v-else>
            <i
              v-if="group.directory === null"
              aria-hidden="true"
              class="mr-1 icon-[lucide--triangle-alert] size-3.5 align-text-bottom"
            />
            {{
              group.directory ??
              t('rightSidePanel.missingModels.unknownCategory')
            }}
            ({{ group.models.length }})
          </span>
        </p>
      </div>

      <!-- Asset unsupported group notice -->
      <div
        v-if="isCloud && !group.isAssetSupported"
        data-testid="missing-model-import-unsupported"
        class="flex items-start gap-1.5 px-0.5 py-1 pl-2"
      >
        <i
          aria-hidden="true"
          class="mt-0.5 icon-[lucide--info] size-3.5 shrink-0 text-muted-foreground"
        />
        <span class="text-xs/tight text-muted-foreground">
          {{ t('rightSidePanel.missingModels.customNodeDownloadDisabled') }}
        </span>
      </div>

      <!-- Model rows -->
      <div class="flex flex-col gap-1 overflow-hidden pl-2">
        <MissingModelRow
          v-for="model in group.models"
          :key="model.name"
          :model="model"
          :directory="group.directory"
          :show-node-id-badge="showNodeIdBadge"
          :is-asset-supported="group.isAssetSupported"
          @locate-model="emit('locateModel', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { MissingModelGroup } from '@/platform/missingModel/types'
import { isCloud } from '@/platform/distribution/types'
import MissingModelRow from '@/platform/missingModel/components/MissingModelRow.vue'

const { missingModelGroups, showNodeIdBadge } = defineProps<{
  missingModelGroups: MissingModelGroup[]
  showNodeIdBadge: boolean
}>()

const emit = defineEmits<{
  locateModel: [nodeId: string]
}>()

const { t } = useI18n()
</script>
