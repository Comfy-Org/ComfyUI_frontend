<template>
  <div
    aria-hidden="true"
    class="h-full min-h-72 overflow-hidden rounded-3xl bg-primary-comfy-ink"
  >
    <svg
      viewBox="0 0 1200 700"
      class="size-full"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="builder-bg-glow" cx="50%" cy="45%" r="50%">
          <stop offset="0%" stop-color="#49378B" stop-opacity="0.32" />
          <stop offset="100%" stop-color="#211927" stop-opacity="0" />
        </radialGradient>
        <filter
          id="builder-source-glow"
          x="-150%"
          y="-150%"
          width="400%"
          height="400%"
        >
          <feGaussianBlur stdDeviation="10" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
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
          class="animate-dash-flow"
          d="M 168 158 C 300 190, 370 240, 470 292"
        />
        <path
          class="animate-dash-flow"
          d="M 145 320 C 280 325, 380 330, 470 336"
        />
        <path
          class="animate-dash-flow"
          d="M 190 500 C 320 505, 430 460, 483 375"
        />
        <path
          class="animate-dash-flow"
          d="M 722 292 C 830 275, 905 235, 1012 212"
        />
        <path
          class="animate-dash-flow"
          d="M 722 350 C 840 375, 910 415, 1012 445"
        />
      </g>

      <g fill="none" stroke="#5946B7" stroke-width="2">
        <rect
          x="-106"
          y="-106"
          width="212"
          height="212"
          rx="28"
          transform="translate(600,424) scale(1,0.46) rotate(45)"
        />
        <rect
          x="-132"
          y="-132"
          width="264"
          height="264"
          rx="34"
          transform="translate(600,454) scale(1,0.46) rotate(45)"
        />
        <rect
          x="-158"
          y="-158"
          width="316"
          height="316"
          rx="40"
          transform="translate(600,488) scale(1,0.46) rotate(45)"
        />
      </g>
      <image
        href="/assets/platform/builder/cube-large.png"
        x="470"
        y="178"
        width="260"
        height="308"
        class="animate-platform-builder-float"
      />

      <g fill="none" stroke="#5946B7" stroke-width="2">
        <rect
          x="-39"
          y="-39"
          width="78"
          height="78"
          rx="14"
          transform="translate(1050,300) scale(1,0.5) rotate(45)"
        />
        <rect
          x="-50"
          y="-50"
          width="100"
          height="100"
          rx="18"
          transform="translate(1050,315) scale(1,0.5) rotate(45)"
        />
        <rect
          x="-39"
          y="-39"
          width="78"
          height="78"
          rx="14"
          transform="translate(1050,535) scale(1,0.5) rotate(45)"
        />
        <rect
          x="-50"
          y="-50"
          width="100"
          height="100"
          rx="18"
          transform="translate(1050,550) scale(1,0.5) rotate(45)"
        />
      </g>
      <image
        href="/assets/platform/builder/cube-small.png"
        x="1008"
        y="191"
        width="84"
        height="91"
        class="animate-platform-builder-float-slow"
      />
      <image
        href="/assets/platform/builder/cube-small.png"
        x="1008"
        y="426"
        width="84"
        height="91"
        class="animate-platform-builder-float-delayed"
      />

      <g class="animate-platform-builder-pulse">
        <polygon
          points="110,106 80.6,123 80.6,157 110,174 139.4,157 139.4,123"
          fill="#F2FF59"
          filter="url(#builder-source-glow)"
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
