/* 배경음악 배선 시험 — 파일 · 표 · 출처가 셋 다 같은 것을 가리키는가.
 *
 * 왜 이 시험이 필요한가: 소리는 **조용히** 깨집니다. 그림이 빠지면 빈
 * 네모가 보이지만 음악이 빠지면 화면은 멀쩡하고, 사람은 이 월드가 원래
 * 조용한 줄 압니다. 파일 이름을 하나 바꾸고 표를 안 고치면 그날부터
 * 도서관이 무음인데 아무도 모릅니다.
 *
 * 그리고 라이선스. CC0 만 싣기로 했는데 그 약속을 지키는 유일한 방법은
 * "실린 파일이 전부 CREDITS.md 에 적혀 있다" 를 기계가 세는 것입니다.
 * 사람이 파일 하나를 슬쩍 넣고 출처를 안 적으면 발표 자리에서 답이
 * 안 나옵니다.
 *
 * index.html 은 빌드가 없는 단일 HTML 이라 import 할 수 없습니다.
 * 필요한 표만 원문에서 잘라 그 자리에서 만듭니다(openworld-links.test.mjs
 * 와 같은 수법입니다).
 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'

const HTML = 'prototypes/openworld/index.html'
const DIR = 'prototypes/openworld/assets/audio'
const CREDITS = 'docs/audio/CREDITS.md'

const html = readFileSync(HTML, 'utf8')
const credits = readFileSync(CREDITS, 'utf8')

/** `const NAME = { … };` 한 덩어리를 잘라 실제 객체로 만듭니다. */
function table(name) {
  const src = html.match(new RegExp('const ' + name + ' = \\{[\\s\\S]*?\\n\\};'))?.[0]
  assert.ok(src, name + ' 을 index.html 에서 못 찾았습니다')
  // eslint-disable-next-line no-new-func
  return new Function('return (' + src.replace('const ' + name + ' =', '').replace(/;\s*$/, '') + ')')()
}

const MUSIC = table('MUSIC')
const ZONE_TRACK = table('ZONE_TRACK')

/* ---- 1. 표와 폴더가 정확히 같은 집합인가 ----
   표에만 있으면 404 가 나고, 폴더에만 있으면 아무도 안 부르는 파일이
   배포본에 실려 나갑니다. 후자가 더 위험합니다 — 출처를 안 적은 음원이
   조용히 배포되는 길이 그것뿐입니다. */
const onDisk = readdirSync(DIR).filter((f) => f.endsWith('.ogg')).sort()
const inTable = Object.values(MUSIC).map((m) => m.file).sort()
assert.deepEqual(inTable, onDisk, 'MUSIC 표와 assets/audio 폴더가 다릅니다')
assert.ok(onDisk.length >= 6, '곡이 여섯 개도 안 됩니다: ' + onDisk.length)

/* ---- 2. 이름과 길이 ---- */
for (const [id, m] of Object.entries(MUSIC)) {
  assert.ok(m.name && m.name.trim(), id + ' 에 사람이 읽을 이름이 없습니다')
  assert.ok(m.by && m.by.trim(), id + ' 에 원저작자(by)가 없습니다')
  assert.ok(typeof m.sec === 'number' && m.sec > 5,
    id + ' 의 sec 이 이상합니다: ' + m.sec)
  const bytes = statSync(`${DIR}/${m.file}`).size
  assert.ok(bytes > 10_000, m.file + ' 가 너무 작습니다: ' + bytes + 'B')
  /* 이 월드는 앞뒤로 걸어 다니는 프로토타입입니다. 곡 하나가 1.5MB 를
     넘으면 문을 지날 때마다 그만큼을 받습니다. */
  assert.ok(bytes < 1_500_000, m.file + ' 가 너무 큽니다: ' + bytes + 'B')
}

/* ---- 3. 예산 ---- */
const total = onDisk.reduce((s, f) => s + statSync(`${DIR}/${f}`).size, 0)
assert.ok(total < 12 * 1024 * 1024,
  '배경음악 합계가 12MB 예산을 넘었습니다: ' + total + 'B')

