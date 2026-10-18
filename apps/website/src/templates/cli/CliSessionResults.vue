<script setup lang="ts">
defineProps<{ zh: boolean }>()
</script>
<template>
  <div
    class="absolute inset-0 flex flex-col items-center justify-center gap-6 p-6 sm:gap-8 sm:p-10"
  >
    <p class="font-mono text-sm text-primary-comfy-yellow">
      ✓ {{ zh ? '已保存 2 个文件' : '2 files saved' }}
    </p>
    <div class="grid w-full max-w-3xl grid-cols-2 gap-4 sm:gap-8">
      <figure
        v-for="output in [
          {
            src: 'cat.png',
            name: 'cat.png',
            alt: zh
              ? '月光下的猫咪，来自所提供的录屏'
              : 'Cat in moonlight, extracted from the supplied recording'
          },
          {
            src: 'lighthouse.png',
            name: 'f5308bc5_000.png',
            alt: zh
              ? '黄昏灯塔，来自所提供的录屏'
              : 'Lighthouse at dusk, extracted from the supplied recording'
          }
        ]"
        :key="output.src"
        class="min-w-0"
      >
        <img
          :src="`/images/cli/session/${output.src}`"
          :alt="output.alt"
          width="400"
          height="400"
          loading="eager"
          decoding="async"
          class="aspect-square w-full rounded-2xl object-cover sm:rounded-3xl"
        />
        <figcaption
          class="mt-4 text-center font-mono text-xs text-primary-comfy-canvas sm:text-sm"
        >
          {{ output.name }}
        </figcaption>
      </figure>
    </div>
  </div>
</template>
