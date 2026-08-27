function main(): void {
  const app = document.getElementById('app')
  if (!app) throw new Error('Missing #app element')
  app.textContent = 'Codebase Caverns v2 — Loading...'
}

main()
