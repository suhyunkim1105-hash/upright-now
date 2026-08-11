/**
 * 닉네임 차단어 목록 — `nicknameFilter.ts` 가 씁니다.
 *
 * 여기 적는 값은 **정규화된 형태**입니다. 정규화는 필터가 합니다.
 * (공백·기호 제거 → 소문자 → 숫자 치환 → 한글 자모 결합)
 * 그래서 `ㅅ ㅣ 발`, `시1발`, `ㅅㅣㅂㅏㄹ` 을 따로 적을 필요가 없습니다.
 *
 * ## 목록을 고칠 때
 *
 * 1. 짧은 단어일수록 정상 닉네임을 잡아먹습니다. 넣기 전에 그 글자가
 *    들어가는 평범한 말이 있는지 생각해 보세요.
 * 2. 부분 일치로 막으면 위험한 말은 `_EXACT` / `_WORD_ONLY` 목록에 넣습니다.
 *    예) `보지` 를 부분 일치로 막으면 `해보지`·`가보지` 가 전부 막힙니다.
 * 3. 고친 뒤에는 반드시 `nicknameFilter.spec.ts` 의 **오탐 목록**을 돌리세요.
 */

/* ------------------------------ 한국어 비속어 ----------------------------- */

/** 부분 일치로 막아도 안전한 한국어 비속어. */
export const KO_PROFANITY: readonly string[] = [
  // 욕설
  '시발',
  '씨발',
  '싀발',
  '시팔',
  '씨팔',
  '씨바',
  '개시발',
  '개씨발',
  '좆',
  '존나',
  '졸라',
  '지랄',
  '병신',
  '븅신',
  '빙신',
  '등신',
  '새끼',
  '개놈',
  '개년',
  '썅',
  '쌍놈',
  '쌍년',
  '미친놈',
  '미친년',
  '또라이',
  '돌아이',
  '꺼져',
  '닥쳐',
  '엿먹어',
  '뒤져라',
  '자살해',
  '씹새',
  '씹창',
  '엄창',
  '느금마',
  '니애미',
  '니애비',
  '패드립',
  // 성적 표현
  '섹스',
  '떡치',
  '야동',
  '음란',
  '강간',
  '변태새',
  // 혐오·차별
  '한남충',
  '김치녀',
  '된장녀',
  '맘충',
  '급식충',
  '틀딱',
  '흑형',
  '장애인새',
  '빨갱이',
  '토착왜구',
]

/**
 * **닉네임 전체가 이 말과 같을 때만** 막습니다.
 *
 * 부분 일치로 막으면 정상 닉네임이 무더기로 걸립니다.
 * `보지` → `해보지`·`가보지`·`먹어보지`
 * `자지` → `자지마`·`잠자지`
 */
export const KO_PROFANITY_EXACT: readonly string[] = ['보지', '자지']

/**
 * 자모(초성)만으로 쓴 비속어.
 *
 * 자모는 결합되지 않고 그대로 남으므로 정규화된 문자열에서 바로 찾습니다.
 * **완성된 글자에서 초성을 뽑아내지는 않습니다.** 뽑아내면 `사방` → `ㅅㅂ` 처럼
 * 멀쩡한 말이 전부 걸립니다.
 */
export const KO_JAMO_PROFANITY: readonly string[] = [
  'ㅅㅂ',
  'ㅆㅂ',
  'ㅄ',
  'ㅂㅅ',
  'ㅈㄹ',
  'ㄲㅈ',
  'ㅈㄴ',
  'ㄷㅊ',
  'ㅗ',
]

/* ------------------------------- 영어 욕설 ------------------------------- */

/** 부분 일치로 막아도 안전한 영어 욕설. */
export const EN_PROFANITY: readonly string[] = [
  'fuck',
  'fuk',
  'phuck',
  'shit',
  'bitch',
  'bastard',
  'asshole',
  'dickhead',
  'motherfucker',
  'cunt',
  'pussy',
  'whore',
  'slut',
  'nigger',
  'nigga',
  'retard',
  'faggot',
  'jerkoff',
  'blowjob',
  'handjob',
  'porn',
  'nazi',
  'hitler',
]

/**
 * **한 낱말로 떨어질 때만** 막는 영어 욕설.
 * `ass` 를 부분 일치로 막으면 `classic`·`pass`·`bass` 가 막힙니다.
 * `rape` 는 `grape`·`scrape` 에 들어 있습니다.
 */
export const EN_PROFANITY_WORD_ONLY: readonly string[] = [
  'ass',
  'cum',
  'fag',
  'dick',
  'cock',
  'tits',
  'rape',
  'damn',
  'crap',
]

/* ---------------------------- 운영자 사칭 방지 ---------------------------- */

/**
 * 서비스 운영 주체를 사칭하는 표현.
 *
 * **학교명 사칭은 막지 않습니다.** 닉네임에 학교 이름을 쓰는 것은 정상입니다.
 * `개발자` 도 막지 않습니다 — 컴퓨터 전공 학생의 평범한 닉네임입니다.
 */
export const IMPERSONATION: readonly string[] = [
  '관리자',
  '운영자',
  '운영팀',
  '운영진',
  '고객센터',
  '고객지원',
  '공식계정',
  '공지사항',
  '어드민',
  '지엠',
  'admin',
  'administrator',
  'moderator',
  'sysop',
  'helpdesk',
  'system',
  'uprightnow',
  'uprightteam',
]

/**
 * **한 낱말로 떨어질 때만** 막는 사칭어.
 * `gm` → `gmail`, `support` → `supporter`, `official` → `unofficial`
 */
export const IMPERSONATION_WORD_ONLY: readonly string[] = [
  'gm',
  'gms',
  'op',
  'mod',
  'staff',
  'support',
  'official',
]

/**
 * 사칭으로 오해할 수 있지만 **허용**하는 말.
 * 사칭 검사 전에 정규화된 문자열에서 지워 오탐을 막습니다.
 */
export const IMPERSONATION_ALLOWLIST: readonly string[] = [
  '자기관리',
  '시간관리',
  '체력관리',
  '자세관리',
  '건강관리',
  '학점관리',
  '운영체제',
]
