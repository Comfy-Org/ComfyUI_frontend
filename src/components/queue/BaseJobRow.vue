<template>
  <div
    class="job-row"
    :class="[variantClass]"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <div class="job-row-left">
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
      <Transition name="job-actions" mode="out-in">
        <div
          v-if="isHovered && showActionsOnHover"
          key="actions"
          class="job-row-actions-inline"
        >
          <button
            v-if="variant !== 'completed' && showClear"
            type="button"
            class="row-action-btn"
            :aria-label="'Clear'"
            @click.stop="emit('clear')"
          >
            <i class="icon-[lucide--x] size-4" />
          </button>
          <button
            v-else-if="variant === 'completed'"
            type="button"
            class="row-action-btn row-action-btn-view"
            :aria-label="'View'"
            @click.stop="emit('view')"
          >
            <span>{{ t('View') }}</span>
          </button>
          <button
            v-if="showMenu"
            type="button"
            class="row-action-btn"
            :aria-label="'More options'"
            @click.stop="emit('menu')"
          >
            <i class="icon-[lucide--more-horizontal] size-4" />
          </button>
        </div>
        <div v-else key="secondary" class="job-row-secondary">
          <slot name="secondary">{{ secondaryText }}</slot>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

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
  (e: 'view'): void
}>()

const isHovered = ref(false)

const variantClass = computed(() => `variant-${props.variant}`)

const { t } = useI18n()
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
  transition:
    background-color 150ms ease,
    border-color 150ms ease,
    box-shadow 150ms ease;
}

.job-row-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-spacing-xxs);
  position: relative;
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

.job-row:hover {
  background: var(--color-charcoal-500);
  border-color: var(--color-charcoal-300);
}

.job-row-secondary {
  padding-right: var(--spacing-spacing-xs);
}

.job-row-actions-inline {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-spacing-xs);
  padding-right: calc(var(--spacing-spacing-xs) - var(--spacing-spacing-xxs));
}

.row-action-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-spacing-xss);
  height: 24px;
  padding: 0 var(--spacing-spacing-xxs);
  border: 0;
  background: var(--color-charcoal-300);
  color: white;
  border-radius: var(--corner-radius-corner-radius-sm, 4px);
  transition:
    background-color 150ms ease,
    opacity 150ms ease,
    transform 150ms ease;
}

.row-action-btn:hover {
  opacity: 0.98;
  transform: translateY(-1px);
}

.row-action-btn-view {
  padding: 0 var(--spacing-spacing-xs);
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
.job-actions-enter-active, .job-actions-leave-active { transition: opacity 150ms
ease, transform 150ms ease; } .job-actions-enter-from, .job-actions-leave-to {
opacity: 0; transform: translateY(2px); }
