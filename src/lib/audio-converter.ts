/**
 * audio-converter.ts
 *
 * Converte audio/webm (gravado pelo MediaRecorder do Chrome) para audio/ogg
 * usando a WebCodecs API nativa do browser (AudioEncoder + AudioData).
 *
 * Por que isso é necessário:
 *   - Chrome grava áudio como audio/webm;codecs=opus
 *   - Meta WhatsApp API aceita o upload mas REJEITA a entrega de audio/webm
 *   - Meta aceita audio/ogg (opus) — mesmo codec, container diferente
 *   - Firefox grava nativo em audio/ogg (ok sem conversão)
 *   - Safari grava nativo em audio/mp4 (ok sem conversão)
 *   - Portanto apenas Chrome precisa da conversão WebM→OGG
 *
 * Implementação: OGG Opus muxer mínimo em TypeScript puro (sem dependências).
 */

// ── OGG CRC-32 (polinômio 0x04c11db7, big-endian, usado pelo Ogg) ─────────────

const OGG_CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let r = i << 24
    for (let j = 0; j < 8; j++) {
      r = (r & 0x80000000) !== 0 ? ((r << 1) ^ 0x04c11db7) : (r << 1)
    }
    t[i] = r >>> 0
  }
  return t
})()

function oggCrc32(data: Uint8Array): number {
  let crc = 0
  for (let i = 0; i < data.length; i++) {
    crc = (((crc << 8) >>> 0) ^ OGG_CRC_TABLE[((crc >>> 24) ^ data[i]) & 0xff]) >>> 0
  }
  return crc
}

// ── OGG page builder ──────────────────────────────────────────────────────────

function buildOggPage(
  payload: Uint8Array,
  serial: number,
  sequence: number,
  granule: bigint,
  bos: boolean,
  eos: boolean,
): Uint8Array {
  // Segment table: each entry ≤ 255; 255 means packet continues in next segment
  const segments: number[] = []
  let rem = payload.length
  while (rem >= 255) { segments.push(255); rem -= 255 }
  segments.push(rem) // terminating entry (< 255)

  const headerLen = 27 + segments.length
  const page = new Uint8Array(headerLen + payload.length)
  const dv = new DataView(page.buffer)

  page[0] = 0x4f; page[1] = 0x67; page[2] = 0x67; page[3] = 0x53 // "OggS"
  page[4] = 0                                                         // structure version
  page[5] = (bos ? 0x02 : 0) | (eos ? 0x04 : 0)                    // header type

  dv.setBigInt64(6, granule, true)      // granule position (int64 LE)
  dv.setUint32(14, serial, true)         // bitstream serial number
  dv.setUint32(18, sequence, true)       // page sequence number
  dv.setUint32(22, 0, true)             // CRC placeholder (must be 0 before computing)
  page[26] = segments.length
  for (let i = 0; i < segments.length; i++) page[27 + i] = segments[i]
  page.set(payload, headerLen)

  dv.setUint32(22, oggCrc32(page), true) // write actual CRC
  return page
}

// ── Opus ID Header (per RFC 7845) ─────────────────────────────────────────────

function buildOpusIdHeader(channels: number, inputSampleRate: number): Uint8Array {
  const h = new Uint8Array(19)
  const dv = new DataView(h.buffer)
  h.set([0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64]) // "OpusHead"
  dv.setUint8(8, 1)                      // version
  dv.setUint8(9, channels)               // channel count
  dv.setUint16(10, 312, true)            // pre-skip (312 ≈ 6.5ms at 48 kHz)
  dv.setUint32(12, inputSampleRate, true) // original sample rate (informational)
  dv.setInt16(16, 0, true)               // output gain: 0 dB
  dv.setUint8(18, 0)                     // channel mapping family 0 (mono/stereo RTP)
  return h
}

// ── Opus Comment Header (per RFC 7845) ───────────────────────────────────────

