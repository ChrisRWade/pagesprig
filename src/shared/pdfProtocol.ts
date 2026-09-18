export const PDF_SCHEME = 'study-pdf'

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(encoded: string): Uint8Array {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const withPad = padded.length % 4 === 0 ? padded : `${padded}${'='.repeat(4 - (padded.length % 4))}`
  const binary = atob(withPad)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function pdfProtocolUrl(filePath: string): string {
  return `${PDF_SCHEME}://local/${toBase64Url(new TextEncoder().encode(filePath))}`
}

export function filePathFromPdfProtocolUrl(requestUrl: string): string | null {
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== `${PDF_SCHEME}:`) return null
    const encoded = url.pathname.replace(/^\/+/, '')
    if (!encoded) return null
    return new TextDecoder().decode(fromBase64Url(encoded))
  } catch {
    return null
  }
}

export function toPdfBytes(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) {
    const copy = new Uint8Array(data.byteLength)
    copy.set(data)
    return copy
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data.slice(0))
  }
  if (ArrayBuffer.isView(data)) {
    const view = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    const copy = new Uint8Array(view.byteLength)
    copy.set(view)
    return copy
  }
  if (data && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)) {
    return Uint8Array.from((data as { data: number[] }).data)
  }
  throw new Error('StudyPDF could not read that worksheet from the schoolwork folder.')
}
