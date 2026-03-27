import type { GameState } from '@/types'
import { buildNarrativeSummary } from '@/data/narrative'
import { resetForPrestige } from '@/engine/stateMachine'
import { persistSave } from '@/state/gameState'
import { canPrestige, prestige } from '@/state/prestige'

function renderPrestigeSection(state: GameState, summary: string): HTMLElement {
  const section = document.createElement('div')
  section.className = 'prestige-section'

  if (canPrestige(state.save)) {
    const teaser = document.createElement('p')
    teaser.className = 'prestige-teaser'
    teaser.textContent =
      'The architecture breathes. Deeper layers await — more entangled, more instructive. Are you ready to descend?'

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'prestige-btn'
    btn.textContent = 'Descend Deeper'
    btn.addEventListener('click', () => {
      const newSave = prestige(state.save, summary)
      persistSave(newSave)
      resetForPrestige(newSave)
    })

    section.appendChild(teaser)
    section.appendChild(btn)
  } else {
    const maxLayer = document.createElement('p')
    maxLayer.className = 'max-layer-text'
    maxLayer.textContent = 'You have reached the deepest layer.'
    section.appendChild(maxLayer)
  }

  return section
}

function renderEnding(state: GameState): void {
  const main = document.getElementById('main')
  if (!main) return

  const run = state.save.currentRun
  const summary = buildNarrativeSummary(run.resolvedChallenges)
  const resolvedCount = Object.keys(run.resolvedChallenges).length
  const conceptCount = run.conceptTags.length

  main.innerHTML = ''

  const title = document.createElement('h2')
  title.className = 'ending-title'
  title.textContent = 'State of the Codebase'

  const narrative = document.createElement('p')
  narrative.className = 'ending-narrative'
  narrative.textContent = summary

  const stats = document.createElement('div')
  stats.className = 'ending-stats'
  stats.innerHTML = `
    <div class="stat"><span class="stat-label">Insight Earned</span><span class="stat-value">${run.insightEarned}</span></div>
    <div class="stat"><span class="stat-label">Challenges Resolved</span><span class="stat-value">${resolvedCount}</span></div>
    <div class="stat"><span class="stat-label">Concepts Learned</span><span class="stat-value">${conceptCount}</span></div>
    <div class="stat"><span class="stat-label">Current Layer</span><span class="stat-value">${run.layer}</span></div>
  `

  main.appendChild(title)
  main.appendChild(narrative)
  main.appendChild(stats)
  main.appendChild(renderPrestigeSection(state, summary))
}

export { renderEnding }
