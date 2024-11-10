<template>
  <div class="flex flex-col items-center justify-center gap-8 p-8">
    <!-- Header -->
    <h1 class="animated-gradient-text text-glow">Welcome to ComfyUI</h1>

    <!-- Get Started Button -->
    <Button
      label="Get Started"
      icon="pi pi-arrow-right"
      iconPos="right"
      size="large"
      rounded
      @click="$emit('start')"
      class="p-4 text-lg fade-in-up"
    />
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
defineEmits(['start'])
</script>

<style scoped>
.animated-gradient-text {
  @apply font-bold text-[clamp(2rem,8vw,4rem)];
  background: linear-gradient(to right, #12c2e9, #c471ed, #f64f59, #12c2e9);
  background-size: 300% auto;
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: gradient 8s linear infinite;
}

.text-glow {
  filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.3));
}

@keyframes gradient {
  0% {
    background-position: 0% center;
  }
  100% {
    background-position: 300% center;
  }
}

.fade-in-up {
  animation: fadeInUp 1.5s ease-out;
  animation-fill-mode: both;
}

@keyframes fadeInUp {
  0% {
    opacity: 0;
    transform: translateY(20px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
