/* node prototypes/campus3d/chat-filter.test.mjs
 *
 * 가리기가 도는지만 봅니다. 사전 자체는 korcen 것이라 여기서 안 셉니다 —
 * 대신 **korcen 이 놓치는 원형**('씨발')과 **오탐 하나**('아저씨발')를
 * 박아 둡니다. 이 둘이 이 파일이 존재하는 이유입니다. */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

/* korcen.js 는 모듈이 아니라 globalThis.Korcen 을 세우는 스크립트입니다 */
new Function(readFileSync(new URL('../shared/korcen.js', import.meta.url), 'utf8'))();
assert.ok(globalThis.Korcen?.isProfane, 'korcen.js 가 안 붙었습니다');

const { maskProfanity, isProfane } = await import('./chat-filter.js');

/* 멀쩡한 말은 손대지 않습니다 */
for (const ok of ['안녕하세요', '같이 공부해요', '시발점은 여기부터야', '아저씨발 조심하세요', '']) {
  assert.equal(maskProfanity(ok), ok, `멀쩡한 말이 가려졌습니다: ${ok}`);
}

/* korcen 이 잡는 것 */
assert.equal(maskProfanity('시발 진짜'), '●● 진짜');
assert.equal(maskProfanity('병신아'), '●●●');

/* korcen 이 놓치는 원형 — EXTRA_BAD 가 받습니다 */
assert.ok(!globalThis.Korcen.isProfane('씨발'), 'korcen 이 씨발을 잡게 됐으면 EXTRA_BAD 를 지우세요');
assert.ok(isProfane('씨발'));
assert.equal(maskProfanity('아 씨발 뭐야'), '아 ●● 뭐야');

/* 낱말을 못 짚으면 문장을 통째로 가립니다 */
assert.equal(maskProfanity('시 발'), '(가려진 말)');

/* 여섯 자를 넘겨도 ● 은 여섯 개까지만 */
assert.equal(maskProfanity('씨발놈아씨발놈아'), '●●●●●●');

/* 문자열이 아닌 것을 넣어도 안 터집니다 */
assert.equal(maskProfanity(null), '');
assert.equal(maskProfanity(undefined), '');

console.log('chat-filter 통과');