/* ---- 4. 장소별 기본 곡이 표 안의 곡을 가리키는가 ----
   오타 하나면 그 방만 조용해지는데, 걸어 보기 전에는 안 보입니다. */
const zones = ['library', 'mainhall', 'dorm', 'union', 'campus', 'arcade', 'clubshop']
for (const z of zones) {
  assert.ok(ZONE_TRACK[z], z + ' 에 기본 곡이 없습니다')
  assert.ok(MUSIC[ZONE_TRACK[z]], z + ' → ' + ZONE_TRACK[z] + ' 라는 곡이 표에 없습니다')
}
/* 도서관과 본관은 **일부러** 같은 곡입니다. 둘 다 오래 앉는 자리라
   음악까지 다르면 공간이 아니라 곡이 기억에 남습니다. 이 줄이 깨졌다면
   결정을 바꾼 것이므로, 코드 주석도 같이 고쳐야 합니다. */
assert.equal(ZONE_TRACK.library, ZONE_TRACK.mainhall,
  '도서관과 본관은 같은 곡을 씁니다 (index.html ZONE_TRACK 주석 참고)')

/* ---- 5. 저장된 값 호환 ----
   예전 판본에서 곡을 골라 둔 사람의 girin.room.bgmTrack 에 이 넷이
   들어 있습니다. 이름을 바꾸면 그 사람의 선택이 조용히 무음이 됩니다. */
for (const legacy of ['calm', 'bright', 'warm', 'night']) {
  assert.ok(MUSIC[legacy], '옛 id ' + legacy + ' 가 사라졌습니다 — 저장된 선택이 깨집니다')
}

/* ---- 6. 라이선스 — 실린 파일이 전부 CREDITS.md 에 있는가 ----
   여기가 이 시험의 본체입니다. CC0 만 싣기로 한 약속을 지키는 방법은
   "실린 것과 적힌 것이 같다" 를 세는 것뿐입니다. */
for (const f of onDisk) {
  assert.ok(credits.includes('`' + f + '`'), f + ' 가 CREDITS.md 에 없습니다')
}
for (const [, m] of Object.entries(MUSIC)) {
  assert.ok(credits.includes(m.by), m.by + ' 가 CREDITS.md 에 없습니다')
}
/* 파일 수만큼 freesound 주소가 있어야 합니다. 하나라도 모자라면 어떤
   곡의 출처가 안 적힌 것입니다. */
