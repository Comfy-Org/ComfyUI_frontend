import type { GameState } from '@/types'
import { rooms } from '@/data/rooms'
import { isChallengeResolved } from '@/engine/navigation'
import { enterRoom } from '@/engine/stateMachine'
import { canEnterRoom } from '@/state/tags'

function createRoomView(): HTMLElement {
  const main = document.createElement('main')
  main.id = 'main'
  main.innerHTML = `
    <div id="room-header">
      <h2 id="room-title"></h2>
      <div id="room-layer"></div>
    </div>
    <div id="room-image" class="room-image placeholder"></div>
    <p id="room-description"></p>
    <div id="challenge-mount"></div>
    <div id="room-choices"></div>
  `
  return main
}

function renderRoom(state: GameState): void {
  const roomId = state.save.currentRun.currentRoom
  const room = rooms[roomId]
  if (!room) return

  const titleEl = document.getElementById('room-title')
  if (titleEl) titleEl.textContent = room.title

  const layerEl = document.getElementById('room-layer')
  if (layerEl) layerEl.textContent = room.layer

  const imageEl = document.getElementById('room-image')
  if (imageEl) {
    if (room.imageUrl) {
      imageEl.innerHTML = `<img src="${room.imageUrl}" alt="${room.title}" />`
      imageEl.className = 'room-image'
    } else {
      imageEl.innerHTML = `<span>${room.layer}</span>`
      imageEl.className = 'room-image placeholder'
    }
  }

  const descEl = document.getElementById('room-description')
  if (descEl) {
    const challengeResolved =
      room.challengeId !== undefined &&
      isChallengeResolved(room.challengeId, state.save)
    const showSolution = challengeResolved && room.solutionDescription !== ''
    descEl.textContent = showSolution
      ? room.solutionDescription
      : room.discoveryDescription
  }

  const choicesEl = document.getElementById('room-choices')
  if (choicesEl) {
    choicesEl.innerHTML = ''
    room.connections.forEach((conn, index) => {
      const targetRoom = rooms[conn.targetRoomId]
      if (!targetRoom) return

      const accessible = canEnterRoom(targetRoom, state.save)
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'choice-btn' + (accessible ? '' : ' locked')

      btn.innerHTML = `
        <span class="choice-key">${index + 1}</span>
        <span class="choice-label">${conn.label}</span>
        <span class="choice-hint">${accessible ? conn.hint : '🔒 ' + conn.hint}</span>
      `

      if (accessible) {
        btn.addEventListener('click', () => enterRoom(conn.targetRoomId))
      }

      choicesEl.appendChild(btn)
    })
  }
}

export { createRoomView, renderRoom }
