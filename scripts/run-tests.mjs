/**
 * 단위 테스트 실행 + 수집 누락 감지.
 *
 * 두 벌을 돕니다.
 *   1) src/**  — vitest (jsdom). 아래 수집 누락 감지가 붙는 쪽입니다.
 *   2) scripts/*.test.mjs — node:test. index.html 을 글자로 읽어 배선을
 *      확인하는 통합 시험들입니다.
 *
 * (2)는 오랫동안 **한 번도 안 돌았습니다.** vite.config.ts 의 include 가
 * `src/**\/*.{test,spec}.{ts,tsx}` 라서 vitest 가 아예 안 보고, 따로
 * 부르는 곳도 없었습니다. 파일 10개가 통과하는 줄 알고 있었을 뿐입니다.
 * 이 저장소에서 같은 사고가 build-items.mjs 때도 있었습니다 — 도구가
 * 조용히 죽어 있으면 아무도 모릅니다. 그래서 여기에 묶습니다.
 *
 * vitest 는 워커가 죽어 일부 spec 파일을 돌리지 못해도 종료 코드 0 을
 * 반환합니다(실측 확인). 그래서 "일부만 돌고 통과"로 보일 수 있습니다.
 * 이 래퍼는 실행이 끝난 뒤, 실제로 수집된 파일 수가 디스크의 spec 파일
 * 수와 같은지 확인하고 다르면 실패시킵니다.
 *
 * 사용: npm run test  (인자는 그대로 vitest 로 전달됩니다)
 */
import { spawn } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = 'src'
const SPEC = /\.(spec|test)\.(ts|tsx)$/
const SCRIPTS = 'scripts'
const MJS_SPEC = /\.(spec|test)\.mjs$/

function countSpecFiles(dir) {
  let total = 0
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) total += countSpecFiles(full)
    else if (SPEC.test(entry)) total += 1
  }
  return total
}

const expected = countSpecFiles(SRC)
const args = process.argv.slice(2)

/** scripts/*.test.mjs — node:test. 끝나면 code 를 넘깁니다. */
function runScriptTests() {
  return new Promise((resolve) => {
    const files = readdirSync(SCRIPTS).filter((f) => MJS_SPEC.test(f)).sort()
    if (!files.length) return resolve(0)
    console.log(`\n[run-tests] scripts/ 통합 시험 ${files.length}개 (node:test)`)
    const t = spawn(process.execPath, ['--test', ...files.map((f) => join(SCRIPTS, f))], {
      stdio: 'inherit',
    })
    t.on('close', (c) => resolve(c ?? 1))
  })
}

const child = spawn('npx', ['vitest', 'run', ...args], {
  shell: true,
  stdio: ['inherit', 'pipe', 'inherit'],
})

let output = ''
child.stdout.on('data', (chunk) => {
  const text = String(chunk)
  output += text
  process.stdout.write(text)
})

child.on('close', async (code) => {
  // "Test Files  50 passed (50)" 에서 괄호 안 총 파일 수를 읽습니다.
  const match = output.match(/Test Files\s+.*?\((\d+)\)/)
  const collected = match ? Number(match[1]) : null

  if (code !== 0) process.exit(code ?? 1)

  if (collected === null) {
    console.error(
      '\n[run-tests] 수집된 테스트 파일 수를 확인하지 못했습니다. ' +
        'vitest 출력 형식이 바뀌었는지 확인하세요.',
    )
    process.exit(1)
  }

  if (collected !== expected) {
    console.error(
      `\n[run-tests] 테스트 파일 누락: 디스크에 ${expected}개가 있는데 ` +
        `${collected}개만 실행됐습니다.\n` +
        '워커가 죽어 일부 파일이 빠졌을 수 있습니다(위 출력의 Unhandled Error 확인). ' +
        '다시 실행하거나 vite.config.ts 의 fileParallelism 설정을 확인하세요.',
    )
    process.exit(1)
  }

  console.log(`\n[run-tests] spec 파일 ${collected}/${expected}개 전부 실행됨.`)

  /* vitest 가 다 통과한 뒤에만 갑니다. 앞이 깨졌으면 위에서 이미 나갔습니다. */
  const scriptCode = await runScriptTests()
  if (scriptCode !== 0) {
    console.error('\n[run-tests] scripts/ 통합 시험이 깨졌습니다.')
    process.exit(scriptCode)
  }
})
