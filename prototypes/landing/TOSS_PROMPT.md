# TOSS — All-in-One Finance Super-App Rebuild Prompt

Rebuild the supplied **toss.im** landing page as a production-quality, responsive, single-page website. Match the reference's layout, copy, imagery, typography, colour system, interactions, and scroll-driven motion as closely as possible.

Use the existing project framework and conventions. If starting from scratch, use **React + Vite**, semantic HTML, CSS, and **GSAP 3.12.5 + ScrollTrigger**. Build real, maintainable code—not a mockup. The reference streams live-action film and app-UI captures from a hashed CDN; supply your own equivalents (film chapters, phone-UI clips, product renders) and keep every local media path exactly as wired. Do not substitute meaning: each chapter's footage must show the feature its caption names.

## Design system

- Brand: toss, Korea's all-in-one finance super-app by Viva Republica.
- Tone: white-canvas confidence, one action per screen, colossal Korean display type, live-action film chapters, zero decoration that isn't information.
- Colours: `#FFFFFF` canvas, `#191F28` ink, `#4E5968` secondary, `#8B95A1` tertiary, `#0064FF` Toss Blue (the only accent), `#F2F4F6` subtle surface, `#E5E8EB` hairlines.
- Fonts: **Toss Product Sans** for display/UI (fallback **Pretendard**); every weight ≥500 — body 500, titles 700–800.
- Use tight negative letter spacing (−0.01 to −0.025em), fluid `clamp()` display sizes, 1200px content column, 20px mobile gutters.
- Mobile breakpoint: 768px.

Use:

```css
@import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css");

:root {
  --ink: #191F28;
  --ink-2: #4E5968;
  --ink-3: #8B95A1;
  --blue: #0064FF;
  --blue-dark: #0050D9;
  --paper: #FFFFFF;
  --surface: #F2F4F6;
  --line: #E5E8EB;
  --gutter: 1.25rem;
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  overflow-x: hidden;
  background: var(--paper);
  color: var(--ink);
  font-family: "Toss Product Sans", Pretendard, -apple-system, sans-serif;
  font-weight: 500;
  letter-spacing: -0.01em;
  word-break: keep-all;
}
img, video, canvas { display: block; max-width: 100%; }
a { color: inherit; text-decoration: none; }
button, input { font: inherit; }
h1, h2, h3 { font-weight: 800; letter-spacing: -0.02em; text-wrap: balance; margin: 0; }

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
```

## Site-wide behaviour

Fix a white header to the top: left `toss` wordmark (Toss Blue symbol + lowercase logotype); center nav `서비스 ▾`, `비즈니스 ▾`, `회사소개`, `뉴스룸`, `채용`; right `KOR ▾` language selector and an outlined pill `앱 다운로드`. The two dropdowns open borderless white panels listing services; the center nav hides on mobile.

Pin a **chapter rail** to the left edge for the entire page: one thin horizontal tick per chapter, stacked vertically at mid-height. The tick for the active chapter stretches longer and darkens to ink; ticks are clickable anchors. This rail is the page's only persistent scroll indicator.

Primary CTA buttons (`앱 다운로드`, `토스쇼핑 입점하기`, `토스에서 광고하기`) carry a **rolling label**: the label is duplicated vertically inside an overflow-hidden mask, and on hover the pair translates up one line-height so the second copy rolls in. 100–250ms, ease-out.

Use `IntersectionObserver` fade-and-rise reveals (24px, 400ms), keyboard-visible focus states, and lazy loading for every below-fold video.

Suggested React hierarchy:

```txt
src/
  components/
    Header, ChapterRail, HeroFilm, AssetSection, ExpertSection,
    ShoppingSteps, BizBridge, TossShopping, Settlement, AdsGrid,
    AdsData, Payments, FinaleFooter
  data/content.js
  hooks/useChapterScrub.js
  hooks/useInViewVideo.js
  styles/globals.css
  App.jsx
```

## 1. Hero scroll film

