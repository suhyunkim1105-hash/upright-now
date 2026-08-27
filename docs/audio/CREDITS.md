# 배경음악 출처 — 실제로 넣은 파일

`prototypes/openworld/assets/audio/` 에 들어 있는 **열 개 파일 전부**의
제목·작가·주소·라이선스·확인 날짜입니다. 조사 문서는
[`MUSIC_CANDIDATES.md`](./MUSIC_CANDIDATES.md) 이고, **여기는 실제로 실린
것만** 적습니다. 이 표에 없는 파일이 `assets/audio/` 에 있으면 그건 사고이고,
`scripts/openworld-music.test.mjs` 가 그 경우 실패합니다.

**확인 날짜: 2026-08-19.** 아래 주소를 한 곳씩 열어 라이선스 표시를 눈으로
읽었습니다. CC0 는 표기 의무가 없지만 적습니다 — 표기가 의무라서가 아니라,
"이건 어디서 났어요" 라는 질문에 한 줄로 답할 수 있어야 하기 때문입니다.

---

## 1. 라이선스 — 열 개 전부 CC0 1.0

전부 **freesound.org** 의 CC0 1.0(퍼블릭 도메인 기증)입니다. 곡 페이지에
"Creative Commons 0" 이라고 적힌 것만 골랐습니다.

> "The person who associated a work with this deed has **dedicated** the work
> to the public domain by waiving all of his or her rights to the work
> worldwide under copyright law"
> — <https://creativecommons.org/publicdomain/zero/1.0/>

표기 불필요 · 상업적 사용 자유 · 수정 자유 · 재배포 자유입니다. 아래 파일은
전부 원본을 **잘라서 모노 Ogg 로 다시 인코딩한 2차 저작물**인데, CC0 라
그 작업과 재배포에 아무 제약이 없습니다.

### 파일을 어디서 받았는지 — 여기가 중요합니다

이 작업이 돌아간 샌드박스는 freesound.org 로 **파일을 직접 못 받습니다**
(egress 정책이 github.com 과 패키지 저장소 말고는 전부 막습니다). 그래서
바이트는 CC0 음원을 모아 둔 깃허브 거울에서 받았습니다:

- <https://github.com/SoundSafari/CC0-1.0-Music> (`freesound.org/` 폴더)
- 파일 이름에 **freesound 의 sound id 가 그대로 박혀 있습니다**
  (`691725__lightmister__ambient-music.ogg`). 그 id 로 원본 페이지를 열어
  라이선스를 한 곡씩 확인했습니다.

**거울을 믿지 않았습니다.** 거울의 README 는 스스로를 "CC0-1.0 licensed
music" 이라고 부르지만, 같은 저장소가 **Pixabay 폴더**(CC0 아님)와
**FreePD 폴더**를 나란히 담고 있고, 실제로 CC0 라고 모아 둔 freesound 폴더
안에서 **CC-BY 인 곡이 나왔습니다**(아래 §3). 그래서 실린 열 곡은 전부
freesound.org 원본 페이지에서 다시 확인한 것들입니다.

---

## 2. 실린 파일 열 개

용량·길이는 **직접 잰 값**입니다(`ffprobe` · `stat`).

