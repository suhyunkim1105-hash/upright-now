/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import type { IncomingMessage } from 'node:http'
import { handleAiReport } from './api/ai-report-handler'

function readBody(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })
}

function requestHeaders(source: IncomingMessage['headers']): Headers {
  const headers = new Headers()
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'string') headers.set(key, value)
    if (Array.isArray(value)) headers.set(key, value.join(', '))
  }
  return headers
}

function aiReportDevApi(): Plugin {
  return {
    name: 'upright-ai-report-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/ai-report', (request, response) => {
        void (async () => {
          const body = await readBody(request)
          const aiRequest = new Request('http://localhost/api/ai-report', {
            method: request.method,
            headers: requestHeaders(request.headers),
            body: body.byteLength > 0 ? body : undefined,
          })
          const result = await handleAiReport(
            aiRequest,
            process.env.AI_REPORT_MOCK === 'true'
              ? {
                  enabled: true,
                  generate: async () => ({
                    headline: '이번 흐름을 짧게 정리했어요.',
                    reflection: '집중 시간과 회복 행동을 다음 세션의 출발점으로 남겨 보세요.',
                    highlights: [
                      { label: '집중 시간', detail: '계획한 흐름을 끝까지 이어 갔어요.' },
                      { label: '회복 행동', detail: '리셋이 필요할 때 다시 흐름을 만들었어요.' },
                      { label: '다음 시도', detail: '짧은 단위로 바로 이어 가기 좋아요.' },
                    ],
                    nextAction: {
                      title: '2분 정리 후 다시 시작',
                      instruction: '물 한 모금과 다음 할 일을 적고 2분 안에 시작해 보세요.',
                      durationMinutes: 2,
                    },
                  }),
                }
              : undefined,
          )

          response.statusCode = result.status
          result.headers.forEach((value, key) => response.setHeader(key, value))
          response.end(Buffer.from(await result.arrayBuffer()))
        })().catch(() => {
          response.statusCode = 500
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify({ code: 'AI_REPORT_GENERATION_FAILED' }))
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), aiReportDevApi()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // 느린 머신·병렬 실행에서 App 전체 렌더 셋업이 5초를 넘길 수 있어
    // 기본 npm run test 에서도 안정적으로 통과하도록 여유를 둡니다.
    testTimeout: 15000,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
})
