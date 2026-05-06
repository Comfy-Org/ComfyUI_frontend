<script setup lang="ts">
// Animated illustration of drag-to-reorder: bottom block lifts beside
// the middle block (1-col → 2-col) and back. Decoration only.
</script>

<template>
  <svg
    class="drag-demo mx-auto w-3/4 max-w-sm text-warning-background"
    viewBox="0 0 240 144"
    aria-hidden="true"
  >
    <rect class="frame" x="4" y="4" width="232" height="136" rx="10" />
    <line class="frame" x1="4" y1="28" x2="236" y2="28" />
    <path class="frame" d="M14 15 L18 19 L22 15" />
    <circle class="frame-dot" cx="210" cy="16" r="1.5" />
    <circle class="frame-dot" cx="217" cy="16" r="1.5" />
    <circle class="frame-dot" cx="224" cy="16" r="1.5" />
    <rect x="16" y="40" width="208" height="24" rx="6" />
    <rect class="shrinks" x="16" y="72" width="208" height="24" rx="6" />
    <rect class="mover shrinks" x="16" y="104" width="208" height="24" rx="6" />
    <path class="cursor" d="M0 0 L0 16 L4 13 L7 19 L9 18 L6 12 L11 11 Z" />
  </svg>
</template>

<style scoped>
.drag-demo {
  --demo-ease: cubic-bezier(0.83, 0, 0.17, 1);
  --demo-duration: 4s;
}
.drag-demo rect,
.drag-demo .frame-dot {
  fill: currentColor;
}
.drag-demo .frame {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.drag-demo .shrinks {
  animation: drag-shrink var(--demo-duration) var(--demo-ease) infinite;
}
.drag-demo .mover {
  animation:
    drag-translate var(--demo-duration) var(--demo-ease) infinite,
    drag-shrink var(--demo-duration) var(--demo-ease) infinite;
}
.drag-demo .cursor {
  fill: currentColor;
  stroke: var(--color-layout-canvas);
  /* paint-order stroke-under-fill leaves only the outer 1.5px stroke
     visible, matching the frame outline. */
  stroke-width: 3;
  stroke-linejoin: round;
  stroke-linecap: round;
  paint-order: stroke;
  animation: drag-cursor var(--demo-duration) var(--demo-ease) infinite;
}

@keyframes drag-shrink {
  0%,
  20%,
  80%,
  100% {
    width: 208px;
  }
  40%,
  60% {
    width: 100px;
  }
}
@keyframes drag-translate {
  0%,
  20%,
  80%,
  100% {
    transform: translate(0, 0);
  }
  40%,
  60% {
    transform: translate(108px, -32px);
  }
}
@keyframes drag-cursor {
  0%,
  20%,
  80%,
  100% {
    transform: translate(120px, 116px);
  }
  40%,
  60% {
    transform: translate(174px, 84px);
  }
}
</style>
