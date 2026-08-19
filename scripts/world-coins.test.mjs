import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const save = readFileSync('prototypes/openworld/save.js', 'utf8')
const html = readFileSync('prototypes/openworld/index.html', 'utf8')

/* 2026-08-19 — 상점을 여는 순간 모아 둔 코인이 0 이 되던 일.
   world_coins 에 행이 생기는 것은 **첫 세션을 끝냈을 때**입니다. 그 전까지
   서버는 이 사람을 모르는데, balance() 가 "행이 없음" 을 0 으로 답했습니다.
   refreshShopCoins 가 그 0 을 받아 로컬 잔액을 덮고 저장까지 했습니다. */

test('balance() 는 행이 없을 때 0 이 아니라 null 을 돌려줍니다', () => {
  const fn = save.match(/async function balance\(\)[\s\S]*?\n  \}/)?.[0] ?? ''
  assert.ok(fn, 'balance() 를 찾지 못했습니다')
  assert.match(fn, /rows\.length \? rows\[0\]\.balance : null/)
  assert.doesNotMatch(fn, /rows\.length \? rows\[0\]\.balance : 0/)
})

test('잔액을 쓰는 곳은 전부 숫자인지 먼저 봅니다', () => {
  /* null 이 흘러도 로컬 값을 안 건드려야 합니다. 셋 다 typeof 로 막습니다. */
  assert.match(html, /function applyServerBalance\(balance\) \{\s*\n\s*if \(typeof balance !== 'number'\) return;/)
  assert.match(html, /if \(typeof b !== 'number' \|\| b === ROOM\.coins\) return;/)
  assert.match(html, /if \(typeof r\.balance === 'number' && r\.balance !== ROOM\.coins\)/)
})

console.log('world coins: OK')
