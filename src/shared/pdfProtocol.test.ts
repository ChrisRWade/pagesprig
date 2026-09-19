import { describe, expect, it } from 'vitest'
import { filePathFromPdfProtocolUrl, pdfProtocolUrl, toPdfBytes } from './pdfProtocol'

describe('pdf protocol urls', () => {
  it('round-trips Windows paths that contain plus signs', () => {
    const filePath = 'C:\\Users\\crwad\\Downloads\\SS3+1.2.1+Student+PDF.pdf'
    const url = pdfProtocolUrl(filePath)
    expect(url.startsWith('pagesprig://local/')).toBe(true)
    expect(filePathFromPdfProtocolUrl(url)).toBe(filePath)
  })

  it('copies Buffer-shaped IPC payloads into a real byte array', () => {
    const bytes = toPdfBytes({ type: 'Buffer', data: [37, 80, 68, 70] })
    expect([...bytes]).toEqual([37, 80, 68, 70])
  })
})
