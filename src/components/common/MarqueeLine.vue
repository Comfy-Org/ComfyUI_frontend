<template>
  <div
    class="@container overflow-hidden mask-[linear-gradient(to_right,black_70%,transparent)] motion-safe:group-hover:mask-none"
  >
    <span
      class="inline-block min-w-full text-center whitespace-nowrap [--_marquee-end:min(calc(-100%+100cqw),0px)] motion-safe:group-hover:animate-[marquee-scroll_3s_linear_infinite_alternate]"
    >
      <slot />
    </span>
  </div>
</template>

<style>
@keyframes marquee-scroll {
  0%,
  20% {
    transform: translateX(0);
  }
  80%,
  100% {
    transform: translateX(var(--_marquee-end));
  }
}
</style>