Build a ~500vh pinned section whose sticky stage plays a live-action brand film driven by scroll. On entry the video sits in an **inset rounded card** (14px margin from every viewport edge, 24px radius); within the first half-viewport of scroolling it expands to true fullscreen and the corners square off.

- Opening footage: a woman by a train window, city river passing, phone in hand.
- Across the film's bottom edge, one enormous white display line (clamp 64–120px), words spaced across the full width: `금융부터 일상까지   마침내   토스 하나로`
- As scroll advances, the film cuts through **feature chapters**; each chapter swaps the footage and shows one white caption at the left third, e.g.:
  - `몇 번만 누르면\n끝나는 송금` — over close-up footage of the 송금 keypad UI (`토스뱅크 통장에서`, `김지훈님에게`, `20,000원`, blue `다음` button).
  - a shopping chapter — a product spinning on cream ground inside the phone (`토마토 파스타 소스 340g`, `아모 이탈리안 ›`, ★4.5 `1,508`), then `결제가 완료됐어요 / 480포인트를 받았어요`.
- Scroll position scrubs `video.currentTime` (see Implementation); captions crossfade at fixed progress marks. The chapter rail highlights follow.

## 2. 자산 — accordion with sticky phone

White section, two columns: left copy + accordion, right a floating 3D-angled phone render with parallax UI cards spilling out of it (계좌 목록, `10월 카드값 2,190,000원`, `계좌 잔액 부족` alert chip, `15.00 USD 환전했어요`).

- Heading: `자산을 관리하는 일은\n한껏 단순하게`
- Accordion (one open at a time, hairline dividers; open item shows body + a small grey chip button with arrow):
  1. `내 자산 모아보기` — `입출금계좌와 예적금은 물론 주식 투자금까지.\n여러 금융사에 흩어진 모든 자산을 모아서 보여드려요.` — chip `내 자산 →`
  2. `내 자산 관리하기` — `카드값이나 대출금이 나가기 전에,\n계좌 잔액이 부족하면 알려줘서 연체되지 않게 막아드려요.` — chip `내 자산 →`
  3. `매일 이자 받기` — `이자 받는 날까지 기다릴 필요 없어요.\n토스뱅크는 이자를 언제 받을지 내가 선택할 수 있어요.` — chip `토스뱅크 →`
  4. `외화 환전하기` — `토스뱅크는 살 때도, 팔 때도 환전 수수료 평생 무료.\n24시간 내내 무료니까 필요할 때 마음 놓고 환전하세요.` — chip `토스뱅크 →`
- Opening an item animates height + swaps the phone's floating cards to that feature.

## 3. 전문가 — pinned metaphor sequence

Long pinned section (~250vh). Centered display heading enters first:

- `공부할 필요 없이\n누구나 금융 전문가로`
- Sub-line: `수많은 대출 카드 보험 앞에서 망설임은 사라지고` — the words `대출` `카드` `보험` render as floating chips that scatter as scroll advances.
- Then three product proofs slide through, each a card cluster + one line + a grey chip CTA:
  1. Loan compare: a rolling odometer settles on `6.15%`, bank rows `A 은행 4.60% · B 은행 8.04% · C 은행 7.30% · D 은행 6.48% · E 은행 5.10%`, caption `지금 바로 받을 수 있는\n대출 금리와 한도만 보여드려요`, CTA `내게 맞는 대출 찾기`.
  2. Card compare: `A은행 카드 포인트 2% 적립` vs `B은행 카드 포인트 3% 적립`, caption `내가 자주 쓰는 카드보다\n더 혜택 좋은 카드가 있는지 찾아드려요`, CTA `카드 혜택 비교하기`.
  3. Insurance report: `보험 분석 중...` then `내 보험 리포트` (수술비·실손 의료비·입원비·질병·응급), caption `전문가가 내 보험을 분석하고\n나에게 필요 없는 보장을 알려드려요`, CTA `내 보험 점검 받기`.
- Close with a drifting term-cloud in pale grey — `PER ROE 매수 매도 PBR CPI 호가 익절 손절 EPS FED 배당 ETF IPO 선물 옵션` — that sharpens into a clean 토스증권 chart panel.

