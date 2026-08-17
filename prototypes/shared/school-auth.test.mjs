/* school-auth.js 자체 검사.
 *
 *   node --test prototypes/shared/school-auth.test.mjs
 *
 * 브라우저용 모듈이라 가짜 window 를 만들어 주입합니다. 서버는 안 부릅니다 -
 * fetch 를 가로채 요청 모양만 봅니다. 로그인은 신뢰 경계라, 조용히 어긋나면
 * 뚫린 줄도 모릅니다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SRC = readFileSync(fileURLToPath(new URL('./school-auth.js', import.meta.url)), 'utf8');

/** 설정된 상태의 모듈 하나. calls 에 나간 요청이 쌓입니다. */
function load({ url = 'https://demo.supabase.co/', anonKey = 'ANON123', protocol = 'https:' } = {}) {
  const calls = [];
  const store = {};
  const box = { reply: { ok: true, status: 200, json: async () => ({}) } };
  const win = {
    GIRIN_SUPABASE: url || anonKey ? { url, anonKey } : undefined,
    location: { protocol },
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = v; },
      removeItem: (k) => { delete store[k]; },
    },
    fetch: async (u, init) => {
      calls.push({ url: u, body: JSON.parse(init.body), headers: init.headers });
      return box.reply;
    },
  };
  new Function('window', SRC)(win);
  return { A: win.SchoolAuth, calls, store, box };
}

const ok = (json, status = 200) => ({ ok: true, status, json: async () => json });
const bad = (status, json) => ({ ok: false, status, json: async () => json });

test('학교 이메일만 통과한다', () => {
  const { A } = load();
  for (const e of ['hong@mju.ac.kr', 'a@cs.snu.ac.kr', 'a@ac.kr', 'a@skku.edu', 'a@KAIST.AC.KR'])
    assert.equal(A.isSchoolEmail(e), true, e);
  // `notac.kr` 은 `ac.kr` 로 끝나지만 앞의 점이 없습니다. 이게 통과하면
  // 아무나 도메인 하나 사서 학생이 됩니다.
  for (const e of ['a@gmail.com', 'a@naver.com', 'a@notac.kr', 'a@ac.kr.evil.com', 'nope', ''])
    assert.equal(A.isSchoolEmail(e), false, e);
});

test('설정이 없거나 file:// 이면 살아 있지 않다', () => {
  assert.equal(load({ url: '', anonKey: '' }).A.live, false);
  assert.equal(load({ protocol: 'file:' }).A.live, false);
  assert.match(load({ protocol: 'file:' }).A.reason, /file:\/\//);
  assert.equal(load().A.live, true);
});

test('메일 요청은 auth-js 와 같은 모양이다', async () => {
  const { A, calls } = load();
  await A.sendCode('  HONG@MJU.AC.KR  ');
  assert.equal(calls[0].url, 'https://demo.supabase.co/auth/v1/otp');
  // 주소는 다듬어 보냅니다. 공백이 붙은 채 가면 다른 사람이 됩니다.
  assert.deepEqual(calls[0].body, {
    email: 'hong@mju.ac.kr', create_user: true, data: {}, gotrue_meta_security: {},
  });
  assert.equal(calls[0].headers.apikey, 'ANON123');
});

test('번호를 확인하면 토큰만 저장한다', async () => {
  const { A, calls, box, store } = load();
  box.reply = ok({ access_token: 'AT', refresh_token: 'RT',
    expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u-1', email: 'hong@mju.ac.kr' } });
  const s = await A.verifyCode('hong@mju.ac.kr', ' 123456 ');
  assert.equal(calls[0].url, 'https://demo.supabase.co/auth/v1/verify');
  assert.deepEqual(calls[0].body,
    { email: 'hong@mju.ac.kr', token: '123456', type: 'email', gotrue_meta_security: {} });
  assert.equal(s.user_id, 'u-1');
  // 저장하는 것은 토큰과 주소뿐입니다.
  assert.deepEqual(Object.keys(JSON.parse(store['girin.session'])).sort(),
    ['access_token', 'email', 'expires_at', 'refresh_token', 'user_id']);
});

test('만료된 세션은 갱신하고, 갱신에 실패하면 버린다', async () => {
  const { A, calls, box, store } = load();
  const dead = { access_token: 'AT', refresh_token: 'RT', expires_at: 1, email: 'a@mju.ac.kr', user_id: 'u-1' };

  store['girin.session'] = JSON.stringify(dead);
  box.reply = ok({ access_token: 'AT2', refresh_token: 'RT2', expires_in: 3600, user: { id: 'u-1', email: 'a@mju.ac.kr' } });
  assert.equal((await A.session()).access_token, 'AT2');
  assert.match(calls[0].url, /grant_type=refresh_token$/);

  // 죽은 토큰을 들고 있으면 이후 모든 요청이 401 로 떨어지고 원인이 안 보입니다.
  store['girin.session'] = JSON.stringify(dead);
  box.reply = bad(401, { msg: 'refresh_token_not_found' });
  assert.equal(await A.session(), null);
  assert.equal(store['girin.session'], undefined);
});

test('살아 있는 세션은 서버를 부르지 않는다', async () => {
  const { A, calls, store } = load();
  store['girin.session'] = JSON.stringify({ access_token: 'AT', refresh_token: 'RT',
    expires_at: Math.floor(Date.now() / 1000) + 3600, email: 'a@mju.ac.kr', user_id: 'u-1' });
  assert.equal((await A.session()).user_id, 'u-1');
  assert.equal(calls.length, 0);
});

test('오류는 사용자가 읽을 문장으로 바뀐다', async () => {
  const cases = [
    [429, { msg: 'rate limit' }, /너무 자주/],
    [403, { msg: '학교 이메일이 아닙니다. ac.kr 로 끝나는 주소가 필요합니다.' }, /학교 이메일이 아닙니다/],
    [400, { msg: 'Token has expired', error_code: 'otp_expired' }, /만료/],
    [400, { msg: 'Invalid token' }, /맞지 않습니다/],
    [500, { msg: 'boom' }, /연결이 안 됩니다/],
  ];
  for (const [status, body, want] of cases) {
    const { A, box } = load();
    box.reply = bad(status, body);
    await assert.rejects(() => A.sendCode('a@mju.ac.kr'), (e) => {
      assert.match(e.friendly, want);
      // 영어 원문이 그대로 새어 나가면 안 됩니다.
      assert.notEqual(e.friendly, body.msg === '학교 이메일이 아닙니다. ac.kr 로 끝나는 주소가 필요합니다.' ? null : body.msg);
      return true;
    });
  }
});

test('로그아웃은 서버가 죽어도 기기에서 지운다', async () => {
  const { A, box, store } = load();
  store['girin.session'] = JSON.stringify({ access_token: 'AT', refresh_token: 'RT',
    expires_at: Math.floor(Date.now() / 1000) + 3600, email: 'a@mju.ac.kr', user_id: 'u-1' });
  box.reply = bad(500, { msg: 'down' });
  await A.signOut();
  assert.equal(store['girin.session'], undefined);
});