function buildOpusCommentHeader(): Uint8Array {
  const vendor = 'web-audio-encoder'
  const buf = new Uint8Array(8 + 4 + vendor.length + 4)
  const dv = new DataView(buf.buffer)
  buf.set([0x4f, 0x70, 0x75, 0x73, 0x54, 0x61, 0x67, 0x73]) // "OpusTags"
  dv.setUint32(8, vendor.length, true)
  for (let i = 0; i < vendor.length; i++) buf[12 + i] = vendor.charCodeAt(i)
  dv.setUint32(12 + vendor.length, 0, true) // 0 user comments
  return buf
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Verifica se a WebCodecs API está disponível (Chrome 94+, Firefox 130+). */
export function isAudioConversionSupported(): boolean {
  return (
    typeof AudioEncoder !== 'undefined' &&
    typeof AudioData !== 'undefined' &&
    typeof AudioContext !== 'undefined'
  )
}

/**
 * Converte qualquer blob de áudio decodificável pelo browser (ex: audio/webm)
 * para audio/ogg com codec Opus — formato aceito pela Meta WhatsApp API.
 *
 * @throws se AudioEncoder não estiver disponível ou se a decodificação falhar
 */
export async function convertToOggOpus(inputBlob: Blob): Promise<Blob> {
  if (!isAudioConversionSupported()) {
    throw new Error('WebCodecs AudioEncoder não disponível neste browser')
  }

  // 1. Decodificar o blob para PCM bruto via AudioContext
  const arrayBuffer = await inputBlob.arrayBuffer()
  const audioCtx = new AudioContext({ sampleRate: 48000 })
  let decoded: AudioBuffer
  try {
    decoded = await audioCtx.decodeAudioData(arrayBuffer)
  } finally {
    await audioCtx.close()
  }

  // Forçar mono para voz (WhatsApp usa mono; WebAudio pode dar 2 canais do mic)
  const channels = 1
  const sampleRate = 48000
  const FRAME_SIZE = 960 // 20ms @ 48kHz — frame padrão do Opus

  // Mix-down para mono: média dos canais
  const monoData = new Float32Array(decoded.length)
  for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
    const channelData = decoded.getChannelData(ch)
    for (let i = 0; i < decoded.length; i++) {
      monoData[i] += channelData[i] / decoded.numberOfChannels
    }
  }

  // 2. Encodar PCM → Opus via WebCodecs AudioEncoder
  const opusFrames: Uint8Array[] = []

  await new Promise<void>((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const encoder = new (AudioEncoder as any)({
      output: (chunk: { byteLength: number; copyTo: (dest: Uint8Array) => void }) => {
        const frame = new Uint8Array(chunk.byteLength)
        chunk.copyTo(frame)
        opusFrames.push(frame)
      },
      error: reject,
    })

    encoder.configure({
      codec: 'opus',
      sampleRate,
      numberOfChannels: channels,
      bitrate: 32000, // 32 kbps — adequado para voz
    })

    const totalFrames = Math.ceil(monoData.length / FRAME_SIZE)
    for (let fi = 0; fi < totalFrames; fi++) {
      const frame = new Float32Array(FRAME_SIZE) // padding com zeros no último frame
      const src = fi * FRAME_SIZE
      frame.set(monoData.subarray(src, Math.min(src + FRAME_SIZE, monoData.length)))

      const timestamp = Math.round(fi * FRAME_SIZE * 1e6 / sampleRate) // microseconds

      encoder.encode(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new (AudioData as any)({
          format: 'f32-interleaved',
          sampleRate,
          numberOfFrames: FRAME_SIZE,
          numberOfChannels: channels,
          timestamp,
          data: frame,
        })
      )
    }

    encoder.flush().then(() => { encoder.close(); resolve() }).catch(reject)
  })

  // 3. Empacotar frames Opus no container OGG
  const PRE_SKIP = 312
  const serial = (Math.random() * 0x7fffffff) | 0
  const pages: Uint8Array[] = []
  let seq = 0

  // Página ID Header (BOS — Beginning of Stream)
  // Granule = -1 (0xFFFFFFFFFFFFFFFF) para header pages, conforme RFC 7845 §3
  pages.push(buildOggPage(
    buildOpusIdHeader(channels, decoded.sampleRate),
    serial, seq++, BigInt(-1), true, false
  ))

  // Página Comment Header
  pages.push(buildOggPage(
    buildOpusCommentHeader(),
    serial, seq++, BigInt(-1), false, false
  ))

  // Páginas de áudio (1 pacote Opus por página)
  for (let i = 0; i < opusFrames.length; i++) {
    const isLast = i === opusFrames.length - 1
    const granule = BigInt(PRE_SKIP + (i + 1) * FRAME_SIZE)
    pages.push(buildOggPage(opusFrames[i], serial, seq++, granule, false, isLast))
  }

  // Montar buffer final
  const totalBytes = pages.reduce((acc, p) => acc + p.byteLength, 0)
  const output = new Uint8Array(totalBytes)
  let offset = 0
  for (const p of pages) { output.set(p, offset); offset += p.byteLength }

  return new Blob([output], { type: 'audio/ogg' })
}