## 4. 쇼핑 — sticky phone, stepped copy

Split layout: sticky centered phone on the left half playing shopping-flow captures; the right half scrolls three copy steps. Only the step nearest mid-viewport is ink; the others sit at 30% opacity.

1. `최저가는 알아서 찾아주고` — `가장 저렴한 상품을 제일 먼저 보여줘서\n수많은 사이트를 오가며 가격 비교하지 않아도 돼요.`
2. `할인 쿠폰·적립도 알아서 척척` — `쓸 수 있는 할인 쿠폰은 자동으로 적용되고,\n결제가 끝나면 현금처럼 쓸 수 있는 포인트가 쌓여요.`
3. CTA pill `토스에서 쇼핑하기 →`

Phone footage follows the steps: search list → coupon toggle sheet (`7,460원`, `1,000원 할인`, `토스포인트 사용 2,340원`) → `결제가 완료됐어요 / 480포인트를 받았어요` → `내일 도착`.

## 5. Business bridge

A short full-width band that pivots the audience from 고객 to 사장님: background flips to near-black ink, a single centered line introduces the business half (write it in Toss voice, e.g. `사장님의 비즈니스는 토스와 함께 자라요`), and the chapter rail ticks continue uninterrupted. Header nav context stays.

## 6. Toss Shopping — 입점

Dark section, thin vertical hairline grid in the background. Left: a seller-console mock (`상품노출 2,810 · 결제완료 124 · 매출 4,325,800`, bar rows `A상품…G상품`) and product cards (`블루투스 이어폰 ₩127,200`, `상품코드·재고 관리·노출 상태`). Right, eyebrow `Toss Shopping` in mono-style caps, then:

- `매달 800만명이 방문하는\n또 하나의 강력한 상권,\n토스쇼핑.`

Below, a calendar visual (Nov grid) beside:

- `안정적인 현금 흐름을 위해\n구매가 확정되면\n2일 안에 정산해드려요.`
- Rolling-label CTA `토스쇼핑 입점하기`.

## 7. Toss Ads — 광고 전략 그리드

Still dark. Eyebrow `Ads`, heading `상품마다 판매 전략이 다르듯\n광고 노출 전략도 다르게`. A 2×4 card grid, each card a label pair + looping preview tile:

```txt
판매량 늘리고 싶다면 — 라이브 마켓 & 숏폼
트래픽 필요하다면 — 혜택이 잘 보이는 리스트 광고
신규 고객 늘리고 싶다면 — 궁금증 유발하는 머니 알림
준비된 영상이 있다면 — 자동 플레이되는 동영상 광고
참여율 높이고 싶다면 — 고객이 답을 맞히는 행운 퀴즈
브랜딩 캠페인이라면 — 전달력 높은 풀스크린 광고
리워드 이벤트라면 — 참여율 높은 오늘의 포인트 미션
```

## 8. Toss Ads — 타기팅 데이터

Eyebrow `Toss Ads`. Heading `토스의 3,000만 고객이\n내 고객이 될 때까지`, sub `우리 상품을 좋아할 고객만 찾아서\n비용은 최소화・효과는 극대화`, body `토스애즈는 고객이 동의한 데이터로 브랜드의 잠재 고객을 찾아내요.\n평소 어디에 돈을 쓰는지 보면 다음엔 뭘 살지도 예상할 수 있거든요.\n맞춤형 광고로 보여주니 고객 입장에서는 유용한 정보라고 느끼죠.` Rolling-label CTA `토스에서 광고하기`.

Three data rows with looping micro-videos:

- `이동/생활 데이터` — `반려동물 보유, 여행 관심도, 시간별 소비 집중도 등`
- `금융 데이터` — `보유 계좌, 대출 여부, 보험 가입 여부, 투자 성향 등`
- `소비 데이터` — `특정 브랜드 선호도, 멤버십 구독 여부, 카드 사용 패턴 등`

## 9. Toss Payments

