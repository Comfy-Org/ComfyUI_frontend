
## build-agency-pages.mjs

Sanitized historical reference; substitute placeholders before use. Not a portable, validated build command.

```javascript
import {createRequire} from 'node:module'
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {pathToFileURL} from 'node:url'
const task='<LOCAL_REVIEW_WORKSPACE>'
const repo='<REPOSITORY_ROOT>'
const runtime='<DEPENDENCY_CHECKOUT>'
const r=createRequire(runtime+'/package.json')
const esbuild=r(runtime+'/node_modules/.pnpm/esbuild@0.28.1/node_modules/esbuild')
const {parse,compileScript,compileTemplate}=r('vue/compiler-sfc')
const {createSSRApp}=r('vue')
const {renderToString}=r('vue/server-renderer')
const {compile}=createRequire(r.resolve('@tailwindcss/vite'))('@tailwindcss/node')
const base=repo+'/apps/website/src/templates/agency-partnership'
const out=task+'/agency-pages-review'
mkdirSync(out,{recursive:true})
const srcs=[]
const plugin={name:'vue-review',setup(build){
 build.onResolve({filter:/^@\//},a=>{const path=repo+'/apps/website/src/'+a.path.slice(2);return {path:existsSync(path)?path:existsSync(path+'.ts')?path+'.ts':path}})
 build.onResolve({filter:/^[^./]/},a=>({path:createRequire((a.importer || runtime+'/package.json').replace(repo,runtime)).resolve(a.path),external:!a.path.startsWith('@comfyorg/')}))
 build.onLoad({filter:/\.ts$/},a=>{srcs.push(readFileSync(a.path,'utf8'));return undefined})
 build.onLoad({filter:/\.vue$/},a=>{
  const source=readFileSync(a.path,'utf8');srcs.push(source)
  const {descriptor}=parse(source,{filename:a.path.replace(repo,runtime)})
  const code=descriptor.script || descriptor.scriptSetup ? compileScript(descriptor,{id:a.path,inlineTemplate:true,propsDestructure:!a.path.endsWith('/SiteVideo.vue')}).content : compileTemplate({source:descriptor.template.content,filename:a.path,id:a.path}).code+'\nexport default {render}'
  return {contents:code,loader:'ts',resolveDir:a.path.slice(0,a.path.lastIndexOf('/'))}
 })
}}
const components={}
for(const name of ['AgencyOverviewDraft','AgencyDetailDraft']){
 const result=await esbuild.build({entryPoints:[base+'/'+name+'.vue'],bundle:true,platform:'node',format:'cjs',write:false,tsconfigRaw:{},plugins:[plugin],nodePaths:[runtime+'/node_modules'],logLevel:'warning'})
 const file=out+'/'+name+'.cjs';writeFileSync(file,result.outputFiles[0].text);components[name]=r(file).default
}
const assetroot='<LEGACY_LOGO_ROOT>/'
const data=(path,mime)=>'data:'+mime+';base64,'+readFileSync(path).toString('base64')
const specs=[
 ['asteria','Asteria','AI film and animation','Asteria supports filmmakers with studio-scale creative capabilities.','Asteria.png','mailto:hello@asteriafilm.com','https://www.asteriafilm.com/'],
 ['black-math','Black Math','Creative production','Black Math is a design and technology studio working across identity and content.','Black Math.svg','https://blackmath.com/contact','https://blackmath.com/'],
 ['brick-visual','Brick Visual','Architecture and 3D visualization','Brick Visual provides architectural visualization and creative technology services.',null,'https://www.brickvisual.com/request-a-proposal','https://www.brickvisual.com/'],
 ['contender','Contender','Advertising at agency-network scale','Contender combines creative production, private AI infrastructure and team training.',null,'mailto:hello@wearecontender.ai','https://wearecontender.ai/'],
 ['native-foreign','Native Foreign','Motion, VFX and 3D','Native Foreign is a Los Angeles creative studio focused on brand storytelling and original IP.','Native Foreign.png','https://nativeforeign.co/contact','https://nativeforeign.co/'],
 ['silverside','Silverside','Marketing and brand campaigns','Silverside develops AI creative production, content systems and consulting for marketing teams.','Silverside.svg','https://www.silverside.ai/contact','https://www.silverside.ai/']
]
const media=JSON.parse(readFileSync(out+(existsSync(out+'/all-media-provenance.json')?'/all-media-provenance.json':'/media-provenance.json'),'utf8')).map(({reviewNote,...item})=>item)
const originalRoot='<ORIGINAL_ASSET_ROOT>/'
const logos={
'asteria':originalRoot+'Asteria/ASTERIA LOGO WHITE 2026.png',
'black-math':'<PREFERRED_BLACK_MATH_LOGO_ROOT>/BM-Logotype-horizontal [black].svg',
'brick-visual':originalRoot+'Brick Visual/Brick_logo_black.png',
'contender':originalRoot+'Contender/Logo_Dark.svg',
'native-foreign':originalRoot+'Native Foreign/NativeForeign_White.png',
'silverside':originalRoot+'Silverside/White-logo .svg'
}
const specialties={'asteria':['Film','Animation'],'black-math':['Creative production'],'brick-visual':['Architecture','3D visualization'],'contender':['Advertising'],'native-foreign':['Motion','VFX','3D'],'silverside':['Marketing','Brand campaigns']}
const agencies=specs.map(([id,name,specialty,background,logo,contactHref,source])=>({id,name,specialty,specialties:specialties[id],background,logoSrc:data(logos[id],logos[id].endsWith('.svg')?'image/svg+xml':'image/png'),...(id==='brick-visual'?{logoMaskSize:'134.75px 109.82px',logoMaskPosition:'11.95px -31.21px'}:id==='contender'?{logoMaskSize:'188.08px 74.20px',logoMaskPosition:'-14.11px -17.10px',logoMaskMode:'luminance'}:{}),contactHref,contactSource:source,reviewHref:'./'+id+'.html',work:media.filter(x=>x.agencyId===id)}))
const labels={program:'AGENCY PARTNER PROGRAM',explore:'EXPLORE AGENCIES',roster:'Agency partners',about:'About',work:'Selected work',pendingWork:'Work not supplied yet',pendingLogo:'ORIGINAL LOGO PENDING',contact:'CONTACT',pendingContact:'Verified inquiry destination pending',contactTitle:'Work with',back:'ALL AGENCIES',profile:'EXPLORE AGENCY',source:'VIEW ORIGINAL'}
let css=readFileSync(repo+'/apps/website/src/styles/global.css','utf8').replace("'@comfyorg/design-system/css/base.css'",JSON.stringify(repo+'/packages/design-system/src/css/base.css'))
srcs.push(...JSON.parse(readFileSync(task+'/site-shell-sources.json','utf8')))
const {Scanner}=r(runtime+'/node_modules/.pnpm/@tailwindcss+oxide@4.3.2/node_modules/@tailwindcss/oxide')
const candidates=new Scanner({sources:[]}).scanFiles([{content:srcs.join('\n')+' bg-primary-comfy-ink text-primary-warm-white font-formula',extension:'vue'}])
const compiled=await compile(css,{base:runtime+'/apps/website/src/styles',onDependency:()=>{}})
css=compiled.build(candidates).replace(/url\(['"]?\/fonts\/([^)'"\s]+)['"]?\)/g,(match,f)=>existsSync(repo+'/apps/website/public/fonts/'+f)?'url("'+data(repo+'/apps/website/public/fonts/'+f,'font/woff2')+'")':match)
const HeaderMain=r(out+'/HeaderMain.cjs').default
const SiteFooter=r(out+'/SiteFooter.cjs').default
const header=await renderToString(createSSRApp(HeaderMain,{locale:'en'}))
const footer=await renderToString(createSSRApp(SiteFooter,{locale:'en',alternates:[]}))
const wrap=(title,body)=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${title} · Local draft review</title><style>${css}</style></head><body class="overflow-x-clip bg-primary-comfy-ink text-primary-warm-white font-formula"><aside style="background:var(--color-primary-comfy-yellow);color:var(--color-primary-comfy-ink);padding:12px 24px;font:12px/1.5 system-ui">LOCAL DRAFT REVIEW · NOT APPROVED FOR RELEASE</aside><div id="site-header" style="display:contents">${header}</div><main class="overflow-x-clip">${body}</main><div id="site-footer">${footer}</div><script type="module" src="./site-shell.js"></script></body></html>`
writeFileSync(out+'/index.html',wrap('Comfy Agency Partner Program',await renderToString(createSSRApp(components.AgencyOverviewDraft,{agencies,labels,title:'Comfy Agency Partner Program',subtitle:'On Comfy, the open platform for professional creatives.'}))))
for(const agency of agencies)writeFileSync(out+'/'+agency.id+'.html',wrap(agency.name,await renderToString(createSSRApp(components.AgencyDetailDraft,{agency,labels}))))
writeFileSync(out+'/sources.json',JSON.stringify({base:'722a3a57f5e6839fe6279b0d2e53ddaac27a0956',brief:'<REMOVED_PRIVATE_BRIEF>',agencies:agencies.map(({logoSrc,...a})=>a),components:['HeroCentered01','SectionHeader','Card','Button','SiteVideo'],logos,labels},null,2))
console.log('Rendered overview + six agency pages with actual Vue components and compiled website CSS to '+out)

