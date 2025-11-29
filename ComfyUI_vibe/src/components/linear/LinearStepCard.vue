<script setup lang="ts">
import { computed } from 'vue'
import type { LinearStep } from '@/types/linear'

interface Props {
  step: LinearStep
  stepIndex: number
  isActive: boolean
  isCompleted: boolean
  isExecuting: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [stepId: string]
}>()

const statusIcon = computed(() => {
  if (props.step.state === 'completed') return 'pi-check'
  if (props.step.state === 'executing') return 'pi-spin pi-spinner'
  if (props.step.state === 'error') return 'pi-exclamation-triangle'
  return props.step.icon ?? 'pi-circle'
})

const statusClass = computed(() => {
  if (props.step.state === 'completed') return 'status-completed'
  if (props.step.state === 'executing') return 'status-executing'
  if (props.step.state === 'error') return 'status-error'
  if (props.isActive) return 'status-active'
  return 'status-idle'
})
</script>

<template>
  <button
    :class="['step-card', statusClass, { active: isActive }]"
    @click="emit('select', step.id)"
  >
    <!-- Step number / status indicator -->
    <div class="step-indicator">
      <div class="indicator-circle">
        <i :class="['pi', statusIcon]" />
      </div>
      <div v-if="stepIndex < 4" class="connector-line" />
    </div>

    <!-- Content -->
    <div class="step-content">
      <div class="step-header">
        <span class="step-number">Step {{ stepIndex + 1 }}</span>
        <span v-if="step.state === 'executing'" class="progress-text">
          {{ step.progress ?? 0 }}%
        </span>
      </div>
      <h3 class="step-title">{{ step.displayName }}</h3>
      <p v-if="step.description" class="step-description">
        {{ step.description }}
      </p>

      <!-- Progress bar -->
      <div v-if="step.state === 'executing'" class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: `${step.progress ?? 0}%` }"
        />
      </div>
    </div>

    <!-- Expand arrow -->
    <i v-if="isActive" class="pi pi-chevron-right expand-icon" />
  </button>
</template>

<style scoped>
.step-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  width: 100%;
  position: relative;
}

.step-card:hover {
  background: #1f1f23;
  border-color: #3f3f46;
}

.step-card.active {
  background: #1e293b;
  border-color: #3b82f6;
}

.step-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}

.indicator-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #27272a;
  border: 2px solid #3f3f46;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #71717a;
  font-size: 14px;
  transition: all 0.2s;
}

.connector-line {
  width: 2px;
  height: 24px;
  background: #27272a;
  margin-top: 4px;
}

/* Status variants */
.status-completed .indicator-circle {
  background: #22c55e;
  border-color: #22c55e;
  color: white;
}

.status-completed .connector-line {
  background: #22c55e;
}

.status-executing .indicator-circle {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.status-executing .connector-line {
  background: linear-gradient(to bottom, #3b82f6, #27272a);
}

.status-error .indicator-circle {
  background: #ef4444;
  border-color: #ef4444;
  color: white;
}

.status-active .indicator-circle {
  border-color: #3b82f6;
  color: #3b82f6;
}

.step-content {
  flex: 1;
  min-width: 0;
}

.step-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.step-number {
  font-size: 11px;
  color: #71717a;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.progress-text {
  font-size: 11px;
  color: #3b82f6;
  font-weight: 600;
}

.step-title {
  font-size: 15px;
  font-weight: 600;
  color: #fafafa;
  margin: 0 0 4px;
}

.step-description {
  font-size: 12px;
  color: #71717a;
  margin: 0;
  line-height: 1.4;
}

.progress-bar {
  height: 3px;
  background: #27272a;
  border-radius: 2px;
  margin-top: 10px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.expand-icon {
  color: #3b82f6;
  font-size: 12px;
  margin-left: auto;
  align-self: center;
}
</style>
