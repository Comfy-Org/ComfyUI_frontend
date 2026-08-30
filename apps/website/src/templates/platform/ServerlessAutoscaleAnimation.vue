<template>
  <svg viewBox="0 0 760 420" class="autoscale-art size-full">
    <defs>
      <radialGradient id="autoscale-core-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="#EFF75A" stop-opacity="0.34" />
        <stop offset="0.5" stop-color="#EFF75A" stop-opacity="0.10" />
        <stop offset="1" stop-color="#EFF75A" stop-opacity="0" />
      </radialGradient>
    </defs>

    <g transform="translate(380 210) scale(0.68) translate(-380 -210)">
      <line
        x1="0"
        y1="210"
        x2="760"
        y2="210"
        stroke="#5d4fa3"
        stroke-width="1.5"
        opacity="0.55"
      />

      <path
        d="M427.6,-62.5 Q380.0,-90.0 332.4,-62.5 L167.8,32.5 Q120.2,60.0 120.2,115.0 L120.2,305.0 Q120.2,360.0 167.8,387.5 L332.4,482.5 Q380.0,510.0 427.6,482.5 L592.2,387.5 Q639.8,360.0 639.8,305.0 L639.8,115.0 Q639.8,60.0 592.2,32.5 Z"
        fill="none"
        stroke="#5d4fa3"
        stroke-width="1.6"
        opacity="0.75"
      />
      <path
        d="M416.4,16.0 Q380.0,-5.0 343.6,16.0 L230.2,81.5 Q193.8,102.5 193.8,144.5 L193.8,275.5 Q193.8,317.5 230.2,338.5 L343.6,404.0 Q380.0,425.0 416.4,404.0 L529.8,338.5 Q566.2,317.5 566.2,275.5 L566.2,144.5 Q566.2,102.5 529.8,81.5 Z"
        fill="none"
        stroke="#5d4fa3"
        stroke-width="1.4"
        opacity="0.6"
      />

      <circle
        class="glow"
        cx="380"
        cy="210"
        r="185"
        fill="url(#autoscale-core-glow)"
      />

      <path
        class="ring-lime"
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

      <g fill="var(--color-primary-comfy-yellow)">
        <path
          class="sat sat--2"
          transform="translate(530,292)"
          d="M6.1,-22.5 Q0.0,-26.0 -6.1,-22.5 L-16.5,-16.5 Q-22.5,-13.0 -22.5,-6.0 L-22.5,6.0 Q-22.5,13.0 -16.5,16.5 L-6.1,22.5 Q-0.0,26.0 6.1,22.5 L16.5,16.5 Q22.5,13.0 22.5,6.0 L22.5,-6.0 Q22.5,-13.0 16.5,-16.5 Z"
        />
      </g>
    </g>
  </svg>
</template>

<style scoped>
.glow {
  animation: autoscale-load 7s ease-in-out infinite;
}
@keyframes autoscale-load {
  0%,
  100% {
    opacity: 0.3;
  }
  30%,
  62% {
    opacity: 1;
  }
}

.ring-lime {
  transform-box: fill-box;
  transform-origin: center;
  animation: autoscale-ringload 7s ease-in-out infinite;
}
@keyframes autoscale-ringload {
  0%,
  100% {
    transform: scale(0.9);
    opacity: 0.5;
  }
  30%,
  62% {
    transform: scale(1);
    opacity: 1;
  }
}

.sat {
  transform-box: fill-box;
  transform-origin: center;
  opacity: 0;
  animation: autoscale-pop 7s cubic-bezier(0.5, 1.4, 0.5, 1) infinite;
}
.sat--2 {
  animation-delay: 0.6s;
}
@keyframes autoscale-pop {
  0% {
    opacity: 0;
    transform: scale(0);
  }
  7% {
    opacity: 1;
    transform: scale(1.3);
  }
  12%,
  58% {
    opacity: 1;
    transform: scale(1);
  }
  70%,
  100% {
    opacity: 0;
    transform: scale(0);
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
  .glow,
  .ring-lime,
  .sat,
  .core {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
</style>
