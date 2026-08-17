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
assert.match(html, /cv\.addEventListener\('pointerup'/)
assert.match(html, /gateCanvas\('gateB', '기억력 카드'/)
assert.match(html, /name: '기억력 카드', panel: 'animalFind'/)
assert.doesNotMatch(html, /name: '동물 찾기 챌린지', panel: 'animalFind'/)
assert.doesNotMatch(html, /x: 32, y: 7, name: '기린 목 쌓기', panel: 'giraffeStack'/)
assert.match(engine, /kubowania\/memory-game/)

console.log('animal find wiring: OK')
