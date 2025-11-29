<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLinearModeStore } from '@/stores/linearModeStore'
import LinearStepCard from './LinearStepCard.vue'
import LinearParameterPanel from './LinearParameterPanel.vue'
import LinearOutputGallery from './LinearOutputGallery.vue'
import type { LinearOutput } from '@/types/linear'

const store = useLinearModeStore()

const activeStepId = ref<string | null>(null)

const activeStep = computed(() => {
  if (!activeStepId.value) return store.currentSteps[0] ?? null
  return store.currentSteps.find((s) => s.id === activeStepId.value) ?? null
})

const workflowName = computed(() => store.currentWorkflow?.templateName ?? '')

function selectStep(stepId: string): void {
  activeStepId.value = stepId
}

function updateStepWidget(widgetName: string, value: unknown): void {
  if (activeStep.value) {
    store.updateStepWidget(activeStep.value.id, widgetName, value)
  }
}

function handleGenerate(): void {
  store.startGeneration()
}

function handleCancel(): void {
  store.cancelGeneration()
}

function handleReset(): void {
  store.resetWorkflow()
}

function handleBack(): void {
  store.showTemplates()
}

function handleDeleteOutput(outputId: string): void {
  store.deleteOutput(outputId)
}

function handleDownloadOutput(output: LinearOutput): void {
  // Create a download link
  const link = document.createElement('a')
  link.href = output.url
  link.download = output.filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Generate random seed
function randomizeSeed(): void {
  if (activeStep.value && activeStep.value.exposedWidgets.includes('seed')) {
    const randomSeed = Math.floor(Math.random() * 2147483647)
    store.updateStepWidget(activeStep.value.id, 'seed', randomSeed)
  }
}
</script>

<template>
  <div class="linear-workspace">
    <!-- Top bar -->
    <header class="workspace-header">
      <div class="header-left">
        <button class="back-btn" @click="handleBack">
          <i class="pi pi-arrow-left" />
        </button>
        <div class="workflow-info">
          <h1 class="workflow-name">{{ workflowName }}</h1>
          <span v-if="store.isGenerating" class="status-badge generating">
            <i class="pi pi-spin pi-spinner" />
            Generating...
          </span>
          <span v-else-if="store.currentWorkflow?.executionState === 'completed'" class="status-badge completed">
            <i class="pi pi-check" />
            Completed
          </span>
        </div>
      </div>

      <div class="header-right">
        <button
          v-if="!store.isGenerating"
          class="action-btn secondary"
          @click="handleReset"
        >
          <i class="pi pi-refresh" />
          Reset
        </button>

        <button
          v-if="store.isGenerating"
          class="action-btn danger"
          @click="handleCancel"
        >
          <i class="pi pi-times" />
          Cancel
        </button>

        <button
          v-else
          class="action-btn primary"
          :disabled="!store.canGenerate"
          @click="handleGenerate"
        >
          <i class="pi pi-play" />
          Generate
        </button>
      </div>
    </header>

    <!-- Main content area -->
    <div class="workspace-content">
      <!-- Left column: Steps -->
      <aside class="steps-panel">
        <div class="panel-header">
          <h2 class="panel-title">Workflow Steps</h2>
          <span class="step-count">{{ store.currentSteps.length }} steps</span>
        </div>

        <div class="steps-list">
          <LinearStepCard
            v-for="(step, index) in store.currentSteps"
            :key="step.id"
            :step="step"
            :step-index="index"
            :is-active="activeStep?.id === step.id"
            :is-completed="step.state === 'completed'"
            :is-executing="step.state === 'executing'"
            @select="selectStep"
          />
        </div>

        <!-- Overall progress -->
        <div v-if="store.isGenerating" class="overall-progress">
          <div class="progress-header">
            <span class="progress-label">Overall Progress</span>
            <span class="progress-value">{{ Math.round(store.executionProgress) }}%</span>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: `${store.executionProgress}%` }"
            />
          </div>
        </div>
      </aside>

      <!-- Center: Parameters -->
      <main class="parameters-panel">
        <div v-if="activeStep" class="parameters-content">
          <!-- Quick actions for this step -->
          <div v-if="activeStep.exposedWidgets.includes('seed')" class="quick-actions">
            <button class="quick-btn" @click="randomizeSeed">
              <i class="pi pi-sync" />
              Random Seed
            </button>
          </div>

          <LinearParameterPanel
            :step="activeStep"
            @update:widget="updateStepWidget"
          />
        </div>

        <div v-else class="empty-parameters">
          <i class="pi pi-arrow-left text-4xl text-zinc-700" />
          <p>Select a step to configure its parameters</p>
        </div>
      </main>

      <!-- Right: Output gallery -->
      <aside class="output-panel">
        <LinearOutputGallery
          :outputs="store.outputs"
          @delete="handleDeleteOutput"
          @download="handleDownloadOutput"
        />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.linear-workspace {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #09090b;
}

/* Header */
.workspace-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: #18181b;
  border-bottom: 1px solid #27272a;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: #27272a;
  border: 1px solid #3f3f46;
  color: #a1a1aa;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.back-btn:hover {
  background: #3f3f46;
  color: #fafafa;
}

.workflow-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.workflow-name {
  font-size: 18px;
  font-weight: 600;
  color: #fafafa;
  margin: 0;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.generating {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}

.status-badge.completed {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.action-btn.primary {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: white;
}

.action-btn.primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.action-btn.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.secondary {
  background: #27272a;
  color: #a1a1aa;
  border: 1px solid #3f3f46;
}

.action-btn.secondary:hover {
  background: #3f3f46;
  color: #fafafa;
}

.action-btn.danger {
  background: #7f1d1d;
  color: #fca5a5;
}

.action-btn.danger:hover {
  background: #991b1b;
}

/* Content area */
.workspace-content {
  flex: 1;
  display: grid;
  grid-template-columns: 320px 1fr 360px;
  gap: 1px;
  background: #27272a;
  overflow: hidden;
}

/* Steps panel */
.steps-panel {
  background: #09090b;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #1f1f23;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #fafafa;
  margin: 0;
}

.step-count {
  font-size: 12px;
  color: #71717a;
}

.steps-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.overall-progress {
  padding: 16px;
  border-top: 1px solid #1f1f23;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.progress-label {
  font-size: 12px;
  color: #71717a;
}

.progress-value {
  font-size: 12px;
  font-weight: 600;
  color: #3b82f6;
}

.progress-bar {
  height: 4px;
  background: #27272a;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  border-radius: 2px;
  transition: width 0.3s ease;
}

/* Parameters panel */
.parameters-panel {
  background: #09090b;
  overflow-y: auto;
  padding: 24px;
}

.parameters-content {
  max-width: 600px;
  margin: 0 auto;
}

.quick-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.quick-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: #27272a;
  border: 1px solid #3f3f46;
  border-radius: 6px;
  color: #a1a1aa;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.quick-btn:hover {
  background: #3f3f46;
  color: #fafafa;
}

.empty-parameters {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  height: 100%;
  color: #52525b;
  font-size: 14px;
}

/* Output panel */
.output-panel {
  background: #09090b;
  overflow-y: auto;
  padding: 16px;
}
</style>
