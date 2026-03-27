import type { GameState } from '@/types'
import { challenges } from '@/data/challenges'
import { countResolvedChallenges } from '@/engine/navigation'
import { showEnding } from '@/engine/stateMachine'
import { clearSave } from '@/state/gameState'
import { createHud, renderHud } from '@/ui/hud'
import { renderChallenge } from '@/ui/challengeView'
import { renderEnding } from '@/ui/endingView'
import { createMapOverlay, renderMap, toggleMap } from '@/ui/nodeMap'
import { createRoomView, renderRoom } from '@/ui/roomView'
import { createSidebar, renderSidebar } from '@/ui/sidebar'

function mountApp(): void {
  const app = document.getElementById('app')
  if (!app) throw new Error('Missing #app element')

  app.appendChild(createHud())
  app.appendChild(createRoomView())
  app.appendChild(createSidebar())
  createMapOverlay()

  const toggleBtn = document.getElementById('toggle-map')
  toggleBtn?.addEventListener('click', toggleMap)

  const restartBtn = document.getElementById('restart-btn')
  restartBtn?.addEventListener('click', () => {
    clearSave()
    location.reload()
  })

  document.addEventListener('keydown', handleKeydown)
}

function handleKeydown(e: KeyboardEvent): void {
  const tag = (e.target as HTMLElement).tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return

  if (e.key === 'M' || e.key === 'm') {
    toggleMap()
    return
  }

  if (e.key === 'Escape') {
    const dialog = document.getElementById(
      'map-dialog'
    ) as HTMLDialogElement | null
    if (dialog?.open) dialog.close()
    return
  }

  const numMatch = e.key.match(/^[1-9]$/)
  if (numMatch) {
    const index = parseInt(e.key, 10) - 1
    const choices = document.querySelectorAll<HTMLButtonElement>('.choice-btn')
    choices[index]?.click()
    return
  }

  const letterMatch = e.key.match(/^[A-Ca-c]$/)
  if (letterMatch) {
    const key = e.key.toUpperCase()
    const choices = document.querySelectorAll<HTMLButtonElement>(
      '.challenge-choice-btn'
    )
    const match = Array.from(choices).find(
      (btn) => btn.querySelector('.choice-key')?.textContent === key
    )
    match?.click()
  }
}

function render(state: GameState): void {
  renderHud(state)
  renderSidebar(state)
  renderMap(state)

  if (state.phase === 'ending') {
    renderEnding(state)
    return
  }

  renderRoom(state)
  renderChallenge(state)

  const totalChallenges = Object.keys(challenges).length
  const resolved = countResolvedChallenges(state.save)
  if (resolved >= totalChallenges) {
    showEnding()
  }
}

export { mountApp, render }