| 파일 | 곡 · 작가 | 원본 | 라이선스 | 확인일 | 길이 · 용량 |
|---|---|---|---|---|---|
| `calm.ogg` | **Ambient Music** · LightMister | [freesound 691725](https://freesound.org/s/691725/) | **CC0 1.0** | 2026-08-19 | 87.96s · 466,304 B |
| `bright.ogg` | **Good Morning Heaven (no drums)** · SondreDrakensson | [freesound 529601](https://freesound.org/s/529601/) | **CC0 1.0** | 2026-08-19 | 66.80s · 419,661 B |
| `warm.ogg` | **Hakren – Jazzy Ambient Piano Mansion [414557] – [Erokia Remix 2] – Ambient Piano Loop 64** · Erokia | [freesound 415913](https://freesound.org/s/415913/) | **CC0 1.0** | 2026-08-19 | 54.85s · 270,342 B |
| `night.ogg` | **Late Jazz Piano Pure** · szegvari | [freesound 570349](https://freesound.org/s/570349/) | **CC0 1.0** | 2026-08-19 | 39.75s · 222,936 B |
| `errand.ogg` | **background loop** · Leszek_Szary | [freesound 368730](https://freesound.org/s/368730/) | **CC0 1.0** | 2026-08-19 | 15.98s · 82,922 B |
| `play.ogg` | **Sequence – 8 bit music loop** · michorvath | [freesound 412343](https://freesound.org/s/412343/) | **CC0 1.0** | 2026-08-19 | 50.85s · 334,945 B |
| `shop.ogg` | **Swan Lake, Tiny Keychain Music Box (Loopable)** · Rolly-SFX | [freesound 485516](https://freesound.org/s/485516/) | **CC0 1.0** | 2026-08-19 | 11.00s · 87,098 B |
| `noon.ogg` | **BirdFish Happy Loop** · pinkinblue | [freesound 425971](https://freesound.org/s/425971/) | **CC0 1.0** | 2026-08-19 | 12.00s · 58,882 B |
| `study.ogg` | **Jazzy Ambient Piano (Mansion)** · Hakren | [freesound 414557](https://freesound.org/s/414557/) | **CC0 1.0** | 2026-08-19 | 33.51s · 170,703 B |
| `water.ogg` | **Overlook (uplifting ambient loop)** · SondreDrakensson | [freesound 506495](https://freesound.org/s/506495/) | **CC0 1.0** | 2026-08-19 | 60.00s · 430,606 B |
| | | | | **합계** | **432.70s · 2,544,399 B (2.43 MiB)** |

`warm.ogg` 는 **리믹스**입니다. 원곡은 같은 표의 `study.ogg`
(Hakren, freesound 414557, CC0)이고, Erokia 가 그것을 다시 만든 것이
415913(CC0)입니다. **원곡과 리믹스 둘 다 CC0** 이라 사슬이 끊긴 곳이
없습니다 — 원곡이 CC-BY 였다면 리믹스가 CC0 이라고 적혀 있어도 못 씁니다.

### 어디서 나오나

| 곡 | 나오는 곳 |
|---|---|
| `calm` 조용한 오후 | 도서관 · **본관** |
| `warm` 저녁 방 | 기숙사 |
| `bright` 볕 드는 마당 | 캠퍼스(중앙 광장 · 운동장 · 호수) |
| `errand` 볼일 보는 길 | 학생회관 |
| `play` 삼 분만 | 미니게임관 |
| `shop` 좌판 앞 | 동아리 상점 |
| `night` · `noon` · `study` · `water` | 어느 장소의 기본도 아님 — 설정에서 직접 고를 때만 |

도서관과 본관이 **같은 곡**인 것은 곡이 모자라서가 아닙니다. 둘 다
"오래 앉는 자리" 라 음악까지 다르면 공간이 아니라 곡이 기억에 남습니다
(원래 있던 결정이고 그대로 지켰습니다). 운동장·호수는 존이 아니라 캠퍼스
안의 좌표라 캠퍼스 곡을 같이 씁니다.

---

## 3. 확인하고 **뺀** 것 — 왜 안 썼는지

| 뺀 것 | 이유 |
|---|---|
| **freesound 611050** "Electric Dream Ambient" · TheoJT | 곡은 맞는데 원본 페이지가 **Attribution 4.0** 입니다. CC0 만 모아 뒀다는 거울 안에 섞여 있던 곡이라, 목록을 믿으면 안 된다는 증거로 여기 남깁니다. <https://freesound.org/s/611050/> (2026-08-19 확인) |
| **freesound 652432** "calm and sad ambient" · Sami_Hiltunen | 페이지가 **404** 입니다. 파일은 거울에 남아 있지만 라이선스를 확인할 곳이 사라졌습니다. **확인 못 한 것은 안 싣습니다.** |
| **Pixabay Music** | CC0 가 아니라 자체 Pixabay Content License 입니다. "You cannot sell or distribute Content … on a Standalone basis" 조항이 있어 CC0·CC-BY·PD 어느 쪽도 아닙니다. |
| **FreePD** | 2025년에 영구 폐쇄됐습니다("[freepd.com] is now permanently closed"). 새로 받을 곳도, 라이선스를 다시 확인할 곳도 없습니다. |
| **Incompetech** (Kevin MacLeod) | CC BY 4.0. 표기가 **의무**라 저작물이 울리는 화면에 표기 자리를 만들어야 합니다. 그 자리를 안 만들기로 했으므로 씁니다/안 씁니다가 아니라 못 씁니다. |
| **Indie Meditations** · YannZ | CC BY 4.0. 위와 같습니다. |
| **OpenGameArt 후보들** (Heavenly Loop · Feel Good Island Loop 등) | 라이선스는 CC0 로 확인되지만 이 샌드박스에서 **opengameart.org 로 나가는 길이 막혀 있어** 파일을 받지 못했습니다. 다음에 열 수 있는 곳에서 작업하면 1순위 후보입니다(MUSIC_CANDIDATES.md §5). |
| **YouTube · Spotify 음원** | 라이선스가 없습니다. 스포티파이는 **링크를 새 탭으로 여는 것**까지만 합니다(설정 화면에 그대로 적혀 있습니다). |

---

## 4. 어떻게 만들었나 — 원본에서 실린 파일까지

원본은 wav · flac · mp3 · ogg 가 섞여 있고 길이도 12초에서 470초까지입니다.
그대로 실으면 62MB 이고 곡마다 음량이 13dB 씩 다릅니다. 아래 세 단계를
거쳤습니다. 전부 `ffmpeg` 6.1.1 입니다.

### (1) 되풀이 지점 찾기

곡마다 로그 스펙트로그램을 뜬 뒤, 시작점에서 2초짜리 창을 떼어 뒤쪽으로
밀면서 상관계수가 가장 높은 지점을 찾았습니다. 그 지점이 "여기서 돌아가면
같은 자리로 돌아온다" 는 곳입니다. 실측값:

| 곡 | 찾은 되풀이 길이 | 상관 |
|---|---:|---:|
| `play` (8비트) | 50.85s | 0.997 |
| `noon` (마림바) | 12.00s | 0.979 |
| `calm` (앰비언트) | 87.96s | 0.966 |
| `bright` | 66.80s | 0.950 |
| `water` | 60.00s | 0.947 |
| `errand` | 15.98s (8.0s 두 바퀴) | 0.919 |
| `warm` | 54.85s (27.43s 두 바퀴) | 0.902 |
| `study` | 33.51s | 0.922 |
| `night` (재즈 피아노) | 39.75s | 0.876 |
| `shop` (뮤직박스) | 11.00s | 0.661 |

`warm` 의 27.43초는 **140BPM 에서 정확히 64박**입니다 — 원본 제목의
"Ambient Piano Loop 64 (140 BPM)" 와 숫자가 맞습니다. 우연이 아니라
되풀이 지점을 제대로 찾았다는 뜻이라 그대로 썼고, 한 바퀴가 30초를 안 넘어
두 바퀴로 잘랐습니다.

`shop` 의 0.661 은 낮습니다. 뮤직박스는 태엽 소리가 매번 달라서 상관이
안 올라갑니다. 대신 원본 제목이 "(Loopable)" 이고 11.0초 뒤부터는 소리가
-45dB 아래로 사그라들어 그 지점을 썼습니다.

### (2) 이음매 접기

되풀이 지점 뒤의 꼬리 X초를 잘라 머리 X초 **위에 겹쳐** 페이드로 섞었습니다
(X = 0.4~2.0초). 이러면 파일 끝과 파일 처음이 이미 같은 소리라 `loop = true`
만으로 끊김이 없습니다.

`acrossfade` 를 안 쓴 이유: ffmpeg 6.1 에서 `d` 가 두 입력 길이와 같으면
**빈 결과**를 내놓습니다(실측). `afade` 두 장과 `amix` 로 직접 짰습니다.
`asplit` 도 안 씁니다 — 한 갈래가 파일 뒤쪽까지 앞질러 읽으면 `amix` 가
먼저 EOF 를 보고 역시 빈 결과가 됩니다. 원본을 두 번 여는 것이 답이었습니다.

### (3) 모노 · 음량 · 인코딩

- **모노** — 이 음악은 앰비언트 아래에 깔리는 소리라 좌우 폭이 들릴 자리가
  아니고, 모노면 같은 품질에서 용량이 절반입니다.
- **음량** — 원본은 -17.1 ~ -30.5 LUFS 로 **13.4dB** 이 벌어져 있었습니다.
  전부 **-20.0 LUFS** 로 맞췄고, 봉우리는 -2dBFS 리미터로만 눌렀습니다
  (통째로 줄이면 뮤직박스처럼 튀는 음이 있는 곡만 3dB 작게 들립니다).
  결과: **-20.0 ~ -20.4 LUFS · 피크 -1.5 ~ -8.7 dBFS**.
- **인코딩** — `libvorbis -q:a 1`, 모노, 44.1kHz. 평균 **47.0kbps**,
  열 곡 합쳐 **2,544,399 바이트**. 예산(12MB)의 21% 입니다.

재현 방법은 이 문서 §2 의 원본 id 와 §4 의 숫자만 있으면 됩니다 —
원본을 받아 같은 시작점·길이·페이드로 자르면 같은 파일이 나옵니다.

---

## 5. 아티팩트에서는 조용합니다

`prototypes/openworld/build-artifact.mjs` 는 png·서체·옆 스크립트만 파일
안에 박고 **오디오는 안 박습니다.** 아티팩트는 바깥 요청을 전부 막으므로
거기서는 음악이 빠지고, 앰비언트(코드로 만드는 분홍잡음)만 울립니다.

일부러 그대로 뒀습니다. 넣으면 base64 라 4/3 배가 붙어 5.1MB 짜리 단일
HTML 이 8MB 를 넘습니다. 아티팩트의 존재 이유가 "링크 하나로 열리는 것"
이라 그 값을 배경음악에 쓰지 않습니다. 대신 못 읽은 이유를 `MUSIC_WHY` 에
담아 설정 화면이 그대로 말합니다.
