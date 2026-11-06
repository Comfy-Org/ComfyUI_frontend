<template>
  <DeploymentDialogFrame @dismiss="emit('dismiss')">
    <section class="flex flex-col gap-4 px-9 pt-9 pb-8">
      <h2
        :id="titleId"
        class="my-0 pr-8 text-2xl/8 font-bold tracking-tight text-foreground"
      >
        {{ $t('openOnCloud.missingModels.title', models.length) }}
      </h2>
      <p class="my-0 text-sm/5 text-muted-foreground">
        {{ $t('openOnCloud.missingModels.unavailable') }}
      </p>
      <ul class="my-0 flex list-none flex-col gap-1.5 p-0">
        <li
          v-for="model in models"
          :key="`${model.folder}/${model.name}`"
          class="flex items-center gap-2 rounded-lg bg-secondary px-2.5 py-2 text-xs"
        >
          <i
            class="icon-[lucide--package] text-muted-foreground"
            aria-hidden="true"
          />
          <span class="min-w-0 flex-1 break-all text-foreground">{{
            model.name
          }}</span>
          <span class="shrink-0 text-muted-foreground">{{ model.folder }}</span>
        </li>
      </ul>
      <footer class="flex justify-end pt-3">
        <Button variant="secondary" size="lg" @click="emit('dismiss')">
          {{ $t('g.close') }}
        </Button>
      </footer>
    </section>
  </DeploymentDialogFrame>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import type { CloudMissingModel } from '@/platform/openOnCloud/cloudWorkflowCheck'
import DeploymentDialogFrame from '@/platform/workspace/components/DeploymentDialogFrame.vue'

defineProps<{ titleId?: string; models: CloudMissingModel[] }>()

const emit = defineEmits<{ dismiss: [] }>()
</script>