const sources = credits.match(/https:\/\/freesound\.org\/s\/\d+\//g) || []
assert.ok(new Set(sources).size >= onDisk.length,
  '출처 주소가 곡 수보다 적습니다: ' + new Set(sources).size + ' < ' + onDisk.length)
/* 실린 파일의 **표 줄**을 한 줄씩 읽어 라이선스 칸을 확인합니다.
   §2 전체를 문자열로 훑으면 안 됩니다 — 본문에 "원곡이 CC-BY 였다면"
   같은 설명이 있고, 그걸 위반으로 세면 설명을 못 쓰게 됩니다. */
for (const f of onDisk) {
  const row = credits.split('\n').find((l) => l.startsWith('|') && l.includes('`' + f + '`'))
  assert.ok(row, f + ' 의 표 줄을 CREDITS.md 에서 못 찾았습니다')
  assert.ok(/\*\*CC0 1\.0\*\*/.test(row), f + ' 의 라이선스가 CC0 1.0 이 아닙니다: ' + row)
  assert.ok(/https:\/\/freesound\.org\/s\/\d+\//.test(row), f + ' 의 표 줄에 출처 주소가 없습니다')
  assert.ok(/20\d\d-\d\d-\d\d/.test(row), f + ' 의 표 줄에 확인 날짜가 없습니다')
  for (const bad of ['CC BY', 'CC-BY', 'Attribution 4.0', 'Pixabay Content License']) {
    assert.ok(!row.includes(bad), f + ' 의 라이선스 칸에 ' + bad + ' 가 섞였습니다')
  }
}

/* ---- 7. 재생 배선 ---- */
assert.ok(html.includes("const MUSIC_DIR = 'assets/audio/';"),
  '음원 폴더 경로가 바뀌었습니다 — copy-prototypes.mjs 의 검사도 같이 고쳐야 합니다')
assert.ok(/src\.loop = true/.test(html), '이어 돌리기(loop)가 꺼져 있습니다')
assert.ok(html.includes('AUDIO.musicGain.connect(AUDIO.bgmGain)'),
  '음악이 음악 손잡이를 안 지납니다 — 음량을 내리면 앰비언트까지 같이 내려갑니다')
/* 앰비언트는 남깁니다. 이게 지워지면 여섯 공간이 "기본곡이 다른 같은 방"
   이 됩니다(코인에서 공간 차등을 뺀 자리를 소리가 메우기로 했습니다). */
assert.ok(/const AMBIENCE = \{/.test(html), '장소별 앰비언트가 사라졌습니다')
assert.ok(/function noiseBuffer\(/.test(html), '분홍잡음 생성기가 사라졌습니다')
/* 사람이 건드리기 전에는 소리를 안 냅니다. */
assert.ok(/addEventListener\('pointerdown', wakeAudio/.test(html)
  && /if \(audioWoken\) \{ setAmbience\(id\); setMusic\(id\); \}/.test(html),
  '첫 입력 전에 소리가 날 수 있습니다')

/* ---- 8. 설정 화면 ---- */
assert.ok(html.includes("chips('bgmTrack'"), '곡 고르는 칩이 없습니다')
assert.ok(html.includes("['off', '끔']"), '음악을 끄는 칸이 없습니다')
assert.ok(html.includes("['auto', '장소 따라']"), '"장소 따라" 가 없습니다')
assert.ok(html.includes('id="musvol"'), '음량 손잡이가 없습니다')
assert.ok(html.includes("loadJSON('girin.music'") && html.includes("saveJSON('girin.music'"),
  '음량이 girin.* 열쇠로 저장되지 않습니다')
assert.ok(html.includes('data-do="spotify-open"'), '스포티파이를 여는 단추가 없습니다')
assert.ok(html.includes('스포티파이 재생을 조종할 수 없어요'),
  '스포티파이를 조종할 수 없다는 말이 화면에 없습니다')
/* SDK 를 붙이지 않기로 했습니다. 붙이면 로그인·프리미엄·기기 선택이
   따라오고 그러고도 조종은 스포티파이가 허락하는 만큼만 됩니다. */
assert.ok(!/sdk\.scdn\.co|Spotify\.Player|spotify-player\.js/.test(html),
  '스포티파이 SDK 를 붙이면 안 됩니다')

/* ---- 9. 새 탭 주소 ----
   여기가 뚫리면 사람이 붙여 넣은 글자가 그대로 window.open 에 들어갑니다. */
const linkSrc = html.match(/function spotifyLink\(raw\) \{[\s\S]*?\n\}/)?.[0]
assert.ok(linkSrc, 'spotifyLink 를 못 찾았습니다')
const embedSrc = html.match(/function spotifyEmbed\(raw\) \{[\s\S]*?\n\}/)?.[0]
// eslint-disable-next-line no-new-func
const spotifyLink = new Function(embedSrc + '\nreturn (' + linkSrc + ')')()
assert.equal(spotifyLink('https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ?si=ab'),
  'https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ')
assert.equal(spotifyLink('spotify:track:5678efgh'), 'https://open.spotify.com/track/5678efgh')
for (const bad of ['', 'javascript:alert(1)', 'https://evil.example/open.spotify.com/playlist/abc',
  'https://www.youtube.com/watch?v=abc']) {
  assert.equal(spotifyLink(bad), null, '거절해야 합니다: ' + JSON.stringify(bad))
}

console.log(`[music] 곡 ${onDisk.length}개 · ${(total / 1024 / 1024).toFixed(2)}MiB · `
  + `${Object.values(MUSIC).reduce((s, m) => s + m.sec, 0).toFixed(1)}초 — 표·파일·출처 일치`)
