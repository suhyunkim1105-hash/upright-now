import { describe, expect, it } from 'vitest'
import {
  checkNickname,
  composeJamo,
  NICKNAME_MAX_LENGTH,
  NICKNAME_REJECT_MESSAGE,
} from './nicknameFilter'
import {
  EN_PROFANITY,
  EN_PROFANITY_WORD_ONLY,
  IMPERSONATION,
  IMPERSONATION_WORD_ONLY,
  KO_JAMO_PROFANITY,
  KO_PROFANITY,
  KO_PROFANITY_EXACT,
} from './nicknameBlocklist'

const pass = (value: string) => checkNickname(value).ok
const reasonOf = (value: string) => checkNickname(value).reason

describe('composeJamo', () => {
  it('흩어진 자모를 음절로 되돌린다', () => {
    expect(composeJamo('ㅅㅣㅂㅏㄹ')).toBe('시발')
    expect(composeJamo('ㅎㅏㄴㄱㅡㄹ')).toBe('한글')
  })

  it('뒤에 모음이 오면 받침으로 붙이지 않는다', () => {
    expect(composeJamo('ㅁㅏㄴㅏ')).toBe('마나')
    expect(composeJamo('ㅁㅏㄴ')).toBe('만')
  })

  it('음절과 자모가 섞여도 처리한다', () => {
    expect(composeJamo('시ㅂㅏㄹ')).toBe('시발')
    expect(composeJamo('공부ㅎㅏㅈㅏ')).toBe('공부하자')
  })

  it('결합할 수 없는 자모는 그대로 둔다', () => {
    expect(composeJamo('ㅅㅂ')).toBe('ㅅㅂ')
    expect(composeJamo('ㅋㅋㅋ')).toBe('ㅋㅋㅋ')
    expect(composeJamo('ㅠㅠ')).toBe('ㅠㅠ')
  })

  it('한글이 아닌 문자는 건드리지 않는다', () => {
    expect(composeJamo('abc123')).toBe('abc123')
  })
})

describe('checkNickname — 길이와 빈 값', () => {
  it('빈 값과 공백뿐인 값을 막는다', () => {
    expect(reasonOf('')).toBe('empty')
    expect(reasonOf('   ')).toBe('empty')
    expect(reasonOf('\t\n')).toBe('empty')
  })

  it(`${NICKNAME_MAX_LENGTH}자까지 허용하고 넘으면 막는다`, () => {
    expect(pass('가나다라마바사아자차카타')).toBe(true) // 12자
    expect(reasonOf('가나다라마바사아자차카타파')).toBe('too_long') // 13자
  })

  it('이모지를 두 자로 세지 않는다', () => {
    // '🦒'.length 는 2 지만 사람이 보기엔 한 글자입니다.
    expect(pass('🦒🦒🦒🦒🦒🦒🦒')).toBe(true)
  })

  it('앞뒤 공백은 길이에서 빼고 센다', () => {
    expect(pass('  가나다라마바사아자차카타  ')).toBe(true)
  })
})

describe('checkNickname — 정상 닉네임은 통과한다 (오탐 방지)', () => {
  const SHOULD_PASS = [
    // 기본값·평범한 닉네임
    '익명의 기린',
    '기린',
    '공부하는곰',
    '자세왕',
    '집중력만렙',
    '오늘도화이팅',
    '커피한잔',
    '밤샘러',
    '도서관지박령',

    // 학교명 사칭은 허용한다 — 닉네임에 학교 이름을 쓰는 건 정상
    '서울대 김수현',
    '연세대19학번',
    '고려대화이팅',
    '서강대새내기',
    '성균관대생',
    '한양공대',
    '중앙대인',
    '경희대러버',
    '외대통번',
    '서울시립대',

    // 차단어가 부분 문자열로 들어 있지만 정상인 한국어
    '해보지마',
    '잠자지말자',
    '가보지못한길',
    '먹어보지뭐',
    '개발자지망생',
    '사방팔방',
    '서비스기획',
    '스터디메이트',
    '분석왕',
    '반색하는하루',

    // 관리·운영이 들어가지만 사칭이 아닌 말
    '자기관리왕',
    '시간관리중',
    '체력관리해',
    '자세관리중',
    '학점관리실패',
    '운영체제덕후',
    '개발자',
    '개발자지망',

    // 영어 — 욕설이 부분 문자열로 들어 있지만 정상
    'classic',
    'passion',
    'bassist',
    'grape',
    'therapist',
    'document',
    'village',
    'Dickens',
    'analysis',
    'cocktail',
    'supporter',
    'unofficial',
    'gmail러버',
    'modern',
    'opera',
    'assemble',

    // 자모·반복 문자
    'ㅋㅋㅋ',
    'ㅎㅇㅎㅇ',
    'ㅠㅠ루피',
    'ㅇㅈ',
    'ㄱㄱ',

    // 숫자·기호가 섞인 정상 닉네임
    '2026합격',
    '3분만더',
    'A+받자',
    '1등하자',
    '기린_99',

    // 이모지·비한글
    '🦒기린',
    'にほんご',
    'Étudiant',
  ]

  it.each(SHOULD_PASS)('통과: %s', (value) => {
    const result = checkNickname(value)
    expect(
      result.ok,
      `"${value}" 가 ${result.reason} (matched: ${result.matched}) 로 잘못 막혔습니다`,
    ).toBe(true)
  })
})

