# 건물별 배경음악 — 실제 공개 음원 후보 조사

**조사만 했습니다. 코드는 한 줄도 안 고쳤습니다.** 지금 월드의 소리는
전부 WebAudio 로 그 자리에서 만들고, 이 저장소에는 **오디오 파일이 한 장도
없습니다**(`prototypes/openworld/index.html` MUSIC / AMBIENCE).

수현 요청: *"건물 별 백색 소음도 실제 있는 공개 음악으로 교체해야 될 것
같아."*

읽는 순서 — §1 결론 → §5 표 → §6 용량 → §7 앰비언트 처리.

---

## 1. 결론부터

| | |
|---|---|
| **권장** | **CC0 만 씁니다.** OGG 로 통일하고 곡당 2MB 를 넘기지 않습니다 |
| **1순위 출처** | OpenGameArt(CC0) — 파일 크기가 페이지에 그대로 적혀 있어 계산이 됩니다 |
| **쓰지 말 것** | FreePD(**폐쇄됨**), Pixabay(**CC0 아님**), YouTube·Spotify(라이선스 없음) |
| **CC-BY 는** | 쓸 수 있지만 화면에 표기 자리를 만들어야 합니다. 그 자리를 안 만들 거면 CC0 만 |
| **앰비언트** | **남깁니다.** 음악만 갈아 끼웁니다 (§7) |
| **아티팩트** | 지금 5.10MB. 작은 루프 여섯이면 **8.3MB**, 큰 mp3 여섯이면 41MB (§6) |

---

## 2. 조사하면서 확인한 것 — 시작점 넷 중 둘이 못 씁니다

### FreePD — **없어졌습니다**

<https://freepd.com/> 에 남은 것은 폐쇄 공지 한 장입니다. 그대로 옮기면:

> "After 17 years of sharing millions of free-to-use, Public Domain music
> downloads with creators worldwide, we have officially taken the service
> offline." / "[freepd.com] is now permanently closed." (2008–2025)

받아 둔 파일이 있으면 퍼블릭 도메인이라 계속 쓸 수 있지만, **새로 받을
곳이 없습니다.** 후보에서 뺍니다.

### Pixabay Music — **CC0 가 아닙니다**

지금은 CC0 가 아니라 자체 **Pixabay Content License** 입니다
(<https://pixabay.com/service/license-summary/>). 그 문서에서:

> "Use Content without having to attribute the author (although giving credit
> is always appreciated by our community!)"
>
> "You cannot sell or distribute Content (either in digital or physical form)
> on a Standalone basis"

표기는 필요 없지만 **CC0·CC-BY·퍼블릭 도메인 중 어느 것도 아닙니다.**
게임 안에 넣는 용도는 "standalone 배포" 가 아니라서 실무상 통과할 가능성이
높지만, "CC0/CC-BY/PD 만" 이라는 기준에는 **안 맞습니다.** 발표에서
"이건 무슨 라이선스예요" 라는 질문을 받으면 대답이 한 줄로 안 끝납니다.
그래서 뺍니다.

### Incompetech (Kevin MacLeod) — **CC BY 4.0, 표기 필수**

<https://incompetech.com/music/royalty-free/faq.html> 에서 요구하는 표기
형식이 이것입니다(Title 자리에 곡 이름):

> "Title Kevin MacLeod (incompetech.com) Licensed under Creative Commons:
> By Attribution 4.0"

