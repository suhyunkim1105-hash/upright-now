import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test, expect, type Page } from '@playwright/test'

/**
 * 이식 대조 검사 - 프로토타입과 `src/features/world/art.ts` 가 같은 그림을
 * 내는지 봅니다.
 *
 * **양쪽을 같은 브라우저에서 잽니다.** 처음에는 프로토타입 지문을 파일에
 * 얼려 두고 이식본만 재도록 짰는데, 22 개 캔버스가 어긋났습니다. 원인은
 * 이식이 아니라 자였습니다 - 얼린 값은 GPU 가 있는 창에서 쟀고 테스트는
 * 헤드리스라 소프트웨어 래스터라이저를 씁니다. 반투명(rgba)을 쓰는 그림만
 * 어긋난 것이 단서였습니다. 알파 합성은 백엔드에 따라 반올림이 1 씩
 * 다릅니다. 불투명만 쓰는 25 개는 처음부터 일치했습니다.
 *
 * 그래서 한 세션 안에서 프로토타입을 열어 재고, 이식본을 열어 재서
 * 맞춥니다. 같은 자로 재면 백엔드가 무엇이든 상관없습니다.
 *
 * jsdom 이 아닌 이유 - jsdom 에는 캔버스 2d 컨텍스트가 없어
 * getContext('2d') 가 null 입니다. 픽셀을 재려면 진짜 브라우저가 필요합니다.
 */

/* The prototype under development, not the copy inside this repo.
 *
 * This used to point at upright-now/prototypes/openworld/index.html, which is
 * a snapshot taken when the port was generated. Comparing the port against
 * that snapshot compares two frozen copies of the same thing: the test was
 * green for two days while the real prototype moved underneath it, and it
 * reported parity three times over changes it had never seen.
 *
 * A test whose reference is a copy of its subject cannot fail for the reason
 * it exists. Pointing at the live file means this goes red whenever the port
 * falls behind, which is the fact it is supposed to report.
 */
const PROTOTYPE = pathToFileURL(
  fileURLToPath(new URL('../../prototypes/openworld/index.html', import.meta.url)),
).href

/** 파일에 얼려 둔 값 - 픽셀이 아니라 **개수와 배치**만 지킵니다.
 *  이쪽은 래스터라이저와 무관해서 환경이 달라도 흔들리지 않습니다. */
const frozen = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../src/features/world/__baseline__/prototype.json', import.meta.url)),
    'utf8',
  ),
) as {
  counts: { painted: number; props: number; zones: number }
  props: Record<string, string>
  zones: Record<string, { w: number; h: number; solid: number; props: number }>
}

type Shot = {
  painted: Record<string, string>
  props: Record<string, string>
  zones: Record<string, unknown>
}

/** 페이지 안에서 돌 코드. 프로토타입은 전역에, 이식본은 모듈에 있어
 *  집어 오는 방법만 다르고 재는 방법은 같습니다. */
const MEASURE = `(async (fromModule) => {
  const art = fromModule
    ? await import('/src/features/world/art.ts')
    : { PAINTED, PROP, ZONES };   // 클래식 스크립트의 최상위 const 는 전역 렉시컬 스코프에 있습니다. window 에는 없습니다

  const fp = (cv) => {
    if (!cv) return null;
    const g = cv.getContext('2d');
    const d = g.getImageData(0, 0, cv.width, cv.height).data;
    let h = 2166136261;
    for (let i = 0; i < d.length; i += 4) {
      h ^= d[i] + d[i + 1] * 3 + d[i + 2] * 7 + d[i + 3] * 11;
      h = Math.imul(h, 16777619);
    }
    return cv.width + 'x' + cv.height + ':' + (h >>> 0).toString(36);
  };

  const painted = {};
  for (const k of Object.keys(art.PAINTED).sort()) painted[k] = fp(art.PAINTED[k]);

  const props = {};
  for (const k of Object.keys(art.PROP).sort()) {
    const d = art.PROP[k];
    props[k] = d.w + 'x' + d.h + '|' + (d.s || '?') + '|c=' + JSON.stringify(d.c)
             + (d.canvas ? '|' + fp(d.canvas) : '');
  }

  const zones = {};
  for (const id of Object.keys(art.ZONES)) {
    const m = art.ZONES[id];
    let solid = 0;
    for (let i = 0; i < m.solid.length; i++) solid += m.solid[i];
    const kinds = {};
    for (const p of m.props) kinds[p.kind] = (kinds[p.kind] || 0) + 1;
    zones[id] = {
      w: m.w, h: m.h, solid, props: m.props.length, kinds,
      portals: m.portals.map((p) => p.x + ',' + p.y + ',' + p.w + 'x' + p.h + '->' + p.to).sort(),
      things: (m.things || []).map((t) => t.x + ',' + t.y + ':' + t.name).sort(),
      npcs: (m.npcs || []).length,
      spawn: m.spawn ? m.spawn.x + ',' + m.spawn.y : null,
      floor: fp(m.floor), ground: fp(m.ground),
      walls: (m.walls || []).map((w) => w.x + ',' + w.y + ':' + fp(w.c)),
    };
  }
  return { painted, props, zones };
})`

