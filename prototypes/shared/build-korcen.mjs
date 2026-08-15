/*
 * korcen.ts 를 브라우저가 바로 읽는 파일 하나로 굽습니다.
 *
 *   git clone --depth 1 https://github.com/Tanat05/korcen.ts.git <어딘가>
 *   node prototypes/shared/build-korcen.mjs <어딘가>
 *   → prototypes/shared/korcen.js
 *
 * 왜 이렇게 하나 —
 *   원본은 TypeScript 이고 rollup 으로 번들합니다. 이 프로토타입에는
 *   빌드 단계가 없고 단일 HTML 이 원칙이라, npm 의존성을 넣으면
 *   단독본 빌드(build-standalone / build-artifact)가 깨집니다.
 *   타입 표기가 얇아서(파일당 10~30줄) 기계로 벗기면 그대로 JS 입니다.
 *
 * 무엇을 넣나 —
 *   비속어·일반·성적·비하·패드립·인종·영어 일곱 벌입니다.
 *   **정치와 소수자 사전은 뺐습니다** — 닉네임에 쓰면 평범한 이름이
 *   걸립니다. 걸러야 할 것보다 잘못 걸리는 것이 많으면 필터가 아니라
 *   장애물입니다.
 *
 * Apache License 2.0 — https://github.com/Tanat05/korcen.ts
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = process.argv[2];
if (!srcRoot) { console.error('사용법: node build-korcen.mjs <korcen.ts 저장소 경로>'); process.exit(1); }

/* 닉네임에 쓸 사전만. 파일 이름 → 내보내는 함수 이름 */
const PICK = [
  ['checkBadLang', 'check'],
  ['checkGeneral', 'general'],
  ['checkSexual', 'sexual'],
  ['checkBelittle', 'belittle'],
  ['checkParents', 'parents'],
  ['checkRace', 'race'],
  /* 영어 욕. 처음엔 뺐다가 fuck 이 그대로 통과해 넣었습니다 — 한국
     서비스라도 영어 닉네임은 흔합니다. */
  ['checkForeign', 'foreign'],
];

/** 타입 표기를 벗깁니다. 이 저장소가 쓰는 형태만 다룹니다. */
function stripTypes(code) {
  return code
    /* export function f(text: string | any): boolean { */
    .replace(/export function (\w+)\s*\(([^)]*)\)\s*:\s*[\w<>[\]| ]+\s*\{/g,
             (m, name, args) => `function ${name}(${args.replace(/\s*:\s*[\w<>[\]| ]+/g, '')}) {`)
    /* const X: Record<string, string> = {  /  const R: RegExp = ... */
    .replace(/(\b(?:const|let|var)\s+\w+)\s*:\s*(?:Record<[^>]*>|RegExp|string(?:\[\])?|boolean|number|any)\s*=/g, '$1 =')
    /* (match: string): string => {  /  (m: string) => */
    .replace(/\(([\w\s,]*?)\s*:\s*[\w<>[\]| ]+\)\s*:\s*[\w<>[\]| ]+\s*=>/g, '($1) =>')
    .replace(/\(([\w\s,]*?)\s*:\s*[\w<>[\]| ]+\)\s*=>/g, '($1) =>')
    /* 남은 매개변수 표기 */
    .replace(/\(([\w]+)\s*:\s*[\w<>[\]| ]+\)/g, '($1)')
    /* export 없는 함수의 반환 타입 — function f(x): string { */
    .replace(/function (\w+)\s*\(([^)]*)\)\s*:\s*[\w<>[\]| ]+\s*\{/g,
             (m, name, args) => `function ${name}(${args.replace(/\s*:\s*[\w<>[\]| ]+/g, '')}) {`)
    /* import/export 줄 제거 — 파일 하나로 합칠 것이라 필요 없습니다 */
    .replace(/^\s*(?:import|export)\s+.*$/gm, '')
    .replace(/^export /gm, '')
    /* 대체 문자(U+FFFD) 지우기.
       원본 checkForeign.ts 의 중국어 사전 두 줄이 이미 깨져 있습니다
       (색계론�, 풍�음탕). 그대로 두면 아티팩트 게시가 "unpaired escape
       sequences" 로 거부하고, 애초에 깨진 글자는 무엇과도 안 맞으므로
       필터로서 값이 0 입니다. 우리 대상은 한국어 닉네임이라 중국어
       항목 몇 개가 빠지는 것은 손해가 아닙니다. */
    .replace(/�/g, '');
}

const parts = [];
for (const [file, fn] of PICK) {
  const p = resolve(srcRoot, 'src', file + '.ts');
  if (!existsSync(p)) { console.error('없는 파일: ' + p); process.exit(1); }
  let code = stripTypes(readFileSync(p, 'utf8'));
  /* 파일마다 같은 이름의 상수를 씁니다(ALL_FP_REGEX 등). 블록으로 싸서
     서로 안 밟게 하고, 검사 함수만 밖으로 내보냅니다. */
  parts.push(`/* ---- ${file}.ts → ${fn}() ---- */\nconst ${fn} = (function () {\n${code}\nreturn ${fn};\n})();`);
  console.log('  ' + file + ' → ' + fn + '()  ' + code.split('\n').length + '줄');
}

const out = `/*
 * 한국어 비속어 검사 — korcen.ts 에서 구웠습니다.
 *
 *   원본  https://github.com/Tanat05/korcen.ts   (Apache License 2.0)
 *   빌드  node prototypes/shared/build-korcen.mjs <원본 경로>
 *
 * **직접 고치지 마세요.** 원본을 갱신하고 다시 구우세요.
 *
 * 사전 일곱 벌 — 비속어·일반·성적·비하·패드립·인종·영어.
 * 정치와 소수자 사전은 뺐습니다: 닉네임 검사에 쓰면 평범한 이름이
 * 걸립니다. 걸러야 할 것보다 잘못 걸리는 것이 많으면 필터가 아니라
 * 장애물입니다.
 */
(function (global) {
  'use strict';

${parts.join('\n\n')}

  /** 하나라도 걸리면 true. 어느 사전에 걸렸는지는 안 알려 줍니다 —
      "무엇이 비속어로 잡혔는지" 를 돌려주면 그게 곧 우회 안내서입니다. */
  function isProfane(text) {
    if (typeof text !== 'string' || !text.trim()) return false;
    try {
      return ${PICK.map(([, fn]) => `${fn}(text)`).join(' || ')};
    } catch (e) {
      /* 사전이 못 읽는 입력이면 통과시킵니다. 검사기 고장으로 가입을
         막는 것이 비속어 한 번 지나가는 것보다 나쁩니다. */
      return false;
    }
  }

  global.Korcen = { isProfane: isProfane };
})(typeof window !== 'undefined' ? window : globalThis);
`;

const dest = resolve(here, 'korcen.js');
writeFileSync(dest, out, 'utf8');
console.log('korcen.js  ' + Math.round(Buffer.byteLength(out) / 1024) + ' KB');
