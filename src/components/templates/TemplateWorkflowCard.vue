<template>
  <Card :data-testid="`template-workflow-${props.workflowName}`">
    <template #header>
      <div class="flex items-center justify-center">
        <div
          class="relative overflow-hidden rounded-t-lg cursor-pointer w-64 h-64"
        >
          <img
            v-if="!imageError"
            :src="
              props.moduleName === 'default'
                ? `templates/${props.workflowName}.jpg`
                : `api/workflow_templates/${props.moduleName}/${props.workflowName}.jpg`
            "
            @error="imageError = true"
            class="w-64 h-64 rounded-t-lg object-cover thumbnail"
          />
          <div v-else class="w-64 h-64 content-center text-center">
            <i class="pi pi-file" style="font-size: 4rem"></i>
          </div>
          <a>
            <div
              class="absolute top-0 left-0 w-64 h-64 overflow-hidden opacity-0 transition duration-300 ease-in-out hover:opacity-100 bg-opacity-50 bg-black flex items-center justify-center"
            >
              <i class="pi pi-play-circle" style="color: white"></i>
            </div>
          </a>
          <ProgressSpinner
            v-if="loading"
            class="absolute inset-0 z-1 w-3/12 h-full"
          />
        </div>
      </div>
    </template>
    <template #subtitle>
      <!--Default templates have translations-->
      <template v-if="props.moduleName === 'default'">
        {{
          $t(
            `templateWorkflows.template.${props.workflowName}`,
            props.workflowName
          )
        }}
      </template>
      <template v-else>
        {{ props.workflowName }}
      </template>
    </template>
  </Card>
</template>

<script setup lang="ts">
import Card from 'primevue/card'
import ProgressSpinner from 'primevue/progressspinner'
import { ref } from 'vue'

const props = defineProps<{
  moduleName: string
  workflowName: string
  loading: boolean
}>()

const imageError = ref(false)
</script>

<style lang="css" scoped>
.p-card {
  --p-card-body-padding: 10px 0 0 0;
  overflow: hidden;
}

:deep(.p-card-subtitle) {
  text-align: center;
}
</style>
