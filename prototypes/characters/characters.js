/* ==================================================================
   기린캠퍼스 — 캐릭터 넷

   알에서 나오는 네 종입니다. 확정본이라 여기 한 벌만 두고, 온보딩과
   오픈월드가 **같은 파일**을 가져다 씁니다. 두 곳에 복사해 두면 한쪽만
   고쳐지고 그 순간 두 화면이 다른 캐릭터를 보여 줍니다.

   규칙은 월드의 다른 그림과 같습니다.
     · 16×16 격자, 확대는 브라우저가 한다
     · 빛은 왼쪽 위. 밝은 면이 위·왼쪽, 그림자는 아래·오른쪽
     · 바닥에 닿는 면을 어둡게 깔아야 물건이 떠 있지 않다
     · 눈은 흰자 없이 검은 점 하나에 흰 반사 1px.
       이 크기에서 흰자를 넣으면 눈이 아니라 얼룩이 된다

   쓰는 법
     const art = GirinChars.build();      // { turtle, giraffe, meerkat, pig, eggTurtle, ... }
     ctx.drawImage(art.turtle, x, y);

   브라우저에서는 전역 GirinChars, 번들러에서는 default export 로 씁니다.
   ================================================================== */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GirinChars = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const T = 16;

  /* ---------------- 원시 도구 ---------------- */
  function canvasOf(w, h) {
    const c = document.createElement('canvas');
    c.width = w * T; c.height = h * T;
    return c;
  }
  function px(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }

  /** 정수 격자에 맞춘 원. arc() 는 가장자리를 반투명하게 남겨,
      4배로 키우면 윤곽이 흐려집니다. 행마다 폭을 계산해 채웁니다. */
  function disc(g, cx, cy, r, color) {
    g.fillStyle = color;
    for (let dy = -r; dy <= r; dy++) {
      const w = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
      g.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1);
    }
  }
  function shadow(g, cx, y, rx, ry) {
    g.fillStyle = 'rgba(0,0,0,.20)';
    for (let dy = -ry; dy <= ry; dy++) {
      const half = Math.floor(rx * Math.sqrt(1 - (dy * dy) / (ry * ry || 1)));
      g.fillRect(cx - half, y + dy, half * 2 + 1, 1);
    }
  }
  function eyes(g, lx, rx, y, dark) {
    dark = dark || '#2A2320';
    px(g, lx, y, 2, 3, dark);
    px(g, rx, y, 2, 3, dark);
    px(g, lx, y, 1, 1, 'rgba(255,255,255,.85)');
    px(g, rx, y, 1, 1, 'rgba(255,255,255,.85)');
  }
  function blush(g, lx, rx, y, c) {
    c = c || 'rgba(255,138,115,.55)';
    px(g, lx, y, 3, 2, c);
    px(g, rx, y, 3, 2, c);
  }

  /* ==================== 알 ====================
     껍질 무늬가 없으면 알 넷이 색만 다른 같은 알이 됩니다.
     아래가 넓은 타원 - 위아래 반지름을 다르게 줘야 공이 안 됩니다. */
  function paintEgg(shell, shellLit, shellDark, spot) {
    const c = canvasOf(2, 3), g = c.getContext('2d');
    shadow(g, 16, 40, 11, 3);
    for (let y = -15; y <= 13; y++) {
      const t = y < 0 ? y / 15 : y / 13;
      const w = Math.round(Math.sqrt(Math.max(0, 1 - t * t)) * (y < 0 ? 8.5 : 10));
      if (!w) continue;
      px(g, 16 - w, 24 + y, w * 2, 1, shellDark);
      px(g, 16 - w + 1, 24 + y, w * 2 - 2, 1, shell);
    }
    disc(g, 12, 18, 4, shellLit);
    disc(g, 11, 17, 2, '#FFFFFF');
    g.fillStyle = spot;
    [[15, 13, 4, 3], [10, 22, 5, 4], [19, 19, 4, 5], [14, 30, 6, 3], [21, 28, 3, 3]]
      .forEach(function (p) { g.fillRect(p[0], p[1], p[2], p[3]); });
    return c;
  }

  /* ==================== 거북이 ====================
     등껍질이 몸보다 커야 새끼로 보입니다. 껍질 무늬는 다섯 조각만 -
     더 넣으면 16px 에서 얼룩이 됩니다. */
  function paintTurtle() {
    const c = canvasOf(2, 2), g = c.getContext('2d');
    shadow(g, 16, 29, 11, 2);
    px(g, 6, 24, 4, 4, '#4E9A63');  px(g, 22, 24, 4, 4, '#4E9A63');   // 뒷발
    px(g, 6, 24, 4, 1, '#6FBC83');  px(g, 22, 24, 4, 1, '#6FBC83');
    disc(g, 16, 17, 11, '#3D8A55');                                    // 등껍질
    disc(g, 16, 16, 10, '#63B87A');
    disc(g, 13, 13, 5, '#8FD9A2');
    g.fillStyle = '#3D8A55';
    [[12, 11], [20, 11], [16, 17], [10, 18], [22, 18]].forEach(function (p) {
      g.fillRect(p[0] - 2, p[1], 5, 1); g.fillRect(p[0] - 1, p[1] - 1, 3, 3);
    });
    px(g, 3, 18, 4, 3, '#7FCF97');  px(g, 25, 18, 4, 3, '#7FCF97');    // 앞발
    disc(g, 16, 25, 6, '#7FCF97');                                     // 머리
    disc(g, 16, 24, 5, '#9BE0AF');
    eyes(g, 12, 19, 23);
    px(g, 15, 27, 2, 1, '#3D8A55');
    blush(g, 9, 20, 26, 'rgba(255,138,115,.42)');
    return c;
  }

  /* ==================== 기린 ====================
     목이 없으면 기린이 아닙니다. 새끼라 짧게 두고 반점을 크게 잡아
     종을 알아보게 했습니다. 뿔 둘은 1px 이라도 있어야 합니다. */
  function paintGiraffe() {
    const c = canvasOf(2, 2), g = c.getContext('2d');
    shadow(g, 16, 30, 9, 2);
    px(g, 11, 25, 3, 5, '#C39338');  px(g, 18, 25, 3, 5, '#C39338');   // 다리
    px(g, 11, 25, 1, 5, '#E8B85A');  px(g, 18, 25, 1, 5, '#E8B85A');
    px(g, 9, 19, 14, 8, '#C39338');                                    // 몸통
    px(g, 10, 19, 12, 7, '#F0C566');
    px(g, 10, 19, 12, 2, '#FFDC8E');
    g.fillStyle = '#A8722A';                                           // 반점
    [[11, 21], [16, 22], [19, 20], [13, 24]].forEach(function (p) {
      g.fillRect(p[0], p[1], 3, 3);
    });
    px(g, 14, 10, 5, 10, '#C39338');                                   // 목
    px(g, 15, 10, 4, 9, '#F0C566');
    px(g, 15, 12, 2, 2, '#A8722A');
    px(g, 15, 16, 2, 2, '#A8722A');
    disc(g, 17, 8, 6, '#C39338');                                      // 머리
    disc(g, 17, 7, 5, '#F5D07A');
    px(g, 20, 7, 4, 4, '#FFE1A0');                                     // 주둥이
    px(g, 21, 9, 1, 1, '#8E6320'); px(g, 23, 9, 1, 1, '#8E6320');
    eyes(g, 14, 19, 5);
    px(g, 12, 1, 2, 4, '#8E6320'); px(g, 12, 0, 3, 2, '#B5762E');      // 뿔
    px(g, 18, 1, 2, 4, '#8E6320'); px(g, 18, 0, 3, 2, '#B5762E');
    px(g, 10, 4, 4, 3, '#E8B85A');                                     // 귀
    return c;
  }

  /* ==================== 미어캣 ====================
     서 있는 자세와 눈 주변 검은 무늬가 종을 만듭니다. 꼬리를 몸통보다
     먼저 그려 뒤로 보내야 붙어 있는 것으로 보입니다. */
  function paintMeerkat() {
    const c = canvasOf(2, 2), g = c.getContext('2d');
    shadow(g, 16, 30, 9, 2);
    px(g, 23, 12, 4, 15, '#A87F58');                                   // 꼬리
    px(g, 23, 12, 2, 14, '#C79B70');
    px(g, 10, 26, 4, 4, '#A87F58');  px(g, 18, 26, 4, 4, '#A87F58');   // 발
    px(g, 9, 15, 14, 13, '#A87F58');                                   // 몸통
    px(g, 10, 15, 12, 12, '#D8AE84');
    px(g, 11, 18, 10, 8, '#EBCBA6');                                   // 배
    g.fillStyle = 'rgba(140,102,68,.5)';                               // 등 줄무늬
    for (let y = 17; y < 25; y += 3) g.fillRect(10, y, 12, 1);
    px(g, 6, 17, 4, 7, '#C79B70');  px(g, 22, 17, 4, 7, '#C79B70');    // 앞발
    disc(g, 16, 10, 8, '#A87F58');                                     // 머리
    disc(g, 16, 9, 7, '#D8AE84');
    px(g, 8, 3, 4, 4, '#8E6440'); px(g, 20, 3, 4, 4, '#8E6440');       // 귀
    px(g, 9, 4, 2, 2, '#C48F63'); px(g, 21, 4, 2, 2, '#C48F63');
    px(g, 10, 6, 5, 4, '#5C4128');                                     // 눈 주변 검은 무늬
    px(g, 17, 6, 5, 4, '#5C4128');
    eyes(g, 11, 18, 7, '#1A120A');
    px(g, 13, 11, 6, 4, '#EBCBA6');                                    // 주둥이
    px(g, 15, 11, 3, 2, '#3A2A18');
    px(g, 16, 13, 1, 2, '#8E6440');
    return c;
  }

  /* ==================== 돼지 ====================
     코가 전부입니다. 콧구멍 두 점이 없으면 분홍 곰이 됩니다.
     꼬리는 세 조각으로 꺾어야 말린 것으로 보입니다. */
  function paintPig() {
    const c = canvasOf(2, 2), g = c.getContext('2d');
    shadow(g, 16, 30, 10, 2);
    px(g, 24, 16, 2, 2, '#C4737F');                                    // 꼬리
    px(g, 26, 14, 2, 2, '#C4737F'); px(g, 24, 12, 2, 2, '#C4737F');
    px(g, 10, 25, 4, 5, '#C4737F');  px(g, 18, 25, 4, 5, '#C4737F');   // 다리
    px(g, 10, 25, 1, 5, '#F0A0AC');  px(g, 18, 25, 1, 5, '#F0A0AC');
    disc(g, 16, 18, 11, '#C4737F');                                    // 몸통
    disc(g, 16, 17, 10, '#F2A6B2');
    disc(g, 13, 14, 5, '#FFC4CD');
    px(g, 5, 6, 6, 7, '#C4737F'); px(g, 21, 6, 6, 7, '#C4737F');       // 귀
    px(g, 6, 7, 4, 5, '#F5B6C0');  px(g, 22, 7, 4, 5, '#F5B6C0');
    eyes(g, 11, 19, 15);
    disc(g, 16, 22, 5, '#D98593');                                     // 코
    disc(g, 16, 21, 4, '#FFBEC8');
    px(g, 14, 21, 2, 3, '#B05F6E');
    px(g, 18, 21, 2, 3, '#B05F6E');
    blush(g, 7, 22, 19);
    return c;
  }

  /* ==================== 종 정의 ====================
     shell 은 [본색, 밝은면, 어두운면, 무늬] 순입니다. 알과 캐릭터가
     같은 팔레트를 쓰기 때문에, 알만 보고도 무엇이 나올지 짐작됩니다. */
  const SPECIES = [
    {
      id: 'turtle', name: '거북이', order: 1,
      line: '느려도 끝까지 갑니다. 오래 앉는 편이 잘 맞아요.',
      shell: ['#63B87A', '#8FD9A2', '#3D8A55', '#3F8F5C'],
      palette: ['#9BE0AF', '#8FD9A2', '#7FCF97', '#63B87A', '#4E9A63', '#3D8A55'],
      paint: paintTurtle,
    },
    {
      id: 'giraffe', name: '기린', order: 2,
      line: '목이 길어서 목 걱정이 제일 많습니다.',
      shell: ['#F0C566', '#FFE1A0', '#C39338', '#B5762E'],
      palette: ['#FFE1A0', '#FFDC8E', '#F5D07A', '#F0C566', '#C39338', '#A8722A', '#8E6320'],
      paint: paintGiraffe,
    },
    {
      id: 'meerkat', name: '미어캣', order: 3,
      line: '똑바로 서 있는 게 특기입니다.',
      shell: ['#D8AE84', '#F2D2AE', '#A87F58', '#8E6440'],
      palette: ['#EBCBA6', '#D8AE84', '#C79B70', '#A87F58', '#8E6440', '#5C4128', '#1A120A'],
      paint: paintMeerkat,
    },
    {
      id: 'pig', name: '돼지', order: 4,
      line: '쉬는 시간을 제일 잘 챙깁니다.',
      shell: ['#F2A6B2', '#FFCBD4', '#C4737F', '#B95F6E'],
      palette: ['#FFC4CD', '#FFBEC8', '#F5B6C0', '#F2A6B2', '#D98593', '#C4737F', '#B05F6E'],
      paint: paintPig,
    },
  ];

  /** 한 번 그려서 재사용합니다. 캔버스를 매번 새로 만들면 목록 화면에서
      같은 그림을 수십 번 다시 그리게 됩니다. */
  let cache = null;
  function build(force) {
    if (cache && !force) return cache;
    cache = {};
    SPECIES.forEach(function (s) {
      cache[s.id] = s.paint();
      cache['egg' + s.id[0].toUpperCase() + s.id.slice(1)] = paintEgg.apply(null, s.shell);
    });
    return cache;
  }

  /** 받침이 있으면 이, 없으면 가. "기린 가 나왔습니다" 를 막습니다. */
  function iga(w) {
    const ch = w.charCodeAt(w.length - 1);
    const has = ch >= 0xAC00 && ch <= 0xD7A3 && (ch - 0xAC00) % 28 !== 0;
    return w + (has ? '이' : '가');
  }

  return { T, SPECIES, build, iga, paintEgg, canvasOf, px, disc, shadow, eyes, blush };
});
