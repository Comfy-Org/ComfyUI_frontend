/**
 * The loading tiles. One shared WebGL context renders every developing tile,
 * then blits into each tile's own 2D canvas: browsers cap live WebGL contexts
 * at about sixteen, so a context per tile would break at four rows.
 */

const VERTEX = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'
// The palette is the brand ink, mauve, plum and canvas, as shader constants.
const FRAGMENT = `precision mediump float;uniform vec2 r;uniform float t,s;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+17.;a*=.5;}return v;}
void main(){
  vec2 uv=gl_FragCoord.xy/r; vec2 p=uv*vec2(r.x/r.y,1.)*2.2+s*13.7; float tt=t*.12;
  vec2 q=vec2(fbm(p+tt),fbm(p+vec2(5.2,1.3)-tt));
  float f=fbm(p+2.*q+vec2(tt*.7,-tt*.4));
  vec3 ink=vec3(.129,.098,.153),plum=vec3(.286,.216,.545),mauve=vec3(.302,.216,.384),cv=vec3(.761,.749,.725);
  vec3 c=mix(ink,mauve,smoothstep(.2,.75,f));
  c=mix(c,plum,smoothstep(.45,.95,q.x)*.75);
  c+=cv*pow(smoothstep(.5,1.,f*q.y*1.7),3.)*.4;
  float b=uv.x+uv.y*.35-mod(t*.22+s,2.6)+.4; c+=cv*exp(-b*b*18.)*.07;
  c*=1.-.35*length(uv-.5);
  gl_FragColor=vec4(c,1.);}`

const TILE_SIDE = 224
const FRAME_MS = 33

interface Tile {
  readonly canvas: HTMLCanvasElement
  readonly context: CanvasRenderingContext2D
  readonly seed: number
}

interface Renderer {
  draw(tile: Tile, time: number): void
}

let renderer: Renderer | null | undefined
const tiles = new Map<HTMLCanvasElement, Tile>()
let frame = 0
let lastFrame = 0
let origin = 0

function createRenderer(): Renderer | null {
  const surface = document.createElement('canvas')
  surface.width = surface.height = 256
  const gl = surface.getContext('webgl', {
    antialias: false,
    premultipliedAlpha: false
  })
  if (!gl) return null
  const program = gl.createProgram()
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERTEX],
    [gl.FRAGMENT_SHADER, FRAGMENT]
  ] as const) {
    const shader = gl.createShader(type)
    if (!shader) return null
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    gl.attachShader(program, shader)
  }
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null
  gl.useProgram(program)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  )
  const position = gl.getAttribLocation(program, 'a')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
  const resolution = gl.getUniformLocation(program, 'r')
  const time = gl.getUniformLocation(program, 't')
  const seed = gl.getUniformLocation(program, 's')
  return {
    draw(tile, at) {
      const { width, height } = tile.canvas
      gl.viewport(0, 0, width, height)
      gl.uniform2f(resolution, width, height)
      gl.uniform1f(time, at)
      gl.uniform1f(seed, tile.seed)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      tile.context.drawImage(
        surface,
        0,
        surface.height - height,
        width,
        height,
        0,
        0,
        width,
        height
      )
    }
  }
}

function loop(now: number) {
  frame = tiles.size ? requestAnimationFrame(loop) : 0
  // About 30fps is plenty for a blurred, upscaled field.
  if (!renderer || now - lastFrame < FRAME_MS) return
  lastFrame = now
  const time = (now - origin) / 1000
  for (const tile of tiles.values()) renderer.draw(tile, time + tile.seed * 40)
}

/** Starts the loading animation on a tile's canvas. */
export function startLoadingTile(
  canvas: HTMLCanvasElement,
  aspect: number,
  seed: number
): void {
  if (renderer === undefined) {
    renderer = createRenderer()
    origin = performance.now()
  }
  const context = canvas.getContext('2d')
  if (!renderer || !context) return
  canvas.width = aspect >= 1 ? TILE_SIDE : Math.round(TILE_SIDE * aspect)
  canvas.height = aspect >= 1 ? Math.round(TILE_SIDE / aspect) : TILE_SIDE
  // The golden ratio spreads consecutive seeds far apart, so the tiles of
  // one row do not move in step.
  const tile = { canvas, context, seed: (seed * 0.6180339887) % 1 }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    renderer.draw(tile, tile.seed * 40)
    return
  }
  tiles.set(canvas, tile)
  if (!frame) frame = requestAnimationFrame(loop)
}

export function stopLoadingTile(canvas: HTMLCanvasElement): void {
  tiles.delete(canvas)
}
