<template>
  <div
    v-if="!deletedLocal"
    data-component-id="AssetCard"
    :data-asset-id="asset.id"
    :aria-labelledby="titleId"
    :aria-describedby="descId"
    :tabindex="interactive ? 0 : -1"
    :class="
      cn(
        'rounded-2xl overflow-hidden transition-all duration-200 bg-modal-card-background p-2 gap-2 flex flex-col h-full',
        interactive &&
          'group appearance-none bg-transparent m-0 outline-none text-left hover:bg-secondary-background focus:bg-secondary-background border-none focus:outline-solid outline-base-foreground outline-4'
      )
    "
    @keydown.enter.self="interactive && $emit('select', asset)"
  >
    <div class="relative aspect-square w-full overflow-hidden rounded-xl">
      <div
        v-if="isLoading || error"
        class="flex size-full cursor-pointer items-center justify-center bg-gradient-to-br from-smoke-400 via-smoke-800 to-charcoal-400"
        role="button"
        @click.self="interactive && $emit('select', asset)"
      />
      <img
        v-else
        :src="asset.preview_url"
        :alt="displayName"
        class="size-full object-cover cursor-pointer"
        role="button"
        @click.self="interactive && $emit('select', asset)"
      />

      <AssetBadgeGroup :badges="asset.badges" />
      <IconGroup
        v-if="
          (flags.assetDeletionEnabled || flags.assetRenameEnabled) &&
          !(asset.is_immutable ?? true)
        "
        :class="
          cn(
            'absolute top-2 right-2 invisible group-hover:visible',
            dropdownMenuButton?.isOpen && 'visible'
          )
        "
      >
        <MoreButton ref="dropdown-menu-button" size="sm">
          <template #default>
            <Button
              v-if="flags.assetRenameEnabled"
              variant="secondary"
              size="md"
              class="justify-start"
              @click="startAssetRename"
            >
              <i class="icon-[lucide--pencil]" />
              <span>{{ $t('g.rename') }}</span>
            </Button>
            <Button
              v-if="flags.assetDeletionEnabled"
              variant="secondary"
              size="md"
              class="justify-start"
              @click="confirmDeletion"
            >
              <i class="icon-[lucide--trash-2]" />
              <span>{{ $t('g.delete') }}</span>
            </Button>
          </template>
        </MoreButton>
      </IconGroup>
    </div>
    <div class="max-h-32 flex flex-col gap-2 justify-between flex-auto">
      <h3
        :id="titleId"
        v-tooltip.top="{ value: displayName, showDelay: tooltipDelay }"
        :class="
          cn(
            'mb-2 m-0 text-base font-semibold line-clamp-2 wrap-anywhere',
            'text-base-foreground'
          )
        "
      >
        <EditableText
          :model-value="displayName"
          :is-editing="isEditing"
          :input-attrs="{ 'data-testid': 'asset-name-input' }"
          @edit="assetRename"
          @cancel="assetRename()"
        />
      </h3>
      <p
        :id="descId"
        v-tooltip.top="{ value: asset.description, showDelay: tooltipDelay }"
        :class="
          cn(
            'm-0 text-sm leading-6 overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box] text-muted-foreground'
          )
        "
      >
        {{ asset.description }}
      </p>
      <div class="flex gap-4 text-xs text-muted-foreground mt-auto">
        <span v-if="asset.stats.stars" class="flex items-center gap-1">
          <i class="icon-[lucide--star] size-3" />
          {{ asset.stats.stars }}
        </span>
        <span v-if="asset.stats.downloadCount" class="flex items-center gap-1">
          <i class="icon-[lucide--download] size-3" />
          {{ asset.stats.downloadCount }}
        </span>
        <span v-if="asset.stats.formattedDate" class="flex items-center gap-1">
          <i class="icon-[lucide--clock] size-3" />
          {{ asset.stats.formattedDate }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useImage } from '@vueuse/core'
import { computed, ref, toValue, useId, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import IconGroup from '@/components/button/IconGroup.vue'
import MoreButton from '@/components/button/MoreButton.vue'
import EditableText from '@/components/common/EditableText.vue'
import { showConfirmDialog } from '@/components/dialog/confirm/confirmDialog'
import Button from '@/components/ui/button/Button.vue'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import AssetBadgeGroup from '@/platform/assets/components/AssetBadgeGroup.vue'
import type { AssetDisplayItem } from '@/platform/assets/composables/useAssetBrowser'
import { assetService } from '@/platform/assets/services/assetService'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useDialogStore } from '@/stores/dialogStore'
import { cn } from '@/utils/tailwindUtil'

const { asset, interactive } = defineProps<{
  asset: AssetDisplayItem
  interactive?: boolean
}>()

defineEmits<{
  select: [asset: AssetDisplayItem]
}>()

const { t } = useI18n()
const settingStore = useSettingStore()
const { closeDialog } = useDialogStore()
const { flags } = useFeatureFlags()
const toastStore = useToastStore()

const dropdownMenuButton = useTemplateRef<InstanceType<typeof MoreButton>>(
  'dropdown-menu-button'
)

const titleId = useId()
const descId = useId()

const isEditing = ref(false)
const newNameRef = ref<string>()
const deletedLocal = ref(false)

const displayName = computed(() => newNameRef.value ?? asset.name)

const tooltipDelay = computed<number>(() =>
  settingStore.get('LiteGraph.Node.TooltipDelay')
)

const { isLoading, error } = useImage({
  src: asset.preview_url ?? '',
  alt: asset.name
})

function confirmDeletion() {
  dropdownMenuButton.value?.hide()
  const assetName = toValue(displayName)
  const promptText = ref<string>(t('assetBrowser.deletion.body'))
  const optionsDisabled = ref(false)
  const confirmDialog = showConfirmDialog({
    headerProps: {
      title: t('assetBrowser.deletion.header')
    },
    props: {
      promptText
    },
    footerProps: {
      confirmText: t('g.delete'),
      // TODO: These need to be put into the new Button Variants once we have them.
      confirmClass: cn(
        'bg-danger-200 text-base-foreground hover:bg-danger-200/80 focus:bg-danger-200/80 focus:ring ring-base-foreground'
      ),
      optionsDisabled,
      onCancel: () => {
        closeDialog(confirmDialog)
      },
      onConfirm: async () => {
        optionsDisabled.value = true
        try {
          promptText.value = t('assetBrowser.deletion.inProgress', {
            assetName
          })
          await assetService.deleteAsset(asset.id)
          promptText.value = t('assetBrowser.deletion.complete', {
            assetName
          })
          // Give a second for the completion message
          await new Promise((resolve) => setTimeout(resolve, 1_000))
          deletedLocal.value = true
        } catch (err: unknown) {
          console.error(err)
          promptText.value = t('assetBrowser.deletion.failed', {
            assetName
          })
          // Give a second for the completion message
          await new Promise((resolve) => setTimeout(resolve, 3_000))
        } finally {
          closeDialog(confirmDialog)
        }
      }
    }
  })
}

function startAssetRename() {
  dropdownMenuButton.value?.hide()
  isEditing.value = true
}

async function assetRename(newName?: string) {
  isEditing.value = false
  if (newName) {
    // Optimistic update
    newNameRef.value = newName
    try {
      const result = await assetService.updateAsset(asset.id, {
        name: newName
      })
      // Update with the actual name once the server responds
      newNameRef.value = result.name
    } catch (err: unknown) {
      console.error(err)
      toastStore.add({
        severity: 'error',
        summary: t('assetBrowser.rename.failed'),
        life: 10_000
      })
      newNameRef.value = undefined
    }
  }
}
</script>
