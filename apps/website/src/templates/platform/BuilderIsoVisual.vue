<script setup lang="ts">
// Isometric build visual for the /platform Builder card: a central glass
// cube linked by dashed connectors to satellite nodes, with travelling
// pulses (SMIL) and a gentle vertical drift on the solids.
const floaters = [
  { id: 'a', duration: '9s', delay: '0s' },
  { id: 'b', duration: '10s', delay: '-3s' },
  { id: 'c', duration: '11s', delay: '-6s' }
] as const

const pulses = [
  { path: '#iso-p1', dur: '10s', begin: '0s' },
  { path: '#iso-p2', dur: '11s', begin: '-3.5s' },
  { path: '#iso-p3', dur: '12s', begin: '-7s' },
  { path: '#iso-p4', dur: '10.5s', begin: '-2s' },
  { path: '#iso-p5', dur: '11.5s', begin: '-5.5s' }
]
</script>

<template>
  <div
    aria-hidden="true"
    class="h-full min-h-72 overflow-hidden rounded-3xl bg-[#241c2e]"
  >
    <svg
      viewBox="0 0 1200 700"
      class="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="iso-bg-glow" cx="50%" cy="45%" r="50%">
          <stop offset="0%" stop-color="#4A3A78" stop-opacity="0.5" />
          <stop offset="100%" stop-color="#241C2E" stop-opacity="0" />
        </radialGradient>

        <linearGradient
          id="iso-iri-l"
          gradientUnits="userSpaceOnUse"
          x1="460"
          y1="260"
          x2="620"
          y2="490"
        >
          <stop offset="0" stop-color="#EFEDF7" />
          <stop offset="0.32" stop-color="#F2DCEA" />
          <stop offset="0.58" stop-color="#DEEBF8" />
          <stop offset="0.82" stop-color="#E6F4EB" />
          <stop offset="1" stop-color="#EFEDF7" />
        </linearGradient>

        <linearGradient
          id="iso-iri-r"
          gradientUnits="userSpaceOnUse"
          x1="600"
          y1="480"
          x2="730"
          y2="270"
        >
          <stop offset="0" stop-color="#CFCADF" />
          <stop offset="0.3" stop-color="#DFD8EE" />
          <stop offset="0.62" stop-color="#EBD8E4" />
          <stop offset="1" stop-color="#E4E0F0" />
        </linearGradient>

        <filter
          id="iso-soft-glow"
          x="-150%"
          y="-150%"
          width="400%"
          height="400%"
        >
          <feGaussianBlur stdDeviation="9" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter
          id="iso-dot-glow"
          x="-400%"
          y="-400%"
          width="900%"
          height="900%"
        >
          <feGaussianBlur stdDeviation="3.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width="1200" height="700" fill="#241C2E" />
      <ellipse cx="600" cy="330" rx="520" ry="330" fill="url(#iso-bg-glow)" />

      <!-- dashed connectors -->
      <g
        fill="none"
        stroke="#948FA6"
        stroke-opacity="0.5"
        stroke-width="3"
        stroke-dasharray="11 13"
        stroke-linecap="round"
      >
        <path id="iso-p1" d="M 168 158 C 300 190, 370 240, 470 292" />
        <path id="iso-p2" d="M 145 320 C 280 325, 380 330, 470 336" />
        <path id="iso-p3" d="M 190 500 C 320 505, 430 460, 483 375" />
        <path id="iso-p4" d="M 722 292 C 830 275, 905 235, 1012 212" />
        <path id="iso-p5" d="M 722 350 C 840 375, 910 415, 1012 445" />
      </g>

      <!-- centre cube -->
      <g
        class="animate-iso-float"
        :style="{ animationDuration: floaters[0].duration }"
      >
        <polygon
          points="490,270 600,334 600,474 490,410"
          fill="url(#iso-iri-l)"
        />
        <polygon
          points="710,270 600,334 600,474 710,410"
          fill="url(#iso-iri-r)"
        />
        <polygon points="490,270 600,206 710,270 600,334" fill="#F5F87A" />
      </g>

      <!-- satellite node, upper right -->
      <g fill="none" stroke="#5B4BC9" stroke-width="2" stroke-opacity="0.75">
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
      </g>
      <g
        class="animate-iso-float"
        :style="{
          animationDuration: floaters[1].duration,
          animationDelay: floaters[1].delay
        }"
      >
        <polygon points="1008,215 1050,239 1050,291 1008,267" fill="#EDEAF6" />
        <polygon points="1092,215 1050,239 1050,291 1092,267" fill="#D8D2E9" />
        <polygon points="1008,215 1050,191 1092,215 1050,239" fill="#F5F87A" />
      </g>

      <!-- satellite node, lower right -->
      <g fill="none" stroke="#5B4BC9" stroke-width="2" stroke-opacity="0.75">
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
      <g
        class="animate-iso-float"
        :style="{
          animationDuration: floaters[2].duration,
          animationDelay: floaters[2].delay
        }"
      >
        <polygon points="1008,450 1050,474 1050,526 1008,502" fill="#EDEAF6" />
        <polygon points="1092,450 1050,474 1050,526 1092,502" fill="#D8D2E9" />
        <polygon points="1008,450 1050,426 1092,450 1050,474" fill="#F5F87A" />
      </g>

      <!-- left decorative cluster -->
      <g filter="url(#iso-soft-glow)">
        <polygon
          points="110,106 80.6,123 80.6,157 110,174 139.4,157 139.4,123"
          fill="#F5F87A"
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
        <polygon points="63,330 95,348 95,388 63,370" fill="#3B3054" />
        <polygon points="127,330 95,348 95,388 127,370" fill="#2E2544" />
        <polygon points="63,330 95,312 127,330 95,348" fill="#F5F87A" />
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

      <!-- travelling dots -->
      <g fill="#F5F87A" filter="url(#iso-dot-glow)">
        <circle v-for="pulse in pulses" :key="pulse.path" r="3.5">
          <animateMotion
            :dur="pulse.dur"
            repeatCount="indefinite"
            :begin="pulse.begin"
          >
            <mpath :href="pulse.path" />
          </animateMotion>
        </circle>
      </g>
    </svg>
  </div>
</template>
