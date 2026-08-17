import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const html = readFileSync('prototypes/openworld/index.html', 'utf8')
const bake = html.match(/function bakeMinimap\(\) \{[\s\S]*?\n\}/)?.[0] ?? ''

assert.ok(bake, 'minimap baking function should exist')
assert.match(bake, /m\.over\[at\(m, x, y\)\]/)
assert.match(bake, /autoTile\(m, x, y, mat\)/)
assert.match(bake, /d\.canvas/)
assert.match(bake, /g\.drawImage\(d\.canvas/)
assert.match(bake, /if \(d\.canvas\)/)

console.log('minimap detail wiring: OK')
