<script setup lang="ts">
import { useDocumentVisibility, useElementVisibility } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'

const root = useTemplateRef<HTMLElement>('root')
const onScreen = useElementVisibility(root)
const documentVisibility = useDocumentVisibility()

// None of the nine animations below can be promoted to a compositor layer:
// five animate stroke-dashoffset and four animate transform on SVG <g>. That
// is main-thread work every frame, and it ran whether or not the diagram was
// on screen. Dropping the classes parks them. Reduced motion is handled by the
// utilities themselves in global.css.
const animated = computed(
  () => onScreen.value && documentVisibility.value === 'visible'
)
</script>

<template>
  <div
    ref="root"
    aria-hidden="true"
    class="aspect-2/1 w-full overflow-hidden rounded-3xl bg-primary-comfy-ink"
  >
    <svg
      viewBox="0 48 1200 604"
      class="size-full"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="builder-bg-glow" cx="50%" cy="45%" r="50%">
          <stop offset="0%" stop-color="#49378B" stop-opacity="0.32" />
          <stop offset="100%" stop-color="#211927" stop-opacity="0" />
        </radialGradient>
      </defs>

      <rect width="1200" height="700" fill="#211927" />
      <ellipse
        cx="600"
        cy="330"
        rx="520"
        ry="330"
        fill="url(#builder-bg-glow)"
      />

      <g
        fill="none"
        stroke="#948FA6"
        stroke-opacity="0.72"
        stroke-width="3"
        stroke-dasharray="11 13"
        stroke-linecap="round"
      >
        <path
          :class="animated && 'animate-dash-flow'"
          d="M 168 158 C 300 190, 420 230, 520 276"
        />
        <path
          :class="animated && 'animate-dash-flow'"
          d="M 145 320 C 290 325, 420 320, 520 318"
        />
        <path
          :class="animated && 'animate-dash-flow'"
          d="M 190 500 C 340 505, 455 430, 530 352"
        />
        <path
          :class="animated && 'animate-dash-flow'"
          d="M 680 276 C 820 255, 905 225, 1012 212"
        />
        <path
          :class="animated && 'animate-dash-flow'"
          d="M 680 338 C 820 375, 910 415, 1012 445"
        />
      </g>

      <image
        href="/assets/platform/builder/base-large.svg"
        x="419"
        y="343"
        width="362"
        height="192"
      />
      <g :class="animated && 'animate-platform-builder-float'">
        <image
          href="/assets/platform/builder/cube-large.png"
          x="520"
          y="190"
          width="160"
          height="190"
        />
        <path
          d="M592 192 Q600 187 608 192 L672 228 Q686 236 672 246 L608 282 Q600 287 592 282 L528 246 Q514 236 528 228 Z"
          class="fill-primary-comfy-yellow"
        />
      </g>

      <image
        href="/assets/platform/builder/base-small.svg"
        x="979"
        y="273"
        width="142"
        height="77"
      />
      <image
        href="/assets/platform/builder/base-small.svg"
        x="979"
        y="508"
        width="142"
        height="77"
      />
      <g :class="animated && 'animate-platform-builder-float-slow'">
        <image
          href="/assets/platform/builder/cube-small.png"
          x="1018"
          y="202"
          width="64"
          height="69"
        />
        <path
          d="M1046.8 202.8 Q1050 200.8 1053.2 202.8 L1078.8 217.2 Q1084.4 220.4 1078.8 224.4 L1053.2 238.8 Q1050 240.8 1046.8 238.8 L1021.2 224.4 Q1015.6 220.4 1021.2 217.2 Z"
          class="fill-primary-comfy-yellow"
        />
      </g>
      <g :class="animated && 'animate-platform-builder-float-delayed'">
        <image
          href="/assets/platform/builder/cube-small.png"
          x="1018"
          y="437"
          width="64"
          height="69"
        />
        <path
          d="M1046.8 437.8 Q1050 435.8 1053.2 437.8 L1078.8 452.2 Q1084.4 455.4 1078.8 459.4 L1053.2 473.8 Q1050 475.8 1046.8 473.8 L1021.2 459.4 Q1015.6 455.4 1021.2 452.2 Z"
          class="fill-primary-comfy-yellow"
        />
      </g>

      <g :class="animated && 'animate-platform-builder-pulse'">
        <polygon
          points="110,106 80.6,123 80.6,157 110,174 139.4,157 139.4,123"
          fill="#F2FF59"
        />
      </g>
      <polygon
        points="72,162 46,177 46,207 72,222 98,207 98,177"
        fill="none"
        stroke="#4A3E73"
        stroke-width="3"
      />
      <polygon
        points="152,187 127.8,201 127.8,229 152,243 176.2,229 176.2,201"
        fill="#3B3054"
      />
      <g>
        <polygon points="63,330 95,348 95,388 63,370" fill="#443A63" />
        <polygon points="127,330 95,348 95,388 127,370" fill="#332B4E" />
        <polygon points="63,330 95,312 127,330 95,348" fill="#F2FF59" />
      </g>
      <rect
        x="-25"
        y="-25"
        width="50"
        height="50"
        rx="9"
        fill="#40355E"
        transform="translate(158,478) scale(1,0.5) rotate(45)"
      />
      <rect
        x="-25"
        y="-25"
        width="50"
        height="50"
        rx="9"
        fill="none"
        stroke="#4A3E73"
        stroke-width="3"
        transform="translate(105,506) scale(1,0.5) rotate(45)"
      />
    </svg>
  </div>
</template>
