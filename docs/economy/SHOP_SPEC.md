# 상점 구조 설계 — 학생회관 아이템 상점

가격·획득은 [COIN_ECONOMY.md](COIN_ECONOMY.md) 를 따릅니다.
확정 수치는 [`src/constants/coin.ts`](../../src/constants/coin.ts) 가 정답입니다.

기존 [`src/constants/storeItems.ts`](../../src/constants/storeItems.ts) 는 과잠·백팩 2종
구조입니다. 이 문서는 그것을 대체하는 새 구조이고, **기존 파일은 아직 손대지 않았습니다.**
전환 순서는 COIN_ECONOMY §6.3 입니다.

---

## 1. 카테고리

| 카테고리 | id | 가격대 | 동시 착용 |
|---|---|---|---|
| 상의 | `top` | 150~250 | 1 |
| 하의 | `bottom` | 150~250 | 1 |
| 신발 | `shoes` | 150~250 | 1 |
| 모자 | `hat` | 100~200 | 1 |
| 안경 | `glasses` | 100~200 | 1 |
| 가방 | `bag` | 150~250 | 1 |
| 캐릭터(알) | `egg` | 800 / 2000 | – (부화 후 캐릭터로) |

각 카테고리는 **한 번에 하나만** 장착합니다. 슬롯이 카테고리와 1:1 이라
"장착 = 그 슬롯 교체" 로 규칙이 하나뿐입니다.

---

## 2. 아이템 데이터 구조

```ts
/** 상점 카테고리 = 착용 슬롯 (알 제외) */
export type ShopCategory =
  | 'top'
  | 'bottom'
  | 'shoes'
  | 'hat'
  | 'glasses'
  | 'bag'
  | 'egg'

/** 착용 슬롯 — 알은 착용물이 아니므로 빠집니다 */
export type WearSlot = Exclude<ShopCategory, 'egg'>

export type Rarity = 'common' | 'rare' | 'season'

/**
 * 스프라이트 겹치는 순서 (작을수록 뒤).
 * 캐릭터 본체는 20 이라, 가방끈처럼 몸 뒤로 가는 조각은 10 을 씁니다.
 */
export const WEAR_LAYER: Record<WearSlot, number> = {
  bag: 10,
  bottom: 30,
  shoes: 40,
  top: 50,
  glasses: 70,
  hat: 80,
}
export const BODY_LAYER = 20

export interface ShopItem {
  id: string
  name: string
  description: string
  category: ShopCategory
  /** 코인 가격 — COIN_PRICES 범위 안 */
  price: number
  rarity: Rarity
  /** 시즌 한정이면 시즌 id, 상시 판매면 null */
  seasonId: string | null
  /** 착용 슬롯. 알은 null */
  slot: WearSlot | null
  /** public/ 기준 경로. 알은 부화 연출용 스프라이트 */
  sprite: string
  /** 캐릭터 종류별로 다른 그림이 필요한 옷 — 종류별 경로 */
  spriteByCharacter?: Record<string, string>
}

/** 알을 열면 나오는 캐릭터 */
export interface CharacterItem {
  id: string
  name: string
  rarity: Exclude<Rarity, 'season'>
  /** 성장 단계별 스프라이트 — CHARACTER_STAGES 와 같은 6단계 */
  stageSprites: string[]
}
```

### 예시

```ts
const example: ShopItem = {
  id: 'top-navy-jacket',
  name: '네이비 과잠',
  description: '차분한 캠퍼스의 상징색.',
  category: 'top',
  price: 200,
  rarity: 'common',
  seasonId: null,
  slot: 'top',
  sprite: '/assets/wardrobe/top-navy-jacket.png',
}
```

기존 `jacket-navy` · `backpack-freshman` id 는 인벤토리에 이미 저장돼 있으므로
**id 를 바꾸지 않고** `category`/`slot` 만 덧붙여 이관합니다
(`jacket-*` → `top`, `backpack-*` → `bag`).

---

## 3. 착용 / 해제 상태 저장

```ts
/** 슬롯 → 아이템 id. 비어 있으면 그 슬롯은 해제 상태 */
export type EquippedBySlot = Partial<Record<WearSlot, string>>

export interface WardrobeState {
  /** 보유 아이템 id */
  inventory: string[]
  /** 보유 캐릭터 id */
  characters: string[]
  /** 현재 캐릭터 — 항상 characters 안의 값 */
  activeCharacterId: string
  equipped: EquippedBySlot
}
```

