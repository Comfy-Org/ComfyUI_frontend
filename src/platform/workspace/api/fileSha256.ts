const CHUNK_BYTES = 4 * 1024 * 1024

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
])

const INITIAL_STATE = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
  0x1f83d9ab, 0x5be0cd19
]

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n))
}

function compressBlocks(
  state: Uint32Array,
  words: Uint32Array,
  bytes: Uint8Array,
  end: number
) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  for (let offset = 0; offset < end; offset += 64) {
    for (let i = 0; i < 16; i++) words[i] = view.getUint32(offset + i * 4)
    for (let i = 16; i < 64; i++) {
      const w15 = words[i - 15]
      const w2 = words[i - 2]
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3)
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10)
      words[i] = (words[i - 16] + s0 + words[i - 7] + s1) | 0
    }
    let [a, b, c, d, e, f, g, h] = state
    for (let i = 0; i < 64; i++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const t1 = (h + s1 + ((e & f) ^ (~e & g)) + K[i] + words[i]) | 0
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const t2 = (s0 + ((a & b) ^ (a & c) ^ (b & c))) | 0
      h = g
      g = f
      f = e
      e = (d + t1) | 0
      d = c
      c = b
      b = a
      a = (t1 + t2) | 0
    }
    for (const [i, value] of [a, b, c, d, e, f, g, h].entries()) {
      state[i] += value
    }
  }
}

export async function fileSha256(
  file: Blob,
  signal?: AbortSignal
): Promise<string | undefined> {
  const state = Uint32Array.from(INITIAL_STATE)
  const words = new Uint32Array(64)
  let rest = new Uint8Array(0)
  for (let start = 0; start < file.size; start += CHUNK_BYTES) {
    const chunk = file.slice(start, start + CHUNK_BYTES)
    const bytes = new Uint8Array(await chunk.arrayBuffer())
    if (signal?.aborted) return undefined
    const whole = bytes.length - (bytes.length % 64)
    compressBlocks(state, words, bytes, whole)
    rest = bytes.subarray(whole)
  }
  const last = new Uint8Array(rest.length < 56 ? 64 : 128)
  last.set(rest)
  last[rest.length] = 0x80
  const view = new DataView(last.buffer)
  view.setUint32(last.length - 8, Math.floor(file.size / 2 ** 29))
  view.setUint32(last.length - 4, (file.size * 8) >>> 0)
  compressBlocks(state, words, last, last.length)
  return Array.from(state, (word) => word.toString(16).padStart(8, '0')).join(
    ''
  )
}
