<!-- eslint-disable vue/no-v-html -->
<template>
  <div class="viewer">
    <GlobalDialog />
    <nav class="side">
      <h1>{{ SITE_TITLE }}</h1>
      <div class="sub">{{ SITE_SUB }}</div>

      <label class="rolelabel" for="role">{{ roleLabel }}</label>
      <select id="role" class="roleselect" :value="role" @change="onRoleChange">
        <option v-for="(label, value) in ROLE_LABELS" :key="value" :value>
          {{ label }}
        </option>
      </select>

      <template v-for="[group, groupStates] in grouped" :key="group">
        <div class="group">{{ group }}</div>
        <button
          v-for="s in groupStates"
          :key="s.id"
          :class="{ active: s.id === current.id }"
          @click="onSelect(s.id)"
        >
          {{ s.title }}
        </button>
      </template>
    </nav>

    <main class="content">
      <h2>{{ current.title }}</h2>
      <div class="crumb">{{ current.crumb }}</div>

      <div class="stage" :class="{ wide: isPanelHost }">
        <CurrentUserPopoverWorkspace v-if="current.host === 'menu'" />
        <PlanCreditsPanelContent v-else-if="current.host === 'plancredits'" />
        <MembersPanelContent v-else-if="current.host === 'members'" />
        <div v-else-if="current.host === 'runbutton'" class="runstage">
          <div class="actionbar"><CloudRunButtonWrapper /></div>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div v-if="current.mock" class="mockhost" v-html="current.mock" />
        </div>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-else class="mockhost" v-html="current.mock" />
      </div>
      <div v-if="current.host === 'mock'" class="mocknote">
        {{ mockNote }}
      </div>
      <div
        v-else-if="current.host === 'runbutton' && current.mock"
        class="mocknote"
      >
        {{ runNote }}
      </div>

      <div class="spec">
        <h3>{{ specLabel }}</h3>
        <ul>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <li v-for="(row, i) in current.spec" :key="i" v-html="row" />
        </ul>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import CloudRunButtonWrapper from '@/components/actionbar/ComfyRunButton/CloudRunButtonWrapper.vue'
import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import CurrentUserPopoverWorkspace from '@/platform/workspace/components/CurrentUserPopoverWorkspace.vue'
import MembersPanelContent from '@/platform/workspace/components/dialogs/settings/MembersPanelContent.vue'
import PlanCreditsPanelContent from '@/platform/workspace/components/dialogs/settings/PlanCreditsPanelContent.vue'

import type { ViewerRole } from './states'
import {
  ROLE_LABELS,
  SITE_SUB,
  SITE_TITLE,
  STATES,
  activateState,
  parseHash
} from './states'

const roleLabel = 'Viewing as'
const specLabel = 'Spec'
const mockNote =
  'Static mock — not yet built in Vue. The spec below is the source of truth.'
const runNote =
  'Button above is the real shipped component; the dialog below is a static mock of the designed target.'

const { role, stateId } = parseHash()

const visible = computed(() => STATES.filter((s) => s.roles.includes(role)))

const grouped = computed(() => {
  const map = new Map<string, typeof STATES>()
  for (const s of visible.value) {
    const list = map.get(s.group) ?? []
    list.push(s)
    map.set(s.group, list)
  }
  return [...map.entries()]
})

const current = computed(
  () => visible.value.find((s) => s.id === stateId) ?? visible.value[0]
)

const isPanelHost = computed(() =>
  ['members', 'plancredits'].includes(current.value.host)
)

function onSelect(id: string) {
  activateState(role, id)
}

function onRoleChange(e: Event) {
  const next = (e.target as HTMLSelectElement).value as ViewerRole
  const candidates = STATES.filter((s) => s.roles.includes(next))
  const keep = candidates.find((s) => s.id === current.value.id)
  activateState(next, (keep ?? candidates[0]).id)
}
</script>

