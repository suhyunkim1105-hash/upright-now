/* 바깥 서비스 주소를 푸는 두 함수를 실제로 돌려 봅니다.
 *
 * 왜 정규식 확인이 아니라 실행인가: 이 둘이 만드는 것은 **화면에 그대로
 * 박히는 iframe 주소**입니다. 잘못 만들면 빈 칸이 뜨고, 사람은 자기
 * 인터넷을 의심합니다. 그리고 여기서 거절해야 할 것을 통과시키면
 * 아무 사이트나 창 안에 띄우는 창구가 됩니다.
 *
 * index.html 은 빌드가 없는 단일 HTML 이라 import 할 수 없습니다.
 * 함수 두 개의 원문만 잘라 내어 그 자리에서 만듭니다.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const html = readFileSync('prototypes/openworld/index.html', 'utf8')

function cut(name) {
  const src = html.match(new RegExp('function ' + name + '\\(raw\\) \\{[\\s\\S]*?\\n\\}'))?.[0] ?? ''
  assert.ok(src, name + ' 을 index.html 에서 못 찾았습니다')
  // eslint-disable-next-line no-new-func
  return new Function('return (' + src + ')')()
}

const spotifyEmbed = cut('spotifyEmbed')
const calendarEmbed = cut('calendarEmbed')

/* ---- 스포티파이 ---- */
assert.equal(
  spotifyEmbed('https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ?si=abc123'),
  'https://open.spotify.com/embed/playlist/37i9dQZF1DWZeKCadgRdKQ',
  '공유 링크의 ?si= 꼬리는 떼야 합니다')
assert.equal(
  spotifyEmbed('https://open.spotify.com/intl-ko/album/1234abcd'),
  'https://open.spotify.com/embed/album/1234abcd',
  '언어 조각(intl-ko)이 낀 주소도 받습니다')
assert.equal(
  spotifyEmbed('spotify:track:5678efgh'),
  'https://open.spotify.com/embed/track/5678efgh',
  '앱이 주는 URI 도 받습니다')

/* 거절해야 하는 것 — 여기가 뚫리면 아무 사이트나 창 안에 뜹니다 */
for (const bad of [
  '', '   ', 'https://www.youtube.com/watch?v=abc',
  'https://evil.example/open.spotify.com/playlist/abc',
  'javascript:alert(1)',
  'https://open.spotify.com/playlist/',
]) {
  assert.equal(spotifyEmbed(bad), null, '거절해야 합니다: ' + JSON.stringify(bad))
}
/* 만들어지는 주소는 언제나 open.spotify.com 입니다 */
for (const good of ['https://open.spotify.com/show/abc', 'spotify:episode:xyz']) {
  assert.ok(spotifyEmbed(good).startsWith('https://open.spotify.com/embed/'))
}

/* ---- 구글 캘린더 ---- */
assert.equal(
  calendarEmbed('ko.south_korea#holiday@group.v.calendar.google.com'),
  'https://calendar.google.com/calendar/embed?ctz=Asia%2FSeoul&mode=AGENDA&src='
    + encodeURIComponent('ko.south_korea#holiday@group.v.calendar.google.com'),
  '캘린더 ID 에는 # 이 들어갑니다 — 구글 공휴일 달력이 그렇습니다')
assert.equal(
  calendarEmbed('https://calendar.google.com/calendar/embed?src=me%40example.com&ctz=Asia%2FSeoul'),
  'https://calendar.google.com/calendar/embed?src=me%40example.com&ctz=Asia%2FSeoul',
  '구글이 주는 삽입 주소는 그대로 씁니다')
assert.equal(
  calendarEmbed('<iframe src="https://calendar.google.com/calendar/embed?src=a%40b.com&amp;ctz=Asia%2FSeoul" width="800"></iframe>'),
  'https://calendar.google.com/calendar/embed?src=a%40b.com&ctz=Asia%2FSeoul',
  '삽입 코드를 통째로 붙여 넣는 사람이 많습니다 — &amp; 도 풀어야 합니다')

for (const bad of [
  '', '아무 말', 'https://evil.example/calendar/embed?src=x',
  'https://calendar.google.com/calendar/u/0/r',
  'javascript:alert(1)',
]) {
  assert.equal(calendarEmbed(bad), null, '거절해야 합니다: ' + JSON.stringify(bad))
}

console.log('openworld 바깥 서비스 주소 파싱: OK')