- 기존 `EquippedItems { jacketId?, backpackId? }` 는 `{ top, bag }` 으로 옮깁니다.
  마이그레이션은 1줄짜리 매핑이라 별도 버전 필드가 필요 없습니다.
- 장착 규칙은 기존 `progressionStore.equipItem` 그대로: **보유하지 않은 아이템은
  장착되지 않습니다.** 해제는 `equip(slot, undefined)`.
- 저장 위치도 그대로 `localStorage` (`STORAGE_KEYS.progression`). 착용 상태는
  개인 취향 데이터일 뿐 자세·영상과 무관해서 서버로 보낼 이유가 없습니다.

### 렌더 순서

```ts
function renderOrder(state: WardrobeState, items: Map<string, ShopItem>) {
  const worn = Object.entries(state.equipped)
    .flatMap(([slot, id]) => {
      const item = id ? items.get(id) : undefined
      return item ? [{ item, layer: WEAR_LAYER[slot as WearSlot] }] : []
    })
  return [...worn, { item: null, layer: BODY_LAYER }].sort((a, b) => a.layer - b.layer)
}
```

---

## 4. 랜덤 뽑기 — **권장은 "뽑기 없음"**

먼저 결론부터: **알을 확률형으로 만들지 않기를 권합니다.**

1. 한국 게임산업법(2024.3 시행)상 확률형 아이템은 **확률 상시 표시 의무**가 있고,
   표시 누락은 시정명령·과태료 대상입니다. 프로토타입 단계에서 감당할 운영 부담이 큽니다.
2. 주 이용자가 대학생이지만 연령 제한이 없는 서비스라, 미성년 이용자가 섞이면
   심의·스토어 정책이 한 단계 더 붙습니다.
3. 무엇보다 제품 메시지와 안 맞습니다. 이 앱의 보상은 "꾸준히 하면 반드시 온다" 인데,
   뽑기는 "운이 좋아야 온다" 입니다.

**대안 — 확정 구매.**

| 상품 | 가격 | 결과 |
|---|---|---|
| 일반 알 | 800 | 일반 캐릭터 목록에서 **내가 고른** 1종 |
| 레어 알 | 2000 | 레어 캐릭터 목록에서 **내가 고른** 1종 |

이러면 확률 표시·천장·중복 보정이 전부 필요 없어집니다.
아래는 그럼에도 뽑기를 넣기로 결정할 경우의 규칙입니다.

### 4.1 뽑기를 넣는다면

```ts
export interface GachaPool {
  id: string
  price: number
  /** 표시용 — 합이 정확히 1 이어야 합니다 */
  odds: { characterId: string; rate: number }[]
  /** 천장: 이 횟수만큼 레어가 안 나오면 다음 뽑기는 레어 확정 */
  pityCount: number
}
```

- **확률 공개**: 상점 화면에 상시 노출. 접었다 펴는 UI 안이 아니라 구매 버튼 **바로 위**에
  전체 목록과 개별 확률(소수점 둘째 자리)을 표시합니다. 뽑기 결과 화면에도 같은 표를 재노출.
- **천장은 필수**: 일반 알 기준 레어 확률 10%, 천장 **10회**. 10회 연속 미획득 시
  11회차 레어 확정. 천장 카운터는 화면에 항상 숫자로 보여줍니다("레어까지 남은 횟수 3").
  천장 없는 확률형은 저확률 구간에서 체감이 무너져 이탈로 직결됩니다.
- **중복 보정**: 이미 가진 캐릭터가 나오면 **가격의 50%(400코인) 환급**.
  중복은 뽑기 불만의 최대 원인이고, 환급은 구현이 한 줄입니다.
- **레어 알(2000)은 레어 확정 상품**으로 두어 "확실히 사는 길"을 항상 열어둡니다.
  → 이게 열려 있으면 4.1 전체가 사실 필요 없다는 게 §4 결론의 근거입니다.

---

## 5. 시즌 한정 운영

연 4회, 중간고사·기말고사 기준. 학사일정과 맞물려 이용량이 오르는 시기입니다.

| 시즌 | 기간 | 테마 |
|---|---|---|
| S1 봄 중간 | 4월 | 벚꽃·신입생 |
| S2 여름 기말 | 6월 | 여름·에어컨 도서관 |
| S3 가을 중간 | 10월 | 단풍·축제 |
| S4 겨울 기말 | 12월 | 눈·패딩 |

규칙:

- 시즌 한정 아이템은 해당 시즌(약 4주)에만 판매, 가격 **1500** 고정.
- 판매 종료 후 **재판매하지 않습니다.** 이미 산 사람은 계속 착용·표시 가능.
- 종료 2주 전부터 상점 상단에 남은 기간 표시. "지금 아니면 못 산다"를
  마감 압박이 아니라 정보로만 전달합니다(카운트다운 애니메이션·붉은색 금지).