<style scoped>
.viewer {
  display: flex;
  height: 100vh;
  background: #0d0e11;
  color: #e6e6e6;
  font:
    14px/1.45 Inter,
    -apple-system,
    system-ui,
    sans-serif;
}
.side {
  width: 264px;
  min-width: 264px;
  overflow-y: auto;
  border-right: 1px solid #2a2c33;
  background: #141519;
  padding: 20px 12px 40px;
}
.side h1 {
  font-size: 16px;
  font-weight: 700;
  padding: 0 8px 4px;
  margin: 0;
}
.side .sub {
  font-size: 12px;
  color: #8a8a8a;
  padding: 0 8px 16px;
}
.rolelabel {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: #8a8a8a;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 4px 8px 6px;
}
.roleselect {
  display: block;
  width: calc(100% - 16px);
  margin: 0 8px 8px;
  background: #1e2026;
  color: #e6e6e6;
  border: 1px solid #2a2c33;
  border-radius: 8px;
  font: inherit;
  padding: 7px 8px;
}
.side .group {
  font-size: 12px;
  font-weight: 700;
  color: #8a8a8a;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 14px 8px 6px;
}
.side button {
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: 0;
  color: #e6e6e6;
  font: inherit;
  padding: 7px 8px;
  border-radius: 8px;
  cursor: pointer;
}
.side button:hover {
  background: #1e2026;
}
.side button.active {
  background: #24262d;
  font-weight: 600;
}
.content {
  flex: 1;
  overflow-y: auto;
  padding: 28px 36px 80px;
}
.content h2 {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 4px;
}
.crumb {
  font-size: 12px;
  color: #8a8a8a;
  padding-bottom: 20px;
}
.stage {
  background: #101116;
  border: 1px solid #23252b;
  border-radius: 16px;
  padding: 36px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  max-width: 860px;
}
.stage.wide {
  justify-content: stretch;
}
.stage.wide > :deep(*) {
  flex: 1;
}
.runstage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}
.actionbar {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: #0b0c0f;
  border: 1px solid #23252b;
  border-radius: 10px;
  padding: 10px 14px;
}
.mocknote {
  max-width: 860px;
  margin-top: 10px;
  font-size: 12px;
  color: #fbbf24;
}
.spec {
  max-width: 860px;
  margin-top: 18px;
  border-top: 1px solid #23252b;
  padding-top: 14px;
}
.spec h3 {
  font-size: 12px;
  font-weight: 700;
  color: #8a8a8a;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0 0 8px;
}
.spec ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
}
.spec li {
  font-size: 14px;
}
.spec :deep(.mono) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  background: #1b1d23;
  border-radius: 4px;
  padding: 1px 5px;
}

/* ---- static mocks ---- */
.mockhost :deep(.mock-col) {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
}
.mockhost :deep(.mock-dialog) {
  width: 400px;
  background: #141519;
  border: 1px solid #2a2c33;
  border-radius: 14px;
  box-shadow: 0 6px 24px rgb(0 0 0 / 0.5);
  overflow: hidden;
}
.mockhost :deep(.dhead) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #23252b;
}
.mockhost :deep(.dhead .x) {
  color: #8a8a8a;
  cursor: pointer;
}
.mockhost :deep(.dbody) {
  padding: 16px;
  color: #8a8a8a;
}
.mockhost :deep(.dbody .strong) {
  color: #e6e6e6;
}
.mockhost :deep(.dbody .reason) {
  margin-top: 12px;
  background: #1b1d23;
  border-radius: 8px;
  padding: 10px;
}
.mockhost :deep(.dfoot) {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 16px 16px;
}
.mockhost :deep(.mbtn) {
  background: #23252c;
  color: #e6e6e6;
  border: 0;
  border-radius: 8px;
  height: 32px;
  font: inherit;
  padding: 0 16px;
  cursor: pointer;
}
.mockhost :deep(.mbtn.wide) {
  width: 100%;
}
.mockhost :deep(.runstrip) {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #0b0c0f;
  border: 1px solid #23252b;
  border-radius: 10px;
  padding: 10px 14px;
}
.mockhost :deep(.runbtn) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #efc23c;
  color: #17130a;
  font-weight: 600;
  border: 0;
  border-radius: 8px;
  height: 32px;
  padding: 0 14px;
  cursor: pointer;
}
.mockhost :deep(.runstrip .meta) {
  font-size: 12px;
  color: #8a8a8a;
}
.mockhost :deep(.mock-tile) {
  width: 460px;
  background: #1a1b20;
  border: 1px solid #2a2c33;
  border-radius: 16px;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.mockhost :deep(.mock-tile .label) {
  font-size: 14px;
  color: #8a8a8a;
}
.mockhost :deep(.pill) {
  display: inline-flex;
  align-items: center;
  background: rgb(251 191 36 / 0.14);
  color: #fbbf24;
  font-size: 12px;
  font-weight: 600;
  border-radius: 999px;
  padding: 2px 10px;
  margin-left: 8px;
  position: relative;
  cursor: default;
}
.mockhost :deep(.pill .tip) {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  background: #1e2026;
  border: 1px solid #2a2c33;
  color: #e6e6e6;
  font-weight: 400;
  border-radius: 8px;
  padding: 8px 10px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s;
  z-index: 5;
}
.mockhost :deep(.pill:hover .tip) {
  opacity: 1;
}
.mockhost :deep(.bigrow) {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.mockhost :deep(.bigrow .coin) {
  color: #efc23c;
}
.mockhost :deep(.bigrow .big) {
  font-size: 24px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.mockhost :deep(.bigrow .suffix) {
  font-size: 14px;
  color: #8a8a8a;
}
.mockhost :deep(.bigrow .suffix b) {
  color: #e6e6e6;
}
.mockhost :deep(.subrow) {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: #8a8a8a;
  font-variant-numeric: tabular-nums;
}
.mockhost :deep(.subrow.right) {
  justify-content: flex-end;
}
.mockhost :deep(.subrow .amber) {
  color: #fbbf24;
}
.mockhost :deep(.mbar) {
  height: 8px;
  border-radius: 999px;
  background: #26282f;
  overflow: hidden;
}
.mockhost :deep(.mbar > div) {
  height: 100%;
  border-radius: 999px;
  background: #efc23c;
}
</style>
