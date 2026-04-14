<template>
  <div
    class="rounded-5xl relative flex items-center justify-center overflow-hidden p-0.5 [clip-path:inset(0_round_var(--radius-5xl))]"
  >
    <div
      class="animate-border-spin absolute inset-0"
      style="
        background: conic-gradient(
          from var(--border-angle),
          color-mix(in srgb, var(--color-primary-comfy-yellow) 4%, transparent)
            0%,
          var(--color-primary-comfy-yellow) 100%
        );
      "
    />
    <div
      class="bg-primary-comfy-ink relative size-full rounded-[calc(2.5rem-2px)] px-16 py-26"
    >
      <div
        class="bg-transparency-white-t4 absolute inset-0 m-2 flex items-center justify-center rounded-4xl"
      >
        <span class="text-primary-warm-gray text-sm">FPO</span>
      </div>
    </div>
  </div>
</template>
