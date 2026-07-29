import { defineConfig, devices } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'

// .env.local 을 읽어 라이브 친구 방 테스트(room-live)가 env 를 인식하게 합니다.
// 주의: 값의 따옴표를 벗겨야 합니다 — process.env 는 Vite 의 .env 파싱보다 우선합니다.
if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line.trim())
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^"(.*)"$/, '$1')
    }
  }
}

/**
 * Phase 1.5 — 시각적 QA와 전체 흐름 검증.
 * `npm run test:e2e` 가 Vite 개발 서버를 자동으로 띄우고 종료 시 정리합니다.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  outputDir: './test-results',
  use: {
    baseURL: 'http://localhost:5283',
    viewport: { width: 1440, height: 1000 },
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/camera-diagnostics.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
        },
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: 'chromium-camera',
      testMatch: '**/camera-diagnostics.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5285',
        launchOptions: {
          args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
        },
        viewport: { width: 1440, height: 1000 },
      },
    },
  ],
  /**
   * 서버 2대를 띄웁니다.
   * - 5283: 기본 빌드 (캠퍼스 플래그 OFF) → 기존 화면 회귀 + OFF 회귀 검사
   * - 5284: 캠퍼스 플래그 ON → 캠퍼스 테마·영토전 검사 (mock 저장소)
   *
   * Vite 는 VITE_ 로 시작하는 process.env 를 그대로 노출하므로,
   * .env 파일을 건드리지 않고 서버별 플래그를 다르게 줄 수 있습니다.
   */
  webServer: [
    {
      command: 'npm run dev -- --port 5283 --strictPort',
      url: 'http://localhost:5283',
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: {
        VITE_ENABLE_AI_REPORT: 'true',
        AI_REPORT_MOCK: 'true',
      },
    },
    {
      command: 'npm run dev -- --port 5284 --strictPort',
      url: 'http://localhost:5284',
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: {
        VITE_ENABLE_CAMPUS_THEME: 'true',
        VITE_ENABLE_CAMPUS_TERRITORY: 'true',
        // Supabase 저장소는 켜지 않습니다. Preview·E2E 는 mock 으로 확인합니다.
        VITE_ENABLE_CAMPUS_SUPABASE: 'false',
        VITE_ENABLE_QA_LAB: 'true',
        VITE_ENABLE_AI_REPORT: 'true',
        AI_REPORT_MOCK: 'true',
      },
    },
    {
      command: 'npm run dev -- --port 5285 --strictPort',
      url: 'http://localhost:5285',
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: {
        VITE_ENABLE_CAMERA: 'true',
        VITE_ENABLE_AI_REPORT: 'true',
        AI_REPORT_MOCK: 'true',
      },
    },
  ],
})
