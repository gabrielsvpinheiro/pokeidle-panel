import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

const N = 1024
const buf = Buffer.alloc(N * N * 4)
const c = N / 2
const R = N * 0.46

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let v = n
  for (let k = 0; k < 8; k++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1
  return v >>> 0
})
const crc = (b) => {
  let v = 0xffffffff
  for (const x of b) v = crcTable[(v ^ x) & 0xff] ^ (v >>> 8)
  return (v ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const sum = Buffer.alloc(4)
  sum.writeUInt32BE(crc(body))
  return Buffer.concat([len, body, sum])
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v * (1 - t) + b[i] * t))

for (let y = 0; y < N; y++) {
  for (let x = 0; x < N; x++) {
    const dx = x + 0.5 - c
    const dy = y + 0.5 - c
    const d = Math.hypot(dx, dy)
    const i = (y * N + x) * 4
    let px = [0, 0, 0, 0]
    const edge = Math.min(1, Math.max(0, R - d + 0.5))
    if (edge > 0) {
      const ink = [27, 29, 41]
      let col
      if (d > R - N * 0.035) col = ink
      else if (Math.abs(dy) < N * 0.04) col = ink
      else if (d < N * 0.115 && d > N * 0.07) col = ink
      else if (d <= N * 0.07) col = [244, 245, 248]
      else if (dy < 0) col = mix([227, 53, 13], [255, 120, 80], Math.max(0, 1 - Math.hypot(dx + N * 0.2, dy + N * 0.25) / (N * 0.3)) * 0.6)
      else col = [244, 245, 248]
      px = [...col, Math.round(255 * edge)]
    }
    buf.set(px, i)
  }
}

const raw = Buffer.alloc((N * 4 + 1) * N)
for (let y = 0; y < N; y++) {
  raw[y * (N * 4 + 1)] = 0
  buf.copy(raw, y * (N * 4 + 1) + 1, y * N * 4, (y + 1) * N * 4)
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(N, 0)
ihdr.writeUInt32BE(N, 4)
ihdr[8] = 8
ihdr[9] = 6
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])
mkdirSync('build', { recursive: true })
writeFileSync('build/icon.png', png)
console.log('build/icon.png written')
