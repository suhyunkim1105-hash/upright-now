import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const html = readFileSync('prototypes/openworld/index.html', 'utf8')

assert.match(html, /'ㅡ': 'm'/)
assert.match(html, /'ㅈ': 'w'/)
assert.match(html, /'ㅁ': 'a'/)
assert.match(html, /'ㄴ': 's'/)
assert.match(html, /'ㅇ': 'd'/)
assert.match(html, /const k = controlKey\(e\.key\)/)
assert.match(html, /keys\.delete\(controlKey\(e\.key\)\)/)

console.log('openworld keyboard aliases: OK')
