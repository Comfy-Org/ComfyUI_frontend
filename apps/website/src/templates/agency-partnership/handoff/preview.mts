import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'

interface Work {
  title: string
  type: string
  sourceUrl: string
  poster?: string
}
interface Agency {
  id: string
  name: string
  logoSrc: string
  background: string
  specialties: string[]
  work: Work[]
}
const data = JSON.parse(readFileSync(new URL('./agency-review-data.json', import.meta.url), 'utf8')) as { agencies: Agency[] }
const escape = (text: string) => text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char)
const wrap = (body: string) => `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Agency WIP handoff</title><style>body{margin:0;background:#211a2b;color:#eeeae5;font:18px/1.5 system-ui}aside{padding:12px;background:#efff45;color:#211a2b}main{max-width:1200px;margin:auto;padding:32px}header,section{text-align:center;margin:48px auto}article{padding:24px;border:1px solid #62586b;border-radius:24px}h1,h2{font-weight:400}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.placeholder{display:grid;place-items:center;min-height:160px;background:#302738;border-radius:16px;padding:16px}a{color:inherit}.badge{display:inline-block;border:1px solid #62586b;border-radius:20px;padding:4px 14px;margin:4px}footer{margin-top:64px;padding:24px;border-top:1px solid #62586b}@media(max-width:600px){.grid{grid-template-columns:1fr}main{padding:20px}}</style><aside>WIP FOR DESIGN HANDOFF · MEDIA HOSTED PUBLICLY · STRUCTURE ONLY</aside><main>${body}<footer>Structural handoff preview. The production Comfy navigation/footer require the website components and full integration.</footer></main></html>`
const overview = () => wrap(`<header><h1>Agency partnership WIP</h1><p>Design and copy are unfinished. This preview uses the saved agency records with hosted media.</p></header><div class="grid">${data.agencies.map((agency) => `<article><h2>${escape(agency.name)}</h2><p>${escape(agency.specialties.join(' · '))}</p><p>${agency.work.length} work items</p><a href="/${encodeURIComponent(agency.id)}">Open agency</a></article>`).join('')}</div>`)
const detail = (agency: Agency) => wrap(`<a href="/">Agency overview</a><header><img src="${escape(agency.logoSrc)}" alt="${escape(agency.name)}" style="max-width:240px;max-height:100px;object-fit:contain"><h1>${escape(agency.name)}</h1>${agency.specialties.map((name) => `<span class="badge">${escape(name)}</span>`).join('')}</header><section><h2>Selected work</h2></section><div class="grid">${agency.work.length ? agency.work.map((work) => `<article>${work.type === 'video' ? `<video controls preload="none" poster="${escape(work.poster ?? '')}" src="${escape(work.sourceUrl)}" style="width:100%;aspect-ratio:16/9;object-fit:contain"></video>` : `<img loading="lazy" src="${escape(work.sourceUrl)}" alt="${escape(work.title)}" style="width:100%;aspect-ratio:16/9;object-fit:contain">`}<h3>${escape(work.title)}</h3></article>`).join('') : '<article class="placeholder">Work not supplied yet</article>'}</div><section><h2>About ${escape(agency.name)}</h2><p>${escape(agency.background)}</p></section>`)
const server = createServer((request, response) => {
  const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
  const agency = data.agencies.find((entry) => `/${entry.id}` === path)
  response.setHeader('Content-Type', 'text/html; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.writeHead(path === '/' || agency ? 200 : 404)
  response.end(path === '/' ? overview() : agency ? detail(agency) : 'Not found')
})
server.listen(8842, '127.0.0.1', () => console.log('Agency WIP structure preview: http://127.0.0.1:8842/'))
