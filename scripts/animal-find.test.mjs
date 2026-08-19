import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const html = readFileSync('prototypes/openworld/index.html', 'utf8')
const engine = readFileSync('prototypes/openworld/animal-find-engine.mjs', 'utf8')

assert.match(html, /const ANIMAL_FIND =/)
assert.match(html, /animal-find-engine\.mjs/)
assert.match(html, /panel: 'animalFind'/)
assert.match(html, /title: '동물 기억력 게임'/)
assert.match(html, /data-do="animal-find-start"/)
assert.match(html, /data-animal-memory-index/)
assert.match(html, /PREVIEW/)
assert.match(html, /girin\.animalMemory\.highScore/)
assert.match(html, /handleAnimalFindPress/)
assert.match(html, /animal-memory-card-inner/)
assert.match(html, /window\.ANIMAL_FIND_ENGINE/)
assert.match(html, /clearAnimalFindTimers/)
assert.match(html, /resolveTimerId/)
assert.match(html, /if \(handleAnimalFindPress\(e\.target\)\)/)
assert.match(html, /transition:transform \.18s ease/)
assert.match(html, /cv\.addEventListener\('pointerup'/)
/* 관문 간판은 MINIGAMES 표에서 나옵니다 — 관문 넷이 미니게임관 안으로
   들어가면서 paintGates 가 표를 훑는 구조가 됐습니다. gateCanvas 를
   손으로 부르는 줄은 이제 없고, 확인할 것은 표 쪽입니다. */
assert.match(html, /name: '기억력 카드', panel: 'animalFind',[\s\S]{0,120}?prop: 'gateB'/)
assert.match(html, /name: '기억력 카드', panel: 'animalFind'/)
assert.doesNotMatch(html, /name: '동물 찾기 챌린지', panel: 'animalFind'/)
assert.doesNotMatch(html, /x: 32, y: 7, name: '기린 목 쌓기', panel: 'giraffeStack'/)
assert.match(engine, /kubowania\/memory-game/)

console.log('animal find wiring: OK')
