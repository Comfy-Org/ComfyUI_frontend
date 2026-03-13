import { handleRequest } from './routes'

const PORT = parseInt(process.env.MOCK_MARKETPLACE_PORT ?? '4000', 10)

Bun.serve({
  port: PORT,
  fetch: handleRequest
})

 
console.log(`Mock marketplace API running on http://localhost:${PORT}`)