describe('checkNickname — 한국어 비속어를 막는다', () => {
  it('기본형을 막는다', () => {
    expect(reasonOf('시발')).toBe('profanity')
    expect(reasonOf('씨발놈')).toBe('profanity')
    expect(reasonOf('개새끼')).toBe('profanity')
    expect(reasonOf('병신')).toBe('profanity')
    expect(reasonOf('지랄')).toBe('profanity')
  })

  it('공백·기호를 끼워 넣어도 막는다', () => {
    expect(reasonOf('시 발')).toBe('profanity')
    expect(reasonOf('시.발')).toBe('profanity')
    expect(reasonOf('시*발')).toBe('profanity')
    expect(reasonOf('시   발')).toBe('profanity')
    expect(reasonOf('병 신')).toBe('profanity')
  })

  it('숫자를 끼워 넣어도 막는다', () => {
    expect(reasonOf('시1발')).toBe('profanity')
    expect(reasonOf('시123발')).toBe('profanity')
    expect(reasonOf('병0신')).toBe('profanity')
  })

  it('자음·모음을 분리해도 막는다', () => {
    expect(reasonOf('ㅅㅣㅂㅏㄹ')).toBe('profanity')
    expect(reasonOf('시ㅂㅏㄹ')).toBe('profanity')
    expect(reasonOf('ㅂㅕㅇㅅㅣㄴ')).toBe('profanity')
  })

  it('초성만 써도 막는다', () => {
    expect(reasonOf('ㅅㅂ')).toBe('profanity')
    expect(reasonOf('ㅆㅂ')).toBe('profanity')
    expect(reasonOf('ㅄ')).toBe('profanity')
    expect(reasonOf('ㅈㄹ')).toBe('profanity')
    expect(reasonOf('커피ㅅㅂ')).toBe('profanity')
  })

  it('혐오·차별 표현을 막는다', () => {
    expect(reasonOf('한남충')).toBe('profanity')
    expect(reasonOf('김치녀')).toBe('profanity')
    expect(reasonOf('틀딱충')).toBe('profanity')
    expect(reasonOf('빨갱이')).toBe('profanity')
  })

  it('전체가 같을 때만 막는 말은 정확히 같을 때 막는다', () => {
    expect(reasonOf('보지')).toBe('profanity')
    expect(reasonOf('자지')).toBe('profanity')
    // 부분 문자열로는 막지 않는다 (오탐 방지)
    expect(pass('해보지')).toBe(true)
    expect(pass('잠자지마')).toBe(true)
  })
})

describe('checkNickname — 영어 욕설을 막는다', () => {
  it('기본형과 대소문자를 막는다', () => {
    expect(reasonOf('fuck')).toBe('profanity')
    expect(reasonOf('FUCK')).toBe('profanity')
    expect(reasonOf('FuCkYou')).toBe('profanity')
    expect(reasonOf('bitch')).toBe('profanity')
    expect(reasonOf('asshole')).toBe('profanity')
  })

  it('기호·공백을 끼워 넣어도 막는다', () => {
    expect(reasonOf('f*u*c*k')).toBe('profanity')
    expect(reasonOf('f u c k')).toBe('profanity')
    expect(reasonOf('s.h.i.t')).toBe('profanity')
  })

  it('leet 치환을 막는다', () => {
    expect(reasonOf('sh1t')).toBe('profanity')
    expect(reasonOf('b4stard')).toBe('profanity')
    expect(reasonOf('fu(k')).toBe('profanity')
    expect(reasonOf('p0rn')).toBe('profanity')
  })

  it('전각 문자를 막는다', () => {
    expect(reasonOf('ｆｕｃｋ')).toBe('profanity')
  })

  it('낱말로 떨어질 때만 막는 말을 구분한다', () => {
    expect(reasonOf('ass')).toBe('profanity')
    expect(reasonOf('big ass')).toBe('profanity')
    expect(reasonOf('rape')).toBe('profanity')
    // 부분 문자열로는 막지 않는다
    expect(pass('classic')).toBe(true)
    expect(pass('grape')).toBe(true)
  })
})

