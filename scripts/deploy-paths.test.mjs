/* 배포 설정이 주소를 건드리면 프로토타입이 통째로 깨집니다.
 *
 * 이 저장소에서 두 번 났습니다.
 *
 *  1. rewrites 로 SPA 를 흉내 냈을 때 — 없는 파일에도 app.html 을 200 으로
 *     돌려줘서, 랜딩의 대학 로고 다섯 장이 몇 달 동안 "성공한 404" 였습니다.
 *     브라우저 콘솔에도 안 뜹니다. 상태가 200 이니까요.
 *  2. cleanUrls 로 `/index.html` 을 잘랐을 때 — 주소가
 *     `/prototypes/onboarding/index.html` 에서 `/prototypes/onboarding` 이
 *     되면 문서의 기준 폴더가 한 단계 올라갑니다. 그러면 온보딩의
 *     `../shared/posture.js` 가 `/shared/posture.js` 를 찾아 404 가 되고,
 *     자세 엔진·학교 인증·캐릭터 8장이 배포에서만 사라집니다.
 *
 * 둘 다 로컬에서는 절대 안 보입니다. 파일이 옆에 있으니까요.
 *
 * 프로토타입은 단일 HTML 이라 상대경로로 서로를 부릅니다. 그래서 이
 * 저장소의 배포 설정은 **주소를 그대로 두는 것** 이 계약입니다.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const cfg = JSON.parse(readFileSync('vercel.json', 'utf8'))

for (const key of ['cleanUrls', 'rewrites', 'trailingSlash', 'redirects']) {
  assert.ok(
    !(key in cfg),
    `vercel.json 의 ${key} 는 주소를 바꿉니다. 프로토타입은 상대경로로 ` +
      `서로를 부르므로 배포에서만 404 가 납니다 — 이 파일 머리말 참고`,
  )
}

console.log('배포 설정이 주소를 안 건드림: OK')
