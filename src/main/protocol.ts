import { net, protocol } from 'electron'
import { pathToFileURL } from 'node:url'
import { PDF_SCHEME, filePathFromPdfProtocolUrl } from '@shared/pdfProtocol'
import { isInsideRoot } from './storage/errors'
import { loadSettings } from './storage/settingsStore'

export { PDF_SCHEME }

export function registerPdfScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: PDF_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
        bypassCSP: false
      }
    }
  ])
}

export function registerPdfProtocol(): void {
  protocol.handle(PDF_SCHEME, async (request) => {
    try {
      const filePath = filePathFromPdfProtocolUrl(request.url)
      if (!filePath) {
        return new Response('Missing path', { status: 400 })
      }
      const settings = await loadSettings()
      if (!settings.storageRoot || !isInsideRoot(settings.storageRoot, filePath)) {
        return new Response('Forbidden', { status: 403 })
      }
      return net.fetch(pathToFileURL(filePath).href)
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}