describe('checkNickname — 운영자 사칭을 막는다', () => {
  it('한국어 사칭을 막는다', () => {
    expect(reasonOf('관리자')).toBe('impersonation')
    expect(reasonOf('운영자')).toBe('impersonation')
    expect(reasonOf('운영팀입니다')).toBe('impersonation')
    expect(reasonOf('고객센터')).toBe('impersonation')
    expect(reasonOf('공지사항')).toBe('impersonation')
    expect(reasonOf('어드민')).toBe('impersonation')
  })

  it('영어 사칭을 막는다', () => {
    expect(reasonOf('admin')).toBe('impersonation')
    expect(reasonOf('ADMIN')).toBe('impersonation')
    expect(reasonOf('admin kim')).toBe('impersonation')
    expect(reasonOf('sysop')).toBe('impersonation')
    expect(reasonOf('helpdesk')).toBe('impersonation')
    expect(reasonOf('moderator')).toBe('impersonation')
    expect(reasonOf('system')).toBe('impersonation')
    expect(reasonOf('uprightnow')).toBe('impersonation')
  })

  it('낱말로 떨어질 때만 막는 사칭어를 구분한다', () => {
    expect(reasonOf('GM')).toBe('impersonation')
    expect(reasonOf('gm kim')).toBe('impersonation')
    expect(reasonOf('mod')).toBe('impersonation')
    expect(reasonOf('staff')).toBe('impersonation')
    // 부분 문자열로는 막지 않는다
    expect(pass('gmail러버')).toBe(true)
    expect(pass('supporter')).toBe(true)
    expect(pass('modern')).toBe(true)
  })

  it('사칭 변형(공백·숫자)도 막는다', () => {
    expect(reasonOf('관 리 자')).toBe('impersonation')
    expect(reasonOf('운영1자')).toBe('impersonation')
    expect(reasonOf('a d m i n')).toBe('impersonation')
  })

  it('학교명은 사칭으로 보지 않는다', () => {
    expect(pass('서울대운영')).toBe(true)
    expect(pass('고려대공식응원단')).toBe(true)
    expect(pass('연세대총학생회')).toBe(true)
    // 학교 이름 + 운영자 사칭이 겹치면 사칭 쪽이 이긴다
    expect(reasonOf('서울대운영자')).toBe('impersonation')
  })

  it('12자를 넘는 사칭어는 길이로 먼저 막힌다', () => {
    expect(reasonOf('administrator')).toBe('too_long')
  })
})

describe('checkNickname — 결과 형태', () => {
  it('통과하면 이유가 없다', () => {
    expect(checkNickname('기린')).toEqual({ ok: true })
  })

  it('막히면 화면에 쓸 문구를 준다', () => {
    const result = checkNickname('시발')
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('profanity')
    expect(result.message).toBe(NICKNAME_REJECT_MESSAGE.profanity)
  })

  it('사칭과 비속어의 안내 문구가 다르다', () => {
    expect(checkNickname('관리자').message).not.toBe(checkNickname('시발').message)
  })

  it('걸린 규칙을 matched 로 알려 준다 (QA용)', () => {
    expect(checkNickname('시발').matched).toBe('시발')
    expect(checkNickname('admin').matched).toBe('admin')
  })
})

describe('차단어 목록 자체의 위생', () => {
  const ALL = [
    ...KO_PROFANITY,
    ...KO_PROFANITY_EXACT,
    ...KO_JAMO_PROFANITY,
    ...EN_PROFANITY,
    ...EN_PROFANITY_WORD_ONLY,
    ...IMPERSONATION,
    ...IMPERSONATION_WORD_ONLY,
  ]

  it('중복이 없다', () => {
    expect(new Set(ALL).size).toBe(ALL.length)
  })

  it('공백이나 대문자가 섞이지 않았다 (정규화된 형태여야 한다)', () => {
    for (const word of ALL) {
      expect(word, `"${word}" 에 공백이 있습니다`).not.toMatch(/\s/)
      expect(word, `"${word}" 에 대문자가 있습니다`).toBe(word.toLowerCase())
    }
  })

  it('부분 일치 목록의 모든 단어가 실제로 막힌다', () => {
    for (const word of [...KO_PROFANITY, ...EN_PROFANITY, ...IMPERSONATION]) {
      expect(checkNickname(word).ok, `"${word}" 가 막히지 않습니다`).toBe(false)
    }
  })
})

describe('의도적으로 이렇게 동작한다 (경계 사례 기록)', () => {
  it('완성된 글자에서 초성을 뽑아 대조하지 않는다', () => {
    // '사방'·'서비스'의 초성은 ㅅㅂ 이지만 막지 않습니다.
    // 뽑아내면 정상 닉네임이 대량으로 걸립니다.
    expect(pass('사방팔방')).toBe(true)
    expect(pass('서비스')).toBe(true)
  })

  it("'새끼'가 들어가면 동물 이름이어도 막는다", () => {
    // 흔한 욕설이라 부분 일치로 막습니다. 오탐을 감수한 선택입니다.
    expect(reasonOf('새끼고양이')).toBe('profanity')
  })

  it('조사가 붙은 전체 일치 차단어는 통과한다 (알려진 한계)', () => {
    // KO_PROFANITY_EXACT 는 전체가 같을 때만 막습니다.
    // 신고가 쌓이면 조사 목록을 붙여 확장하세요.
    expect(pass('보지야')).toBe(true)
  })
})
