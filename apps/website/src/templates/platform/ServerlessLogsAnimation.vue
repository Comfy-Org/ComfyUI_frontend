<script setup lang="ts">
// Log meters: [width %, event?]
const meterRows = [
  [32, false],
  [40, false],
  [84, true],
  [54, false],
  [64, true],
  [36, false]
] as const

const streamRows = [...meterRows, ...meterRows]
</script>

<template>
  <div class="logs-art" aria-hidden="true">
    <div class="live"><i />LIVE</div>
    <div class="rows">
      <div class="row-stream">
        <div
          v-for="([width, event], index) in streamRows"
          :key="index"
          class="row"
          :class="{
            ev: event,
            'row--entering': index === 5 || (index >= 6 && index <= 10)
          }"
          :style="{
            '--entry-delay': `${index === 5 ? 0 : (index - 5) * 1.5}s`
          }"
        >
          <span class="rail"><span class="a" /><span class="b" /></span>
          <span class="meter">
            <i
              :style="{
                '--width': `${width}%`
              }"
            />
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.logs-art {
  --lime: var(--color-primary-comfy-yellow);
  --plum: #7a68ce;
  --plum-deep: #322a47;
  --bar-height: 14px;
  position: relative;
  width: 100%;
  height: 100%;
  font-family: var(--font-mono, monospace);
}

.live {
  position: absolute;
  top: 14px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 9px;
  letter-spacing: 0.3em;
  color: var(--lime);
}
.live i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--lime);
  display: block;
  animation: logs-blink 2.2s ease-in-out infinite;
}
@keyframes logs-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.25;
  }
}

.rows {
  position: absolute;
  inset: 26px 0 10px;
  overflow: hidden;
}

.row-stream {
  height: 200%;
  display: flex;
  flex-direction: column;
  animation: logs-tick 9s steps(6, end) infinite;
}

.row {
  flex: 0 0 calc(100% / 12);
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 0 28px 0 16px;
  border-bottom: 1px solid rgb(122 104 206 / 0.1);
}
.row:last-child {
  border-bottom: 0;
}

@keyframes logs-tick {
  to {
    transform: translateY(-50%);
  }
}

.rail {
  display: flex;
  gap: 7px;
  flex: 0 0 62px;
}
.rail span {
  height: 6px;
  border-radius: 3px;
  background: var(--plum-deep);
}
.rail .a {
  width: 38px;
}
.rail .b {
  width: 19px;
}

.meter {
  flex: 1;
  height: var(--bar-height);
  position: relative;
}
.meter i {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 4px;
  background: var(--c, var(--plum));
  transform: skewX(-12deg);
  transform-origin: left center;
  width: var(--width, 30%);
}

.row.ev .meter i {
  --c: var(--lime);
}

.row--entering .meter i {
  animation: logs-enter 9s ease-out var(--entry-delay) infinite both;
}

@keyframes logs-enter {
  0% {
    transform: skewX(-12deg) scaleX(0);
  }
  6%,
  100% {
    transform: skewX(-12deg) scaleX(1);
  }
}
.row.ev .rail span {
  background: #5a5230;
}
@media (prefers-reduced-motion: reduce) {
  .row-stream,
  .row--entering .meter i,
  .live i {
    animation: none;
  }
}
</style>
