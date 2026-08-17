import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const html = readFileSync('prototypes/openworld/index.html', 'utf8')
const engine = readFileSync('prototypes/openworld/animal-match3-engine.mjs', 'utf8')

assert.match(html, /const ANIMAL_MATCH3 =/)
assert.match(html, /동물 매칭 퍼즐/)
for (const animal of ['거북이', '기린', '펭귄', '햄스터', '개구리', '고슴도치', '알파카', '백조']) {
  assert.match(html, new RegExp(animal))
}
assert.match(html, /panel: 'animalMatch3'/)
assert.doesNotMatch(html, /panel: 'turtleMaze'/)
assert.match(html, /function openPanel\(key\)[\s\S]*activePanelKey = key/)
assert.match(html, /function swapAnimalMatch3/)
assert.match(html, /animal-match3-engine\.mjs/)
assert.match(html, /24번의 Move/)
assert.match(html, /게임 방법/)
assert.match(html, /data-do="animal-match3-start"/)
assert.match(engine, /Ghamza-Jd\/Match-3/)
assert.match(html, /pointerdown[\s\S]*handleAnimalMatch3Press/)
assert.match(html, /touchstart[\s\S]*handleAnimalMatch3Press/)
assert.match(html, /addEventListener\('pointerdown'/)
assert.doesNotMatch(html, /ANIMAL_MATCH3\.timer\s*[=:]/)
assert.match(html, /girin\.match3\.highScore/)
assert.match(html, /ANIMAL_MATCH3\.state = 'PROCESSING'/)
assert.match(html, /animalMatch3Cross/)
assert.match(html, /무지개 블록/)
assert.match(html, /라인 블록/)

console.log('animal match-3 wiring: OK')