async function measure(page: Page, fromModule: boolean): Promise<Shot> {
  return page.evaluate(
    ([src, flag]) => (0, eval)(src as string)(flag),
    [MEASURE, fromModule] as const,
  ) as Promise<Shot>
}

test.describe('월드 이식 대조', () => {
  test('그림·기물·존이 프로토타입과 같다', async ({ page }) => {
    /* 1. 프로토타입을 같은 브라우저에서 잽니다.
       여기서는 오류를 보지 않습니다 - file:// 로 열면 시트 이미지가 캔버스를
       오염시켜 getImageData 가 SecurityError 를 던집니다. 프로토타입이
       원래 브라우저로 직접 여는 물건이라 생기는 제약이고, 이식본과는
       상관없습니다. 손으로 그린 캔버스는 오염되지 않아 그대로 잽니다. */
    await page.goto(PROTOTYPE)
    await page.waitForFunction(
      () => Boolean((0, eval)('typeof ZONES !== "undefined" && ZONES.campus && ZONES.campus.solid')),
      null,
      {
      timeout: 15_000,
    })
    const proto = await measure(page, false)

    /* 2. 이식본 - 여기는 오류가 하나도 없어야 합니다 */
    const errs: string[] = []
    page.on('pageerror', (e) => errs.push(String(e)))
    await page.goto('/')
    const port = await measure(page, true)

    expect(errs, '이식본 콘솔 오류').toEqual([])

    /* 개수 - 통째로 빠진 것이 있으면 여기서 걸립니다 */
    expect(Object.keys(port.painted).length, '그려 둔 캔버스 수').toBe(frozen.counts.painted)
    expect(Object.keys(port.props).length, '기물 수').toBe(frozen.counts.props)
    expect(Object.keys(port.zones).length, '존 수').toBe(frozen.counts.zones)

    /* 그림 - 한 픽셀이라도 다르면 걸립니다 */
    expect(port.painted, '캔버스 지문').toEqual(proto.painted)

    /* 기물 - 크기·충돌격자·그림 */
    expect(port.props, '기물 정의').toEqual(proto.props)

    /* 존 - 통째로 비교하면 무엇이 다른지 안 보여 하나씩 봅니다 */
    for (const id of Object.keys(proto.zones)) {
      expect(port.zones[id], `존 ${id}`).toEqual(proto.zones[id])
    }
  })

  test('존의 크기·충돌·기물 수가 얼려 둔 값과 같다', async ({ page }) => {
    /* 픽셀과 달리 이 숫자들은 래스터라이저와 무관합니다. 프로토타입을
       나중에 고쳤을 때 "고친 것" 과 "망가진 것" 을 갈라 주는 그물입니다. */
    await page.goto('/')
    const port = await measure(page, true)

    for (const [id, want] of Object.entries(frozen.zones)) {
      const got = port.zones[id] as { w: number; h: number; solid: number; props: number }
      expect(got, `존 ${id} 가 없습니다`).toBeTruthy()
      expect({ w: got.w, h: got.h, solid: got.solid, props: got.props }, `존 ${id}`).toEqual({
        w: want.w, h: want.h, solid: want.solid, props: want.props,
      })
    }
    expect(port.props, '기물 정의 (크기·충돌격자)').toMatchObject(
      Object.fromEntries(
        Object.entries(frozen.props).map(([k, v]) => [k, expect.stringContaining(v.split('|c=')[1].split('|')[0])]),
      ),
    )
  })
})
