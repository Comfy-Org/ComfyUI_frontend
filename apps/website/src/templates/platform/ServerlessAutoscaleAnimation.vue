<template>
  <svg viewBox="0 0 760 420" class="autoscale-art size-full">
    <g transform="translate(380 210) scale(0.68) translate(-380 -210)">
      <path
        class="ring-echo ring-echo--outer"
        d="M427.6,-62.5 Q380.0,-90.0 332.4,-62.5 L167.8,32.5 Q120.2,60.0 120.2,115.0 L120.2,305.0 Q120.2,360.0 167.8,387.5 L332.4,482.5 Q380.0,510.0 427.6,482.5 L592.2,387.5 Q639.8,360.0 639.8,305.0 L639.8,115.0 Q639.8,60.0 592.2,32.5 Z"
        fill="none"
        stroke="#5d4fa3"
        stroke-width="1.6"
        opacity="0.75"
      />
      <path
        class="ring-echo ring-echo--middle"
        d="M416.4,16.0 Q380.0,-5.0 343.6,16.0 L230.2,81.5 Q193.8,102.5 193.8,144.5 L193.8,275.5 Q193.8,317.5 230.2,338.5 L343.6,404.0 Q380.0,425.0 416.4,404.0 L529.8,338.5 Q566.2,317.5 566.2,275.5 L566.2,144.5 Q566.2,102.5 529.8,81.5 Z"
        fill="none"
        stroke="#5d4fa3"
        stroke-width="1.4"
        opacity="0.6"
      />

      <path
        class="ring-echo ring-echo--inner"
        d="M406.0,85.0 Q380.0,70.0 354.0,85.0 L284.7,125.0 Q258.8,140.0 258.8,170.0 L258.8,250.0 Q258.8,280.0 284.7,295.0 L354.0,335.0 Q380.0,350.0 406.0,335.0 L475.3,295.0 Q501.2,280.0 501.2,250.0 L501.2,170.0 Q501.2,140.0 475.3,125.0 Z"
        fill="none"
        stroke="var(--color-primary-comfy-yellow)"
        stroke-width="1.6"
      />

      <path
        class="core"
        d="M392.1,159.0 Q380.0,152.0 367.9,159.0 L341.9,174.0 Q329.8,181.0 329.8,195.0 L329.8,225.0 Q329.8,239.0 341.9,246.0 L367.9,261.0 Q380.0,268.0 392.1,261.0 L418.1,246.0 Q430.2,239.0 430.2,225.0 L430.2,195.0 Q430.2,181.0 418.1,174.0 Z"
        fill="var(--color-primary-comfy-yellow)"
      />
    </g>
  </svg>
</template>

<style scoped>
.ring-echo {
  transform-box: fill-box;
  transform-origin: center;
  animation: autoscale-ringecho 3s cubic-bezier(0.4, 0, 0.2, 1) infinite both;
}

.ring-echo--middle {
  animation-delay: 1s;
}

.ring-echo--outer {
  animation-delay: 2s;
}

@keyframes autoscale-ringecho {
  0% {
    transform: scale(0.88);
    opacity: 0;
  }
  18% {
    opacity: 1;
  }
  72% {
    transform: scale(1);
    opacity: 0.7;
  }
  100% {
    transform: scale(1.08);
    opacity: 0;
  }
}

.core {
  transform-box: fill-box;
  transform-origin: center;
  animation: autoscale-corebeat 7s ease-in-out infinite;
}
@keyframes autoscale-corebeat {
  0%,
  100% {
    transform: scale(0.94);
  }
  30%,
  62% {
    transform: scale(1.06);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ring-echo,
  .core {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
</style>