- 시즌 판별은 상점 전용 달력을 씁니다. 캠퍼스 시즌(`SEASON_LENGTH_MS` = 14일)과
  **주기가 다르므로 함께 쓰지 않습니다.** (COIN_ECONOMY §5 문제 6)

```ts
export interface ShopSeason {
  id: string            // 'shop-2026-s1'
  name: string          // '봄 중간고사 시즌'
  startsAt: number
  endsAt: number
}

export function activeShopSeason(now: number): ShopSeason | null
export function isPurchasable(item: ShopItem, now: number): boolean
```

`isPurchasable` 은 `seasonId === null` 이면 항상 true, 아니면 현재 시즌 id 와 같을 때만 true.

---

## 6. 화면 구성

```
┌──────────────────────────────────────────────────────────┐
│  학생회관 상점                              🪙 1,240      │
├────────────────────────┬─────────────────────────────────┤
│                        │  [상의][하의][신발][모자]        │
│                        │  [안경][가방][캐릭터]  ← 탭      │
│      캐릭터 미리보기    │                                 │
│                        │  ┌────┐ ┌────┐ ┌────┐          │
│      (착용 결과가       │  │네이비│ │버건디│ │포레스트│      │
│       실시간 반영)      │  │ 200 │ │ 200 │ │ 보유중│      │
│                        │  └────┘ └────┘ └────┘          │
│  ┌──────────────────┐  │  ┌────┐ ┌────┐                 │
│  │ 착용 중          │  │  │벚꽃 │ │ ... │                 │
│  │ 상의 네이비 과잠 ✕│  │  │1500 │                        │
│  │ 가방 도서관 백팩 ✕│  │  │D-12 │  ← 시즌 한정          │
│  └──────────────────┘  │  └────┘                        │
│                        │                                 │
│   [ 전체 해제 ]         │        [ 구매하기  200 ]        │
└────────────────────────┴─────────────────────────────────┘
```

- **왼쪽 미리보기**: 아이템을 고르면 **사기 전에** 캐릭터에 즉시 입혀 보여줍니다(가상 착용).
  구매하지 않고 화면을 벗어나면 원래 착용 상태로 되돌아갑니다.
- **오른쪽 목록**: 카테고리 탭 + 카드 그리드. 보유한 아이템은 가격 대신 "보유중",
  카드를 누르면 바로 장착됩니다. 살 수 없는 가격은 카드가 흐려지고 잔액 부족을 표시.
- **잔액은 항상 우상단 고정**. 구매 후 숫자가 줄어드는 걸 눈으로 보게 합니다.
- 착용 중 목록의 ✕ 로 슬롯별 해제, 아래 버튼으로 전체 해제.
- 모바일(768px 미만)에서는 위아래로 쌓되 **미리보기를 화면 상단에 고정**해서
  스크롤 중에도 착용 결과가 보이게 합니다.
- 상점 진입은 첫 세션 완료 후(`shopUnlocked`)라는 기존 규칙을 유지합니다.

### 접근성

- 카테고리 탭은 `role="tablist"` + 좌우 화살표 이동.
- 아이템 카드는 버튼이고, 이름·가격·보유 여부를 한 문장으로 읽어 줍니다
  ("네이비 과잠, 200코인, 구매 가능").
- 색만으로 레어도를 구분하지 않습니다. 레어·시즌 한정은 텍스트 배지를 함께 답니다.

---

## 7. 결정이 필요한 항목

| # | 항목 | 기본값 | 이유 |
|---|---|---|---|
| S1 | 뽑기 도입 여부 | **도입 안 함** (확정 구매) | §4 — 법·심의·제품 메시지 |
| S2 | 가방 가격대 | 150~250 | 지시에 값이 없었습니다 |
| S3 | 옷의 캐릭터별 스프라이트 | 종류별로 그림 필요 | 캐릭터 N종 × 옷 M종 = N×M 장. 제작량이 폭발합니다. 몸통 규격을 통일해 1장으로 돌려 쓸지 결정 필요 |
| S4 | 시즌 한정 재판매 | 하지 않음 | "한정"의 의미를 지키되, 못 산 이용자 불만이 쌓일 수 있습니다 |
| S5 | 상점 시즌 달력 | 상점 전용 4주 | 캠퍼스 14일 시즌과 분리 (COIN_ECONOMY §5 문제 6) |