Eyebrow `Toss payments`. Heading `함께 매출을 만드는\n든든한 비즈니스 파트너로서` with integration copy beginning `직접 개발할 필요 없…` — a code-panel visual with the payments SDK snippet typing itself in, then a merchants logo band.

## 10. Finale + footer

The page exits the dark business half into a full-viewport dawn-sky gradient photograph (soft blue-grey clouds). Top-left, one closing line in white: `마침내 토스 하나로.`

The footer sits directly on the sky:

- Link columns: 토스뱅크 · 토스증권 · 토스페이먼츠 · 토스플레이스 · 토스모바일 · 토스인컴 · 토스인슈어런스 · 토스씨엑스 | 토스피드 · 기술 블로그 · 디자인 블로그 · 토스 임팩트 · 브랜드 리소스센터 | 공지사항 · 자주 묻는 질문 · 불만사항 접수 · 24시간 고객센터 · IR · 문의하기 | 공동인증서 관리 · 계정 일시 잠금 · 개인정보 보호 · 윤리경영 · 공정거래 · 상담/신고
- Company block: `사업자 등록번호: 120-88-01280 | 대표: 이승건`, hosting/판매업 lines, 주소, then policy links (`개인정보 처리방침`은 굵게) and `청소년 보호정책`.
- Behind everything, a viewport-wide watermark `All in one App` at ~5% white, clipped by the bottom edge.
- `© Viva Republica Inc. All rights reserved.`

## Implementation requirements

Install GSAP:

```bash
npm install gsap
```

Register GSAP once and clean every animation on unmount:

```js
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

useLayoutEffect(() => {
  const context = gsap.context(() => {
    // Create timelines and ScrollTriggers here.
  }, rootRef);

  return () => context.revert();
}, []);
```

Hero film scrub — pin the stage and map progress to chapters, never autoplay past a chapter boundary:

```js
const st = ScrollTrigger.create({
  trigger: hero, start: "top top", end: "+=400%",
  pin: true, scrub: 0.6, invalidateOnRefresh: true,
  onUpdate(self) {
    const v = videoRef.current;
    if (v?.duration && !v.seeking) v.currentTime = self.progress * v.duration;
    setChapter(CHAPTERS.findLastIndex(c => self.progress >= c.at));
  },
});
```

Encode the film with a tight GOP (`-g 8`, no audio, `+faststart`) so seeking stays smooth; keep the inset-card→fullscreen expansion on the card wrapper (`width/height/borderRadius` via a scrubbed timeline), not on the video element.

Rolling-label button:

```css
.roll { overflow: hidden; }
.roll i { display: block; font-style: normal;
  transition: transform .22s cubic-bezier(0.22, 1, 0.36, 1); }
.roll:hover i { transform: translateY(-100%); }
```

```html
<button class="btn-blue roll"><i>토스쇼핑 입점하기<br>토스쇼핑 입점하기</i></button>
```

Odometer for `6.15%`: roll random digits for ~1.2s inside `tabular-nums` spans, settle exactly once when the loan card first enters the viewport. Shopping steps: one `IntersectionObserver` at `rootMargin: "-40% 0px -40% 0px"` toggles the active step and swaps the sticky phone's clip. Accordion: single-open, height animated via GSAP, `aria-expanded`/`aria-controls` wired.

On mobile: hide the center nav and chapter rail; hero captions drop to 40px; two-column sections stack (phone above copy); the ads grid becomes one column; footer columns wrap to two.

## Completion checklist

1. Run the project build and fix all errors.
2. Confirm no runtime console errors.
3. Confirm every wired media file loads, and each chapter's footage matches its caption.
4. Confirm the hero pin scrubs the film smoothly both directions and the inset card expands exactly once.
5. Confirm the chapter rail tracks every section and its ticks jump correctly on click.
6. Confirm the accordion, rolling-label hovers, odometer, shopping step switcher, and dropdown navs work.
7. Confirm reduced-motion mode reveals all content with the film paused on chapter posters.
8. Do not stop at a simplified version: implement the full page and interactions.
