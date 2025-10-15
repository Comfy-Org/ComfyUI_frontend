<template>
  <div
    class="job-row"
    :class="[variantClass]"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <div class="job-row-left">
      <div
        class="job-row-actions"
        :class="{ visible: isHovered && showActionsOnHover }"
      >
        <button
          v-if="showClear"
          class="icon-btn"
          :aria-label="'Clear'"
          @click.stop="emit('clear')"
        >
          <i class="icon-[lucide--x] size-4" />
        </button>
        <button
          v-if="showMenu"
          class="icon-btn"
          :aria-label="'More options'"
          @click.stop="emit('menu')"
        >
          <i class="icon-[lucide--more-horizontal] size-4" />
        </button>
      </div>
      <div class="job-row-icon">
        <slot name="icon">
          <i v-if="iconName" :class="[iconName, 'size-4']" />
          <div v-else class="default-icon" />
        </slot>
      </div>
    </div>

    <div class="job-row-center">
      <div class="job-row-primary" :title="primaryText">
        <slot name="primary">{{ primaryText }}</slot>
      </div>
    </div>

    <div class="job-row-right">
      <div class="job-row-secondary">
        <slot name="secondary">{{ secondaryText }}</slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    primaryText?: string
    secondaryText?: string
    iconName?: string
    variant?:
      | 'added'
      | 'queued'
      | 'loading'
      | 'running'
      | 'completed'
      | 'failed'
    showActionsOnHover?: boolean
    showClear?: boolean
    showMenu?: boolean
  }>(),
  {
    primaryText: '',
    secondaryText: '',
    iconName: undefined,
    variant: 'queued',
    showActionsOnHover: true,
    showClear: true,
    showMenu: true
  }
)

const emit = defineEmits<{
  (e: 'clear'): void
  (e: 'menu'): void
}>()

const isHovered = ref(false)

const variantClass = computed(() => `variant-${props.variant}`)
</script>

<style scoped>
.job-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-spacing-xs);
  padding: var(--spacing-spacing-xxs);
  border-radius: var(--corner-radius-corner-radius-md);
  border: 1px solid var(--color-charcoal-400);
  background: var(--color-charcoal-600);
  color: white;
  font-size: 12px;
}

.job-row-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-spacing-xs);
  position: relative;
}

.job-row-actions {
  position: absolute;
  left: -4px;
  display: none;
  align-items: center;
  gap: var(--spacing-spacing-xss);
}

.job-row-actions.visible {
  display: inline-flex;
}

.icon-btn {
  width: 24px;
  height: 24px;
  border: 0;
  padding: 0;
  background: var(--color-charcoal-500);
  color: white;
  border-radius: 6px;
}

.icon-btn:hover {
  background: var(--color-charcoal-600);
  opacity: 0.9;
}

.job-row-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: var(--color-charcoal-500);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.default-icon {
  width: 100%;
  height: 100%;
}

.job-row-center {
  min-width: 0;
  flex: 1 1 auto;
}

.job-row-primary {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.9;
}

.job-row-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-spacing-xs);
  color: var(--color-slate-100);
}

.job-row-secondary {
  padding-right: var(--spacing-spacing-xs);
}

/* Variants can adjust border or icon backgrounds if needed */
.variant-running .job-row-icon {
  background: var(--color-charcoal-500);
}
.variant-queued .job-row-icon {
  background: var(--color-charcoal-500);
}
.variant-loading .job-row-icon {
  background: var(--color-charcoal-500);
}
.variant-completed .job-row-icon {
  background: var(--color-charcoal-500);
}
.variant-failed .job-row-icon {
  background: var(--color-charcoal-500);
}
.variant-added .job-row-icon {
  background: var(--color-charcoal-500);
}
</style>
