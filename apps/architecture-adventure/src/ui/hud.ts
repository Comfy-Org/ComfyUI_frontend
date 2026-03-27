import type { GameState } from '@/types'
import { challenges } from '@/data/challenges'
import { countResolvedChallenges } from '@/engine/navigation'

function createHud(): HTMLElement {
  const hud = document.createElement('header')
  hud.id = 'hud'
  hud.innerHTML = `
    <h1 id="game-title">Codebase Caverns</h1>
    <div id="hud-right">
      <div id="hud-insight">
        <span class="hud-label">Insight</span>
        <span id="insight-value">0</span>
      </div>
      <div id="hud-progress">
        <span class="hud-label">Challenges</span>
        <span id="progress-value">0/0</span>
      </div>
      <button id="toggle-map" type="button">Map [M]</button>
      <button id="restart-btn" type="button">Restart</button>
    </div>
  `
  return hud
}

function renderHud(state: GameState): void {
  const insightEl = document.getElementById('insight-value')
  const progressEl = document.getElementById('progress-value')

  if (insightEl) {
    const total =
      state.save.persistent.totalInsight + state.save.currentRun.insightEarned
    insightEl.textContent = String(total)
  }

  if (progressEl) {
    const resolved = countResolvedChallenges(state.save)
    const total = Object.keys(challenges).length
    progressEl.textContent = `${resolved}/${total}`
  }
}

export { createHud, renderHud }
