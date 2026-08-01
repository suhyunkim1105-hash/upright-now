import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'

import { handleAiReport } from './ai-report-handler.js'

export const maxDuration = 15

function toHeaders(headers: IncomingHttpHeaders): Headers {
  const result = new Headers()

  for (const [name, value] of Object.entries(headers)) {
    if (typeof value !== 'undefined') {
      result.set(name, Array.isArray(value) ? value.join(', ') : value)
    }
  }

  return result
}

async function toRequestBody(request: IncomingMessage): Promise<string | undefined> {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return undefined
  }

  const chunks: Uint8Array[] = []
  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }

  return Buffer.concat(chunks).toString('utf8')
}

function toRequestUrl(request: IncomingMessage): string {
  const host = request.headers.host ?? 'localhost'
  const forwardedProtocol = request.headers['x-forwarded-proto']
  const protocol = (Array.isArray(forwardedProtocol) ? forwardedProtocol[0] : forwardedProtocol ?? 'https').split(',')[0]

  return `${protocol}://${host}${request.url ?? '/'}`
}

export default async function aiReport(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const webResponse = await handleAiReport(
    new Request(toRequestUrl(request), {
      body: await toRequestBody(request),
      headers: toHeaders(request.headers),
      method: request.method ?? 'GET',
    }),
  )

  response.statusCode = webResponse.status
  webResponse.headers.forEach((value, name) => response.setHeader(name, value))
  response.end(Buffer.from(await webResponse.arrayBuffer()))
}
