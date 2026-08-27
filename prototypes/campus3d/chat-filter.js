/* ══════════════════════════════════════════════════════════
   채팅 욕설 가리기.

   사전은 `../shared/korcen.js` 하나입니다(index.html 이 먼저 붙입니다).
   목록을 여기서 새로 쓰지 않는 이유는 "시1발" 한 번에 뚫리기 때문입니다.

   왜 통째로 막지 않고 낱말만 가리나 —
     채팅은 흐름입니다. 문장이 통째로 사라지면 무슨 일이 있었는지도
     안 보이고 대화가 끊깁니다. 걸린 낱말만 ● 로 덮으면 나머지는 읽힙니다.
     어느 낱말인지 못 짚을 때만(문맥으로 걸린 경우) 문장을 통째로 가립니다.

   어디서 부르나 — **보낼 때와 받을 때 둘 다** 입니다.
     보내기는 `index.html` 의 입력 처리, 받기는 `net.js` 의 'say' 수신입니다.
     보내는 쪽만 가리면 소용이 없습니다: 남의 브라우저가 무엇을 보낼지는
     우리가 정하지 못합니다. 받는 쪽에서 한 번 더 가려야 내 화면이 안전합니다.
     받기는 **들어올 때 한 번** 가립니다 — 화면에 그릴 때 가리면 말풍선이
     매 프레임 사전 일곱 벌을 훑습니다.

   korcen 이 놓치는 것 한 줌을 덧댑니다. 구운 파일은 "직접 고치지 마세요"
   가 규칙이라, 원본을 다시 굽기 전까지의 임시입니다. 지금 확인된 구멍은
   **'씨발' 원형** 입니다 — '시발'·'씨빨'·'씹발'·'씨바' 는 잡는데 정작
   '씨발' 이 사전에 없습니다. 우회형이 아니라 원형이라 그냥 두면 필터가
   있는 뜻이 없습니다.

   ponytail: 같은 덧댐이 `../openworld/chat.js` 에도 있습니다. korcen 을
   다시 구워 원형이 들어가면 양쪽에서 EXTRA_BAD 를 지웁니다.
   ══════════════════════════════════════════════════════════ */

/* 2D 판(`../openworld/chat.js`)과 **같은 목록**입니다. 판정이 갈라지면
   같은 말이 한쪽에서는 가려지고 한쪽에서는 안 가려집니다. */
const EXTRA_BAD = ['씨발', '싀발', '씨발놈', '씨발년'];
/* korcen 이 오탐으로 빼 둔 말은 여기서도 빼야 합니다 — 안 그러면
   "아저씨발" 이 걸립니다. */
const EXTRA_OK = /아저씨발|아조씨발|아저씨바|씨발라/g;

/** 걸리나. korcen 이 아직 안 붙었어도 덧댐 목록은 돕니다. */
export function isProfane(text) {
  if (!text) return false;
  try {
    if (globalThis.Korcen?.isProfane?.(text)) return true;
    const t = String(text).replace(EXTRA_OK, '');
    return EXTRA_BAD.some((w) => t.includes(w));
  } catch {
    /* 검사기가 터지면 통과시킵니다. 고장 난 검사기 때문에 아무 말도
       못 하게 되는 편이 욕설 한 번 지나가는 것보다 큰 고장입니다. */
    return false;
  }
}

/** 걸린 낱말만 ● 로 덮은 문장. 안 걸리면 원문 그대로 돌려줍니다. */
export function maskProfanity(text) {
  const s = String(text ?? '');
  if (!isProfane(s)) return s;
  let hit = false;
  const out = s.split(/(\s+)/).map((w) => {
    if (!w.trim() || !isProfane(w)) return w;
    hit = true;
    return '●'.repeat(Math.min(6, [...w].length));
  }).join('');
  return hit ? out : '(가려진 말)';
}
