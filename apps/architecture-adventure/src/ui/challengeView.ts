import type { ChallengeDefinition, GameState } from '@/types'
import { challenges } from '@/data/challenges'
import { rooms } from '@/data/rooms'
import { isChallengeResolved } from '@/engine/navigation'
import { resolveChallenge } from '@/engine/stateMachine'

function renderChallenge(state: GameState): void {
  const mount = document.getElementById('challenge-mount')
  if (!mount) return

  mount.innerHTML = ''

  const roomId = state.save.currentRun.currentRoom
  const room = rooms[roomId]
  if (!room?.challengeId) return

  const challenge = challenges[room.challengeId]
  if (!challenge) return

  if (isChallengeResolved(challenge.id, state.save)) {
    mount.appendChild(renderResultBanner(challenge, state))
    return
  }

  mount.appendChild(renderChallengePanel(challenge))
}

function renderChallengePanel(challenge: ChallengeDefinition): HTMLElement {
  const panel = document.createElement('div')
  panel.id = 'challenge-panel'
  panel.className = 'active'

  const header = document.createElement('div')
  header.id = 'challenge-header'
  header.innerHTML = `
    <span class="icon">⚡</span>
    <span id="challenge-title">${challenge.title}</span>
  `

  const desc = document.createElement('div')
  desc.id = 'challenge-desc'
  desc.textContent = challenge.description

  const choicesEl = document.createElement('div')
  choicesEl.id = 'challenge-choices'

  for (const choice of challenge.choices) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'challenge-choice-btn'
    btn.innerHTML = `
      <div class="choice-icon-wrap">
        <span class="choice-key">${choice.key}</span>
        <div class="choice-icon"></div>
      </div>
      <div class="choice-text">
        <span class="choice-label">${choice.label}</span>
        <span class="choice-hint">${choice.hint}</span>
      </div>
    `
    btn.addEventListener('click', () => resolveChallenge(challenge, choice.key))
    choicesEl.appendChild(btn)
  }

  panel.appendChild(header)
  panel.appendChild(desc)
  panel.appendChild(choicesEl)
  return panel
}

function renderResultBanner(
  challenge: ChallengeDefinition,
  state: GameState
): HTMLElement {
  const result = state.save.currentRun.resolvedChallenges[challenge.id]
  const choice = challenge.choices.find((c) => c.key === result?.choiceKey)

  const banner = document.createElement('div')
  banner.id = 'result-banner'
  banner.className = `active ${result?.rating ?? ''}`

  const ratingLabel =
    result?.rating === 'good' ? 'GOOD' : result?.rating === 'ok' ? 'OK' : 'BAD'

  let html = `
    <strong class="rating-${result?.rating ?? ''}">${ratingLabel}</strong>
    — ${choice?.feedback ?? ''}
  `

  if (result?.choiceKey !== challenge.recommended) {
    const recommended = challenge.choices.find(
      (c) => c.key === challenge.recommended
    )
    if (recommended) {
      html += `
        <div class="result-recommended">
          <strong>Recommended:</strong> ${recommended.label} — ${recommended.hint}
        </div>
      `
    }
  }

  if (challenge.docLink) {
    html += `
      <div style="margin-top:8px">
        <a class="result-doc-link" href="${challenge.docLink.url}" target="_blank" rel="noopener">
          ${challenge.docLink.label} ↗
        </a>
      </div>
    `
  }

  banner.innerHTML = html
  return banner
}

export { renderChallenge }