```

## build-site-shell.mjs

Sanitized historical reference; substitute placeholders before use. Not a portable, validated build command.

```javascript
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs'
import {createRequire} from 'node:module'
const task='<LOCAL_REVIEW_WORKSPACE>'
const repo='<REPOSITORY_ROOT>'
const runtime='<DEPENDENCY_CHECKOUT>'
const r=createRequire(runtime+'/package.json')
const esbuild=r(runtime+'/node_modules/.pnpm/esbuild@0.28.1/node_modules/esbuild')
const {parse,compileScript,compileTemplate}=r('vue/compiler-sfc')
const sources=[]
const plugin=(browser)=>({name:'site-shell-vue',setup(build){
 build.onResolve({filter:/^astro:env\/client$/},()=>({path:'local-env',namespace:'local-env'}))
 build.onLoad({filter:/.*/,namespace:'local-env'},()=>({contents:'export const WORKSHOP_DEPLOY_ENV="local";export const WORKSHOP_INCLUDED=false;export const WORKSHOP_LOCAL_DEV=false;export const WORKSHOP_RELEASE="local-review";',loader:'js'}))
 build.onResolve({filter:/^@\//},a=>{let p=repo+'/apps/website/src/'+a.path.slice(2);return {path:existsSync(p)?p:existsSync(p+'.ts')?p+'.ts':p}})
 build.onResolve({filter:/^[^./]/},a=>browser?undefined:({path:createRequire((a.importer||runtime+'/package.json').replace(repo,runtime)).resolve(a.path),external:!a.path.startsWith('@comfyorg/')}))
 build.onLoad({filter:/\?raw$/},a=>({contents:readFileSync(a.path.slice(0,-4),'utf8'),loader:'text'}))
 build.onLoad({filter:/\.ts$/},a=>{sources.push(readFileSync(a.path,'utf8'));return undefined})
 build.onLoad({filter:/\.vue$/},a=>{const source=readFileSync(a.path,'utf8');sources.push(source);const {descriptor}=parse(source,{filename:a.path.replace(repo,runtime)});const code=descriptor.script||descriptor.scriptSetup?compileScript(descriptor,{id:a.path,inlineTemplate:true}).content:compileTemplate({source:descriptor.template.content,filename:a.path,id:a.path}).code+'\nexport default {render}';return {contents:code,loader:'ts',resolveDir:a.path.slice(0,a.path.lastIndexOf('/'))}})
}})
const env={'import.meta.env':JSON.stringify({DEV:true,PROD:false,MODE:'development',BASE_URL:'/'})}
for(const [name,path]of [['HeaderMain','components/common/HeaderMain/HeaderMain.vue'],['SiteFooter','components/common/SiteFooter.vue']]){
 await esbuild.build({entryPoints:[repo+'/apps/website/src/'+path],outfile:task+'/agency-pages-review/'+name+'.cjs',bundle:true,platform:'node',format:'cjs',tsconfigRaw:{},plugins:[plugin(false)],nodePaths:[runtime+'/apps/website/node_modules',runtime+'/node_modules'],define:env,logLevel:'warning'})
}
writeFileSync(task+'/site-shell-client.mjs',`import {createSSRApp} from 'vue';\nimport HeaderMain from '${repo}/apps/website/src/components/common/HeaderMain/HeaderMain.vue';\nimport SiteFooter from '${repo}/apps/website/src/components/common/SiteFooter.vue';\ncreateSSRApp(HeaderMain,{locale:'en'}).mount('#site-header');\ncreateSSRApp(SiteFooter,{locale:'en',alternates:[]}).mount('#site-footer');`)
await esbuild.build({entryPoints:[task+'/site-shell-client.mjs'],outfile:task+'/agency-pages-review/site-shell.js',bundle:true,platform:'browser',format:'esm',tsconfigRaw:{},plugins:[plugin(true)],nodePaths:[runtime+'/apps/website/node_modules',runtime+'/node_modules'],define:{...env,'process.env.NODE_ENV':'"production"'},logLevel:'warning'})
writeFileSync(task+'/site-shell-sources.json',JSON.stringify(sources))
console.log('Built authentic site navigation/footer SSR + interactive browser bundle')

```

## serve-agency-review.mjs

Sanitized historical reference; substitute placeholders before use. Not a portable, validated build command.

```javascript
import {createServer} from 'node:http'
import {statSync,createReadStream,existsSync} from 'node:fs'
import {resolve,extname} from 'node:path'
const root=resolve('<LOCAL_REVIEW_WORKSPACE>/agency-pages-review')
const publicRoot='<REPOSITORY_ROOT>/apps/website/public'
const types={'.html':'text/html; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.svg':'image/svg+xml','.png':'image/png','.mp4':'video/mp4','.json':'application/json','.js':'text/javascript; charset=utf-8','.woff2':'font/woff2'}
createServer((req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost')
  const pathname=decodeURIComponent(url.pathname)
  let path=resolve(root,'.'+pathname)
  if(path===root)path+='/index.html'
  if(!path.startsWith(root+'/'))throw Error('Invalid path')
  if(!existsSync(path)){
   const pub=resolve(publicRoot,'.'+pathname)
   if(pub.startsWith(publicRoot+'/')&&types[extname(pub)]&&existsSync(pub))path=pub
   else if(!extname(pathname)||pathname.endsWith('.html')){res.writeHead(302,{Location:'https://comfy.org'+url.pathname+url.search+url.hash});res.end();return}
   else throw Error('Missing asset')
  }
  const size=statSync(path).size
  res.setHeader('Content-Type',types[extname(path)]||'application/octet-stream')
  res.setHeader('Accept-Ranges','bytes');res.setHeader('Cache-Control','no-store')
  const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/)
  if(range){
   const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),size-1):size-1
   if(start>end){res.writeHead(416);res.end();return}
   res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':end-start+1})
   if(req.method==='HEAD'){res.end();return}createReadStream(path,{start,end}).pipe(res)
  }else{res.writeHead(200,{'Content-Length':size});if(req.method==='HEAD'){res.end();return}createReadStream(path).pipe(res)}
 }catch{res.writeHead(404);res.end('Not found')}
}).listen(8841,'127.0.0.1',()=>console.log('Local-only review: http://127.0.0.1:8841/'))

```
