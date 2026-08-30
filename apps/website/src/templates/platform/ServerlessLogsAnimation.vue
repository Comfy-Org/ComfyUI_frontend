<script setup lang="ts">
// Live log meters: [start width %, end width %, duration s, steps, delay s, event?]
const meterRows = [
  [22, 32, 5.4, 4, 0, false],
  [30, 40, 4.6, 3, 0.8, false],
  [72, 84, 3.8, 4, 0.3, true],
  [42, 54, 6.4, 5, 1.2, false],
  [54, 64, 5, 4, 0.9, true],
  [26, 36, 5.8, 4, 0.5, false]
] as const
</script>

<template>
  <div class="logs-art" aria-hidden="true">
    <div class="live"><i />LIVE</div>
    <div class="rows">
      <div
        v-for="([w0, w1, t, steps, d, event], index) in meterRows"
        :key="index"
        class="row"
        :class="{ ev: event }"
      >
        <span class="rail"><span class="a" /><span class="b" /></span>
        <span class="meter">
          <i
            :style="{
              '--w0': `${w0}%`,
              '--w1': `${w1}%`,
              '--t': `${t}s`,
              '--steps': steps,
              '--d': `${d}s`
            }"
          />
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.logs-art {
  --lime: var(--color-primary-comfy-yellow);
  --plum: #7a68ce;
  --plum-deep: #322a47;
  --pitch: 8px;
  --dot: 2.3px;
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
  display: flex;
  flex-direction: column;
}

.row {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 0 28px 0 16px;
  border-bottom: 1px solid rgb(122 104 206 / 0.1);
}
.row:last-child {
  border-bottom: 0;
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
  height: calc(var(--pitch) * 3);
  position: relative;
  background-image: radial-gradient(
    circle,
    rgb(122 104 206 / 0.13) var(--dot),
    transparent calc(var(--dot) + 0.5px)
  );
  background-size: var(--pitch) var(--pitch);
  background-position: left center;
}
.meter i {
  position: absolute;
  inset: 0 auto 0 0;
  background-image: radial-gradient(
    circle,
    var(--c, var(--plum)) var(--dot),
    transparent calc(var(--dot) + 0.5px)
  );
  background-size: var(--pitch) var(--pitch);
  background-position: left center;
  width: var(--w0, 30%);
  animation: logs-flux var(--t, 6s) steps(var(--steps, 5)) var(--d, 0s) infinite
    alternate;
}
@keyframes logs-flux {
  from {
    width: var(--w0);
  }
  to {
    width: var(--w1);
  }
}

.row.ev .meter i {
  --c: var(--lime);
  filter: drop-shadow(0 0 5px rgb(214 242 78 / 0.35));
  animation:
    logs-flux var(--t, 6s) steps(var(--steps, 5)) var(--d, 0s) infinite
      alternate,
    logs-breathe 3.6s ease-in-out infinite;
}
.row.ev .rail span {
  background: #5a5230;
}
@keyframes logs-breathe {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
}

@media (prefers-reduced-motion: reduce) {
  .meter i,
  .live i {
    animation: none;
  }
}
</style>
