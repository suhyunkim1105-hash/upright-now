/*
 * @supabase/supabase-js 의 UMD 번들을 프로토타입 폴더로 굽습니다.
 *
 *   npm i                                     (루트에 이미 의존성이 있습니다)
 *   node prototypes/shared/build-supabase-js.mjs
 *   → prototypes/shared/supabase.js
 *
 * 왜 SDK 를 넣나 — save.js 는 일부러 안 씁니다
 *   save.js 주석에 "종단점이 몇 개뿐이라 fetch 로 충분합니다" 라고 적혀
 *   있고 그 말이 맞습니다. REST 는 요청 하나가 곧 결과 하나입니다.
 *
 *   Realtime 은 성격이 다릅니다. 소켓을 붙들고 하트비트를 보내고, 끊기면
 *   물러나며 다시 붙고, 토큰이 갱신되면 채널에 다시 밀어 넣고, presence 의
 *   state/diff 를 합쳐 명단을 만듭니다. 이걸 손으로 쓰면 Phoenix 채널
 *   프로토콜을 우리가 다시 구현하는 것이고, **실서버에 대고 시험할 수 없는
 *   환경에서** 그 코드를 처음 돌리는 것은 위험합니다(이 컨테이너는 egress
 *   정책상 supabase.co 에 못 나갑니다). 그래서 이쪽만 공식 클라이언트를 씁니다.
 *
 * 왜 index.html 의 <script src> 목록에 안 넣나
 *   200KB 가 넘습니다. 단독본(build-artifact.mjs)은 <script src> 를 전부
 *   본문에 박는데, 단독본에는 config.js 가 없어서 Supabase 를 아예 안 씁니다 —
 *   쓰지도 않을 200KB 를 박게 됩니다. 그래서 multiplayer.js 가 **설정이
 *   있을 때만** 그 자리에서 불러옵니다.
 *
 * MIT License — https://github.com/supabase/supabase-js
 */
import { copyFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../../node_modules/@supabase/supabase-js/dist/umd/supabase.js');
if (!existsSync(src)) {
  console.error('없습니다: ' + src + '\n먼저 `npm i` 를 돌리세요.');
  process.exit(1);
}
const ver = JSON.parse(readFileSync(resolve(here, '../../node_modules/@supabase/supabase-js/package.json'), 'utf8')).version;
const out = resolve(here, 'supabase.js');
copyFileSync(src, out);
/* 어느 판인지 파일 첫 줄에 남깁니다. 안 남기면 다시 구울 때 무엇이
   바뀌었는지 diff 로만 알 수 있습니다. */
writeFileSync(out, '/* @supabase/supabase-js v' + ver + ' UMD — MIT.\n'
  + '   prototypes/shared/build-supabase-js.mjs 가 구운 것입니다. 손으로 고치지 마세요. */\n'
  + readFileSync(out, 'utf8'));
console.log('supabase.js v' + ver + ' 구움');
