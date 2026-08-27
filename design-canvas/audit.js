// 그리기 전에 짜 두는 검사기. 눈으로 본 것은 증거가 아니라서, 화면에서
// 실제로 계산된 값만 봅니다. preview.html 이 이 파일을 읽고 window.__audit()
// 를 답니다.
//
// 잡는 것 다섯:
//   1) 죽은 선언 — 적은 font-size 와 계산된 font-size 가 다른 곳
//   2) 넘침 — 아트보드 밖으로 나간 내용
//   3) 대비 — 반투명 배경을 조상 위로 합성한 뒤 잰 값
//   4) 너무 작은 글자
//   5) 변하는 숫자에 tabular-nums 가 빠진 곳
(() => {
  const NUM = /\d/;
  const CHANGING = /^(\d+(\.\d+)?\s*(분|초|회|일|명|시간|개)?|\d+\s*\/\s*\d+)$/;

  // rgb(a) / color(srgb …) 를 0~255 세 값과 알파로. 크롬은 color-mix 결과를
  // color(srgb 0.98 0.99 1) 로 돌려주는데, 이걸 0~255 로 읽으면 밝은 색이
  // 거의 검정으로 잡힙니다.
  function parse(c) {
    if (!c || c === 'transparent') return [0, 0, 0, 0];
    let m = c.match(/^rgba?\(([^)]+)\)/);
    if (m) {
      const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
      return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
    }
    m = c.match(/^color\(srgb ([^)]+)\)/);
    if (m) {
      const p = m[1].split(/[\s\/]+/).filter(Boolean).map(Number);
      return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1];
    }
    return [0, 0, 0, 0];
  }

  const over = (fg, bg) => fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3])).concat(1);

  // 요소가 실제로 앉아 있는 바탕. 반투명이면 조상 위로 계속 합성합니다.
  // 그림이나 그라데이션이 깔린 위의 글자는 한 색으로 잴 수 없습니다.
  // 잴 수 있는 것만 재고, 나머지는 못 쟀다고 말합니다 — 거짓 양성을
  // 쏟아내는 검사기는 안 쓰느니만 못합니다.
  function backdrop(el, root) {
    let stack = [];
    for (let n = el; n && n !== root.parentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
      const c = parse(cs.backgroundColor);
      if (c[3] > 0) stack.push(c);
      if (c[3] === 1) break;
    }
    let out = [255, 255, 255, 1];
    for (let i = stack.length - 1; i >= 0; i--) out = over(stack[i], out);
    return out;
  }

  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };

  window.__audit = function (boards) {
    const out = [];
    boards.forEach(({ name, el }) => {
      const push = (kind, msg, node) => out.push({ board: name, kind, msg,
        at: (node && node.textContent || '').trim().slice(0, 22) });

      if (el.scrollHeight - el.clientHeight > 1) push('overflow', '세로 ' + (el.scrollHeight - el.clientHeight) + 'px 넘침');
      if (el.scrollWidth - el.clientWidth > 1) push('overflow', '가로 ' + (el.scrollWidth - el.clientWidth) + 'px 넘침');

      el.querySelectorAll('*').forEach((n) => {
        const style = n.getAttribute('style') || '';
        const cs = getComputedStyle(n);

        // 1) 적은 값과 계산된 값이 다른가 — 선언이 죽었다는 뜻
        const decl = style.match(/font-size:\s*([\d.]+)px/);
        if (decl && Math.abs(parseFloat(cs.fontSize) - parseFloat(decl[1])) > 0.2)
          push('dead', 'font-size ' + decl[1] + 'px 로 적었는데 ' + cs.fontSize + ' 로 나옴', n);
        const dw = style.match(/font-weight:\s*(\d{3})/);
        if (dw && cs.fontWeight !== dw[1])
          push('dead', 'font-weight ' + dw[1] + ' 로 적었는데 ' + cs.fontWeight + ' 로 나옴', n);
        if (/font:\s*[^;"]*\binherit\b/.test(style))
          push('dead', 'font 축약형에 inherit — 선언 전체가 무효입니다', n);

        // 글자를 직접 가진 요소만 대비·크기를 잽니다
        const own = [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
        if (!own) return;
        const size = parseFloat(cs.fontSize);
        const weight = parseInt(cs.fontWeight, 10) || 400;

        // 4) 너무 작은 글자
        // 축소본(비율 미리보기) 안은 화면 하한을 대지 않습니다 — 실제 내보내는
        // 그림은 이보다 큽니다.
        if (size < 10 && !n.closest('[data-scaled-preview]'))
          push('tiny', size + 'px 는 UI 하한(10px) 아래입니다', n);

        // 5) 변하는 숫자
        const txt = n.textContent.trim();
        if (NUM.test(txt) && CHANGING.test(txt) && !/tabular-nums/.test(cs.fontVariantNumeric))
          push('nums', '변하는 값인데 tabular-nums 가 없습니다', n);

        // 3) 대비
        const bd = backdrop(n, el);
        if (!bd) return;                       // 그림·그라데이션 위 — 눈으로 볼 것
        const fg = over(parse(cs.color), bd);
        const r = ratio(fg, bd);
        const large = size >= 18.66 || (size >= 14 && weight >= 700);
        const need = large ? 3 : 4.5;
        if (r < need) push('contrast', r.toFixed(2) + ':1 (필요 ' + need + ':1, ' + size + 'px/' + weight + ')', n);

      });
    });
    return out;
  };
})();