표기가 곤란한 곳(TV·라디오 광고 등)을 위한 **유료 Standard License** 가
따로 있습니다(<https://incompetech.com/music/royalty-free/licenses/>):
"No charge. Requires that you credit the music." / "For projects where
attribution is not wanted or is impossible".

**곡별 길이·용량은 못 적었습니다.** 곡 페이지가 자바스크립트로 그려져서
가져온 문서에 "No Track selected" 만 들어 있었습니다. 이 출처를 쓰기로
정하면 브라우저로 직접 열어 확인해야 합니다.

### OpenGameArt — **쓸 수 있습니다.** 아래 표의 대부분이 여기입니다

각 페이지에 첨부 파일 이름과 **용량이 그대로 적혀 있어** 계산이 됩니다.
다만 CC0 · CC-BY · CC-BY-SA · OGA-BY 가 섞여 있으므로 **작품마다** 확인해야
합니다. 아래 표는 전부 실제 페이지를 열어서 적었습니다.

---

## 3. 라이선스 원문 — 표기가 필요한가

### CC0 1.0 (<https://creativecommons.org/publicdomain/zero/1.0/>)

> "The person who associated a work with this deed has **dedicated** the work
> to the public domain by waiving all of his or her rights to the work
> worldwide under copyright law"

- 표기 **불필요**. 상업적 사용·수정·재배포 자유.
- 다만 "you should not imply endorsement by the author or the affirmer".
- 특허·상표·초상·프라이버시 권리는 그대로 남습니다.

### CC BY 4.0 (<https://creativecommons.org/licenses/by/4.0/>)

- 표기 **필수**. 저작자 이름 · 출처 · 라이선스 이름과 링크 · 수정 여부.
- 표기가 없으면 라이선스 위반입니다. "나중에 넣자" 가 안 됩니다.

### 이 저장소의 전례

`OPEN_SOURCE_CREDITS.md` 가 이미 있습니다(미니게임 MIT 출처). CC-BY 를
쓰기로 하면 **여기에 절을 하나 더 붙이는 것으로 끝나지 않습니다** —
CC-BY 는 저작물이 쓰이는 화면에서 닿을 수 있어야 해서, 마이페이지에
"음악 출처" 줄 하나가 더 필요합니다. 그 줄을 만들 생각이 없으면 CC0 만
쓰는 것이 맞습니다.

---

## 4. 지금 코드가 소리를 어떻게 나누는가 (교체 대상 확인)

`index.html` 의 두 표입니다. 갈아 끼울 것은 **아래쪽 하나뿐**입니다.

```
AMBIENCE   장소별 잡음 — library / mainhall / dorm / union / campus / arcade
           분홍잡음을 필터로 깎습니다. 광장·본관·기숙사·학생회관·미니게임관은
           화음(tone)을 얹습니다.

MUSIC      곡 넷 — calm(조용한 오후) · bright(볕 드는 마당) · warm(저녁 방) · night(늦은 밤)
ZONE_TRACK library→calm  mainhall→calm  dorm→warm  union→bright
           campus→bright  arcade→bright
```

곡이 **넷**이고 자리가 **여섯**입니다. 지금 본관은 도서관과 같은 곡이고
(코드 주석: "둘 다 집중하는 곳이라 음악까지 다르면 공간이 아니라 곡이
기억에 남습니다"), 미니게임관은 학생회관과 같은 곡입니다("3분 있다 나오는
방이 제일 기억에 남습니다"). **이 묶음을 그대로 두면 파일이 넷이면 됩니다.**
아래 표는 여섯 자리를 다 채우되, 넷으로 줄이는 안도 §5.7 에 적었습니다.

`night`(늦은 밤)는 어느 장소의 기본도 아닙니다 — 마이페이지에서 사람이
직접 고를 때만 나옵니다.

---

## 5. 후보 표

용량은 **각 페이지에 표시된 값 그대로**입니다.
이 샌드박스는 외부 파일을 받을 수 없어(egress 정책) **직접 받아 잰 값이
아닙니다.** 실제로 넣기 전에 한 번 받아서 확인해야 합니다.

### 5.1 광장 (campus) — 밝고 바깥, 낮

| # | 곡 · 작가 | 출처 | 라이선스 | 표기 | 파일 · 용량 |
|---|---|---|---|---|---|
| A1 | **Feel Good Island Loop** · AntumDeluge (원곡 Brandon Morris) | [OGA](https://opengameart.org/content/feel-good-island-loop) | **CC0** (+ OGA-BY 3.0 병기) | 불필요 | `feel_good_island_loop.ogg` **356.7 KB** / `.flac` 2.3 MB |
| A2 | **Birds and Wind – Ambient** · Spring Spring | [OGA](https://opengameart.org/content/birds-and-wind-ambient-birds-wind-and-synth) | **CC0** | 불필요 (새소리 기여자 isaiah658·syncopika·pauliuw 는 PD) | `Birds and Wind - Ambient.ogg` **1.9 MB** (긴 판 6.1 / 13.9 MB 도 있음) |
| A3 | Mystical RPG Maker Town Theme · symphony | [OGA](https://opengameart.org/content/mystical-rpg-maker-town-theme) | **CC0** | 선택 ("Music by symphony") | `.ogg` **1.8 MB** (1:13, 이음매 없음) / `.wav` 12.9 MB / `.flp` 324.3 KB |

**A1 추천.** 356.7 KB 에 이음매가 맞고, 밝은 낮 광장에 그대로 맞습니다.

### 5.2 도서관 (library) — 오래 앉는 자리, 아주 조용

| # | 곡 · 작가 | 출처 | 라이선스 | 표기 | 파일 · 용량 |
|---|---|---|---|---|---|
| B1 | **First Light Particles** · Yoiyami | [OGA](https://opengameart.org/content/first-light-particles-%E2%80%93-cc0-atmospheric-pianoambient-track) | **CC0 1.0** | 불필요 (선택: "Music by Yoiyami (CC0)") | `first_light_particles.wav` **25.3 MB** → **OGG 로 변환 필요** |
| B2 | **Heavenly Loop** · isaiah658 | [OGA](https://opengameart.org/content/heavenly-loop) | **CC0** | 불필요 | `Heavenly Loop.ogg` **1.2 MB** / `.flac` 2.1 MB |
| B3 | Chill lofi inspired [loop edit] · qubodup (원곡 omfgdude) | [OGA](https://opengameart.org/content/chill-lofi-inspired-loop-edit) | **CC0** | 불필요 | `chilllofir-loop.ogg` **2.4 MB** |

B1 의 라이선스 문구를 그대로 옮기면:

> "You may use this track in: • commercial and non-commercial games • videos,
> streams, and trailers • mods, demos, prototyping • standalone soundtracks •
> any derivative works. No attribution is required, but you may credit:
> Music by Yoiyami (CC0)"

**B2 추천.** 1.2 MB OGG 로 바로 씁니다. B1 은 곡은 더 맞는데 wav 25.3 MB 라
직접 인코딩해야 하고, CC0 이므로 변환·재배포는 자유입니다.

### 5.3 본관 (mainhall) — 끊어 앉는 자리, 낮게 웅웅

지금 코드는 본관에 도서관과 **같은 곡**(calm)을 씁니다. 그 결정을 유지하면
5.2 의 파일을 그대로 씁니다. 굳이 나눈다면:

| # | 곡 · 작가 | 출처 | 라이선스 | 표기 | 파일 · 용량 |
|---|---|---|---|---|---|
| C1 | **lofi hip hop** · omfgdude | [OGA](https://opengameart.org/content/lofi-hip-hop) | **CC0** | 불필요 | `lofihiphop.ogg` **1.5 MB** |
| C2 | Thoughtful Music Loops Library · Little Robot Sound Factory | [OGA](https://opengameart.org/content/thoughtful-music-loops-library) | **CC-BY 3.0** | **필수** — "Attribute Little Robot Sound Factory, and provide this link where possible: www.littlerobotsoundfactory.com" | `Thoughtful Music Loops Mp3.zip` **97.5 MB** (묶음) |

C2 는 곡 수가 많아 원하는 한 곡만 꺼내 쓰면 되지만, **CC-BY 라 표기 자리가
필요하고 묶음이 97.5 MB** 입니다. 본관을 굳이 나눠야 한다면 **C1**.

### 5.4 학생회관 (union) — 볼일 보고 나가는 곳, 가볍게

| # | 곡 · 작가 | 출처 | 라이선스 | 표기 | 파일 · 용량 |
|---|---|---|---|---|---|
| D1 | **Feel Good Island Loop** (= A1) | [OGA](https://opengameart.org/content/feel-good-island-loop) | **CC0** | 불필요 | **356.7 KB** |
| D2 | Indie Meditations · YannZ (Yanni Ziangos) 중 `lvl_2_the_village` | [OGA](https://opengameart.org/content/indie-meditations-free-music-pack) | **CC-BY 4.0** | **필수** — "Music by Yanni Ziangos a.k.a. YannZ CC BY 4.0", 메타데이터 유지 | `lvl_2_the_village.ogg` **4.5 MB** (mp3 4.9 MB) |

지금 코드가 학생회관과 광장에 같은 곡(bright)을 쓰므로 **D1 = A1 한 파일**로
끝납니다.

### 5.5 기숙사 (dorm) — 내 방, 저녁

| # | 곡 · 작가 | 출처 | 라이선스 | 표기 | 파일 · 용량 |
|---|---|---|---|---|---|
| E1 | **Chill lofi inspired [loop edit]** · qubodup | [OGA](https://opengameart.org/content/chill-lofi-inspired-loop-edit) | **CC0** | 불필요 (선택: "Chill lofi inspired by omfgdude, made loopable by qubodup") | `chilllofir-loop.ogg` **2.4 MB** |
| E2 | Sunset Plains · Yoiyami | [OGA](https://opengameart.org/content/sunset-plains) | **CC0** — "CC0 — Free to use in any project (no attribution required)" | 불필요 | `sunset_plains.wav` **63.3 MB** → 변환 필수 |
| E3 | Exploration · johnclark | [OGA](https://opengameart.org/content/exploration-0) | **CC0** | 불필요 | `sound.wav` **4.1 MB** → 변환 권장 |

**E1 추천.** 이미 OGG 이고 이음매가 맞습니다.

### 5.6 미니게임관 (arcade) — 3분만 놀고 가는 곳

| # | 곡 · 작가 | 출처 | 라이선스 | 표기 | 파일 · 용량 |
|---|---|---|---|---|---|
| F1 | **NES Shooter Music (5 tracks, 3 jingles)** · SketchyLogic | [OGA](https://opengameart.org/content/nes-shooter-music-5-tracks-3-jingles) | **CC0** — "Attribution is completely optional." | 불필요 | `WAV.zip` **18 MB** (5곡+3징글) / `FTM.zip` 49.2 KB (Famitracker 원본) |
| F2 | **Feel Good Island Loop** (= A1) | [OGA](https://opengameart.org/content/feel-good-island-loop) | **CC0** | 불필요 | **356.7 KB** |

지금 코드는 미니게임관에 학생회관과 같은 곡을 씁니다("여기만 다른 곡을
깔면 3분 있다 나오는 방이 제일 기억에 남습니다"). **그 결정을 지키면 F2 =
A1** 이고 새 파일이 필요 없습니다. F1 은 곡 하나만 골라 OGG 로 뽑으면
1MB 미만이 되지만, 8bit 소리는 이 월드의 픽셀 톤과는 맞아도 **"자세 관리
도구"** 라는 성격과는 어긋납니다.

### 5.7 최소안 — 파일 넷

지금 `ZONE_TRACK` 의 묶음을 그대로 지키면 이렇게 됩니다.

| 곡 자리 | 쓰는 곳 | 후보 | 용량 |
|---|---|---|---:|
| `calm` | 도서관 · 본관 | **B2 Heavenly Loop** (CC0) | 1.2 MB |
| `bright` | 광장 · 학생회관 · 미니게임관 | **A1 Feel Good Island Loop** (CC0) | 356.7 KB |
| `warm` | 기숙사 | **E1 Chill lofi inspired [loop edit]** (CC0) | 2.4 MB |
| `night` | 사람이 직접 고를 때만 | **A2 Birds and Wind – Ambient** (CC0) 또는 B1 변환본 | 1.9 MB |
| | | **합계** | **약 5.9 MB** |

넷 다 **CC0 라 표기 화면이 필요 없습니다.** 표기를 안 만들 거면 이 조합이
유일하게 깔끔합니다.

여섯 자리를 다 다르게 하려면 여기에 C1(1.5 MB)과 F1 에서 뽑은 한 곡이
더해져 대략 8~9 MB 가 됩니다.

---

## 6. 용량 — 아티팩트가 어떻게 되나

`prototypes/openworld/build-artifact.mjs` 는 **모든 것을 파일 안에 박습니다.**
지금 `artifact.html` 은 **5,351,156 바이트 = 5.10 MB** 입니다.

박히면 **base64 라 4/3 배**가 됩니다. 실측 기준으로:

| 안 | 원본 합계 | base64 | 아티팩트 최종 |
|---|---:|---:|---:|
| 지금 (음원 없음) | 0 | 0 | **5.10 MB** |
| §5.7 최소안 (CC0 OGG 넷) | 5.9 MB | 7.9 MB | **약 13.0 MB** |
| 작은 루프만 여섯 (평균 400 KB) | 2.4 MB | 3.2 MB | **약 8.3 MB** |
| 여섯 자리를 mp3 로 (평균 4.5 MB) | 27 MB | 36 MB | **약 41.1 MB** |

**41 MB 짜리 단일 HTML 은 링크로 못 보냅니다.** 열리기 전에 브라우저가
전부 파싱합니다.

### 그리고 지금 build-artifact 는 오디오를 안 박습니다

박는 대상이 `.png` · 서체 · 옆에 붙은 스크립트뿐입니다. `.ogg` 를 넣으면
**아티팩트에서는 소리가 조용히 빠집니다**(아티팩트는 외부 요청을 전부
막습니다). 그래서 파일을 넣기로 하면 코드 두 곳이 같이 바뀝니다.

1. `build-artifact.mjs` 에 오디오 인라인 규칙 추가
2. 첫 화면 "여기서 안 되는 것" 목록 조정

### 대안 — 아티팩트에는 안 넣기

`CHAR_INLINE` · `ITEM_INLINE` 이 하는 것과 반대로, **아티팩트에서는 음악을
빼고 지금의 WebAudio 음악을 그대로 두는** 길이 있습니다. 파일은 원본
프로토타입에서만 울립니다. 아티팩트 용량이 5.10 MB 로 유지되고, 첫 화면에
"이 링크에서는 배경음악이 코드로 만든 소리입니다" 한 줄을 답니다.

**이쪽을 권합니다.** 아티팩트는 "링크 하나로 보는 것" 이 목적이고, 배경음악
때문에 13 MB 가 되면 그 목적이 상합니다.

---

## 7. 앰비언트를 남길 것인가 — **남깁니다**

`index.html` 배경 음악 절의 주석이 이 질문에 이미 답해 두었습니다.

> "앰비언트를 끄지 않습니다. 앰비언트는 '그 공간의 소음'이고 음악은 그 위에
> 얹는 것이라, 둘이 같이 있어야 도서관이 도서관으로 들립니다."

그리고 앰비언트가 왜 있는지는 코인 규칙까지 거슬러 올라갑니다. 장소별
앰비언트 절의 주석:

> "공간마다 백색소음이 다른 것은 '공간이 곧 모드' 라는 이 제품의 뼈대이고,
> 코인에서 공간별 차등(본관3/도서관2)을 뺀 이유가 바로 '공간을 다르게
> 느끼게 하는 일은 소리·NPC·분위기가 맡는다' 였습니다."

즉 **앰비언트는 장식이 아니라 코인 설계의 짝**입니다. 공간 차등 코인을
없앤 자리를 소리가 메우기로 한 것이라, 앰비언트를 지우면 여섯 공간이
"기본곡이 다른 같은 방" 이 됩니다.

### 그러니 실제로 할 일

- `AMBIENCE` — **그대로 둡니다.** 여섯 공간의 필터 값이 곧 공간의 성격입니다.
- `MUSIC` / `pluck()` / `pumpMusic()` — 파일 재생으로 **바꿉니다.**
- `bgmGain` 하나에 둘 다 물려 있으므로 음소거 스위치는 그대로 돕니다.
- 다만 **음량을 다시 맞춰야 합니다.** 지금 곡들은 `gain 0.042~0.060` 으로
  아주 작게 깔려 있고, 앰비언트는 `0.07~0.22` 입니다. 완성된 음원은 보통
  이미 정규화돼 있어서 그대로 얹으면 **음악이 앰비언트를 덮습니다.**
  파일 쪽 gain 을 0.25 안팎에서 시작해 귀로 맞추는 작업이 필요합니다.
- 도서관은 **음악을 아예 안 까는 선택지**도 검토할 만합니다. 화면이 그
  공간을 "백색소음 · 오래 앉는 자리" 라고 적어 두었는데, 거기 곡이 깔리면
  적힌 말과 들리는 소리가 어긋납니다.

---

## 8. 정하고 나서 해야 하는 일

1. 곡을 고르고 **직접 받아서** 실제 바이트를 잽니다 (이 문서 값은 페이지
   표시값이고, 이 샌드박스는 외부 파일을 못 받습니다).
2. wav 후보는 OGG(Vorbis q4 안팎)로 변환합니다. CC0 이라 변환·재배포 자유.
3. 이음매를 확인합니다. "seamless / loop" 라고 적힌 것만 고릅니다 —
   지금 WebAudio 음악은 원리상 끊김이 없어서, 파일로 바꾸면서 4분마다
   딸깍거리면 그건 **없던 문제를 만든 것**입니다.
4. CC-BY 를 하나라도 쓰면 `OPEN_SOURCE_CREDITS.md` 에 절을 더하고 마이페이지에
   "음악 출처" 줄을 만듭니다. 안 만들 거면 CC0 만.
5. `build-artifact.mjs` 를 어떻게 할지 정합니다 (§6 — 안 박는 쪽 권장).
6. 음량을 다시 맞춥니다 (§7).

---

## 9. 이 조사에서 확인하지 못한 것

- **곡별 실제 바이트** — 외부 파일을 받을 수 없어 페이지 표시값을 적었습니다.
- **Incompetech 곡별 길이·용량** — 곡 페이지가 자바스크립트로 그려져서
  문서에 "No Track selected" 만 들어 있었습니다. 브라우저로 직접 확인해야
  합니다.
- **Musopen** — <https://musopen.org/music/> 은 "All the music we host is
  royalty and copyright free. For specific restrictions when applicable,
  check the license icons." 라고만 적혀 있고, 라이선스 아이콘이 문서에
  안 잡혔습니다. 녹음마다 라이선스가 달라 **한 곡씩 확인해야 합니다.**
  퍼블릭 도메인 클래식이 필요하면 여기가 맞지만, 이 조사에서는 확정
  못 했습니다.
- **들어 보지 못했습니다.** 소리는 결국 귀로 골라야 합니다. 위 표는
  "라이선스와 용량이 통과하는 것" 까지입니다.
