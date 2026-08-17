import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const html = readFileSync('prototypes/openworld/index.html', 'utf8')

assert.match(html, /const ANIMAL_MATCH3 =/)
assert.match(html, /동물 3매칭/)
for (const animal of ['거북이', '기린', '펭귄', '햄스터', '개구리', '고슴도치', '알파카', '백조']) {
  assert.match(html, new RegExp(animal))
}
assert.match(html, /panel: 'animalMatch3'/)
assert.doesNotMatch(html, /panel: 'turtleMaze'/)
assert.match(html, /function swapAnimalMatch3/)
assert.match(html, /function resolveAnimalMatch3/)

console.log('animal match-3 wiring: OK')
