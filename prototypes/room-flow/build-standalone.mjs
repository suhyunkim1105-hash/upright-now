/*
 * 팀원에게 링크로 넘길 단독본을 만듭니다.
 *
 * index.html 은 저장소 안의 Wanted Sans 를 상대경로로 불러옵니다.
 * 파일 하나만 호스팅하면 그 경로가 없어지므로, 여기서 폰트를 base64 로
 * 파일 안에 박아 넣습니다. 외부로 나가는 요청이 하나도 없게 됩니다.
 *
 *   node build-standalone.mjs
 *   → standalone.html
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/* 기본은 이 폴더의 index.html 입니다. 다른 프로토타입도 같은 방식으로
   내보낼 수 있게 경로를 인자로 받습니다.
     node build-standalone.mjs ../color-system/index.html              */
const here = dirname(fileURLToPath(import.meta.url))
const arg = process.argv[2]
const src = arg ? resolve(here, arg) : resolve(here, 'index.html')
/* 저장소에는 유니코드 구간별 92 subset 만 있습니다. 단독본은 어떤 글자가
   나올지 모르므로 자르지 않은 한 벌을 씁니다. (wanted-sans v1.0.3 원본) */
const font = resolve(here, 'WantedSansVariable.woff2')
const out = resolve(dirname(src), 'standalone.html')

const html = readFileSync(src, 'utf8')
const b64 = readFileSync(font).toString('base64')

/* 저장소 CSS 를 부르던 link 태그를 통째로 인라인 @font-face 로 바꿉니다.
   subset 92개 대신 전체 한 벌이라 파일은 커지지만 요청은 0 이 됩니다. */
/* link 앞의 설명 주석은 있을 수도 없을 수도 있습니다. */
const linkPattern = /(?:<!--[\s\S]*?-->\s*)?<link rel="stylesheet" href="\.\.\/\.\.\/public\/fonts[^>]*>/
const inline = `<style>
  /* Wanted Sans Variable — SIL Open Font License 1.1
     https://github.com/wanteddev/wanted-sans
     단독 배포용으로 파일 안에 넣었습니다. 가변 축 400~1000. */
  @font-face {
    font-family: "Wanted Sans Variable";
    src: url(data:font/woff2;base64,${b64}) format("woff2-variations");
    font-weight: 400 1000;
    font-style: normal;
    font-display: swap;
  }
</style>`

if (!linkPattern.test(html)) {
  console.error('폰트 link 태그를 찾지 못했습니다. index.html 이 바뀌었는지 확인하세요.')
  process.exit(1)
}

let result = html.replace(linkPattern, inline)

/* 방 만들기 단독본은 시연이 목적이므로 전체 화면으로 시작합니다.
   (이 문자열이 없는 문서에서는 아무 일도 일어나지 않습니다.) */
result = result.replace(
  "var on = new URLSearchParams(location.search).get('full') === '1';",
  "var on = new URLSearchParams(location.search).get('full') !== '0';",
)

writeFileSync(out, result, 'utf8')

const mb = (n) => (n / 1024 / 1024).toFixed(2)
console.log(`standalone.html  ${mb(Buffer.byteLength(result))} MB  (폰트 ${mb(b64.length)} MB 포함)`)
