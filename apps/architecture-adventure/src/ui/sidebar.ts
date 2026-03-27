import type { GameState } from '@/types'

function createSidebar(): HTMLElement {
  const sidebar = document.createElement('aside')
  sidebar.id = 'sidebar'
  sidebar.innerHTML = `
    <div id="concept-tags">
      <h3 class="sidebar-header">Concept Tags</h3>
      <div id="tags-list"></div>
    </div>
    <div id="artifacts-panel">
      <h3 class="sidebar-header">Artifacts</h3>
      <div id="artifacts-list"></div>
    </div>
    <div id="run-log">
      <h3 class="sidebar-header">Log</h3>
      <div id="log-entries"></div>
    </div>
  `
  return sidebar
}

function renderSidebar(state: GameState): void {
  const tagsList = document.getElementById('tags-list')
  if (tagsList) {
    tagsList.innerHTML = state.save.currentRun.conceptTags
      .map((tag) => `<span class="tag-pill">${tag}</span>`)
      .join('')

    if (state.save.currentRun.conceptTags.length === 0) {
      tagsList.innerHTML =
        '<span class="empty-hint">None yet — explore and solve challenges</span>'
    }
  }
}

function addLogEntry(text: string, type: string = 'info'): void {
  const logEntries = document.getElementById('log-entries')
  if (!logEntries) return

  const entry = document.createElement('div')
  entry.className = `log-entry log-${type}`
  entry.textContent = text
  logEntries.prepend(entry)

  while (logEntries.children.length > 50) {
    logEntries.lastChild?.remove()
  }
}

export { addLogEntry, createSidebar, renderSidebar }
