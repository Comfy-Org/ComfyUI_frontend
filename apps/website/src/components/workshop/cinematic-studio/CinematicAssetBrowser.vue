<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import type { SavedAsset } from '../../../lib/workshop/cinematic-studio/assets'
import { tcAssets } from '../../../lib/workshop/cinematic-studio/assets-copy'
import type { AssetCopyKey } from '../../../lib/workshop/cinematic-studio/assets-copy'
import Button from '../../ui/button/Button.vue'
const { matches, urls, busy, locale, fieldClass } = defineProps<{
  matches: readonly SavedAsset[]
  urls: Readonly<Record<string, string>>
  busy: boolean
  locale: Locale
  fieldClass: string
}>()
const pendingDelete = defineModel<string>('pendingDelete', { required: true })
const search = defineModel<string>('search', { required: true })
const emit = defineEmits<{
  use: [SavedAsset]
  edit: [SavedAsset]
  remove: [string]
}>()
const t = (key: AssetCopyKey) => tcAssets(key, locale)
</script>
<template>
  <label class="flex flex-col gap-2 text-sm"
    >{{ t('search') }}<input v-model="search" type="search" :class="fieldClass"
  /></label>
  <p v-if="!matches.length && !busy" class="text-sm text-primary-comfy-canvas">
    {{ t('empty') }}
  </p>
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <article
      v-for="asset in matches"
      :key="asset.id"
      class="flex min-w-0 flex-col gap-2 rounded-xl border border-transparency-white-t20 p-3 text-primary-warm-white"
    >
      <img
        :src="urls[asset.id]"
        :alt="asset.name"
        class="aspect-square w-full rounded-lg object-contain"
      />
      <h3 class="font-semibold wrap-break-word">{{ asset.name }}</h3>
      <p class="text-xs">{{ t(asset.kind) }}</p>
      <p
        class="text-sm wrap-break-word whitespace-pre-wrap text-primary-comfy-canvas"
      >
        {{ asset.notes }}
      </p>
      <Button
        variant="outline"
        size="sm"
        :disabled="busy"
        @click="emit('use', asset)"
        >{{ t('use') }}</Button
      ><Button
        variant="outline"
        size="sm"
        :disabled="busy"
        @click="emit('edit', asset)"
        >{{ t('edit') }}</Button
      >
      <template v-if="pendingDelete === asset.id"
        ><p class="text-xs">{{ t('confirmDelete') }}</p>
        <Button
          variant="outline"
          size="sm"
          :disabled="busy"
          @click="emit('remove', asset.id)"
          >{{ t('deleteNow') }}</Button
        ><Button
          variant="outline"
          size="sm"
          :disabled="busy"
          @click="pendingDelete = ''"
          >{{ t('cancel') }}</Button
        ></template
      >
      <Button
        v-else
        variant="outline"
        size="sm"
        :disabled="busy"
        @click="pendingDelete = asset.id"
        >{{ t('remove') }}</Button
      >
    </article>
  </div>
</template>
