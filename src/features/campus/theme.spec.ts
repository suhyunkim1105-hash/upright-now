import { describe, expect, it } from 'vitest'
import { CAMPUS_SCHOOLS, CUSTOM_SCHOOL_ID } from '@/constants/campus'
import {
  contrastRatio,
  isCustomSchool,
  mixHex,
  normalizeHexColor,
  readableTextColor,
  resolveCampusTheme,
} from './theme'
import { seasonAt, seasonIndexAt, seasonRemainingMs, formatRemaining } from './season'

describe('학교 목록', () => {
  it('서울 소재 1차 확장 학교 24곳 + 기타 = 25개', () => {
    expect(CAMPUS_SCHOOLS).toHaveLength(25)
    expect(CAMPUS_SCHOOLS[CAMPUS_SCHOOLS.length - 1].id).toBe(CUSTOM_SCHOOL_ID)
  })

  it('요청한 1차 학교 이름이 모두 들어 있다', () => {
    const names = CAMPUS_SCHOOLS.map((s) => s.name)
    for (const name of [
      '서울대학교',
      '연세대학교',
      '고려대학교',
      '서강대학교',
      '성균관대학교',
      '한양대학교',
      '중앙대학교',
      '경희대학교',
      '한국외국어대학교',
      '서울시립대학교',
      '건국대학교',
      '동국대학교',
      '홍익대학교',
      '이화여자대학교',
      '숙명여자대학교',
      '국민대학교',
      '숭실대학교',
      '광운대학교',
      '세종대학교',
      '서울과학기술대학교',
      '성신여자대학교',
      '서울여자대학교',
      '동덕여자대학교',
      '상명대학교',
      '기타 / 직접 설정',
    ]) {
      expect(names).toContain(name)
    }
  })

  it('기타를 뺀 학교 색은 모두 프로토타입 프리셋으로 표시된다', () => {
    for (const school of CAMPUS_SCHOOLS) {
      if (school.custom) {
        expect(school.colorSource).toBe('user-defined')
      } else {
        // 공식 색상이라고 주장하지 않습니다.
        expect(school.colorSource).toBe('prototype-preset')
      }
    }
  })

  it('기타를 뺀 학교는 학교 인증용 대표 도메인을 가진다', () => {
    for (const school of CAMPUS_SCHOOLS) {
      if (!school.custom) {
        expect(school.emailDomain).toMatch(/^[a-z0-9.-]+\.[a-z]{2,}$/)
      }
    }
  })
})

describe('색 유틸', () => {
  it('3자리·6자리 HEX 를 정규화한다', () => {
    expect(normalizeHexColor('#abc')).toBe('#AABBCC')
    expect(normalizeHexColor('2b4c7e')).toBe('#2B4C7E')
    expect(normalizeHexColor('nope')).toBeNull()
    expect(normalizeHexColor('#12345')).toBeNull()
  })

  it('두 색을 비율로 섞는다', () => {
    expect(mixHex('#000000', '#FFFFFF', 0)).toBe('#FFFFFF')
    expect(mixHex('#000000', '#FFFFFF', 1)).toBe('#000000')
    expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080')
  })

  it('배지 글자색은 대비가 높은 쪽을 고른다', () => {
    expect(readableTextColor('#2B4C7E')).toBe('#FFFFFF')
    expect(readableTextColor('#FFF6C0')).toBe('#171717')
  })

  it('모든 학교 배지의 글자 대비가 4.5:1 이상이다', () => {
    for (const school of CAMPUS_SCHOOLS) {
      const theme = resolveCampusTheme(school.id, school.primary)
      expect(theme).not.toBeNull()
      expect(contrastRatio(theme!.primary, theme!.onPrimary)).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('테마 해석', () => {
  it('학교를 고르지 않으면 null', () => {
    expect(resolveCampusTheme(null)).toBeNull()
    expect(resolveCampusTheme('unknown-school')).toBeNull()
  })

  it('프리셋 학교는 자기 색을 쓴다', () => {
    const theme = resolveCampusTheme('korea')
    expect(theme?.primary).toBe('#8E2438')
    expect(theme?.colorSource).toBe('prototype-preset')
    expect(theme?.schoolName).toBe('고려대학교')
  })

  it('기타 학교는 사용자가 고른 색을 쓴다', () => {
    const theme = resolveCampusTheme(CUSTOM_SCHOOL_ID, '#7a4fa3')
    expect(theme?.primary).toBe('#7A4FA3')
    expect(theme?.colorSource).toBe('user-defined')
    expect(isCustomSchool(CUSTOM_SCHOOL_ID)).toBe(true)
  })

  it('기타 학교의 색이 잘못되면 기본 색으로 되돌린다', () => {
    const theme = resolveCampusTheme(CUSTOM_SCHOOL_ID, 'not-a-color')
    expect(theme?.primary).toBe('#5F8FF7')
  })
})

describe('시즌', () => {
  it('시즌은 달력 분기마다 올라간다', () => {
    expect(seasonIndexAt(Date.UTC(2026, 0, 1))).toBe(0)
    expect(seasonIndexAt(Date.UTC(2026, 2, 31, 23, 59))).toBe(0)
    expect(seasonIndexAt(Date.UTC(2026, 3, 1))).toBe(1)
  })

  it('시즌은 시작·종료 시각과 남은 시간을 가진다', () => {
    const now = Date.UTC(2026, 0, 10)
    const season = seasonAt(now)
    expect(season.id).toBe('season-2026-q1')
    expect(season.startsAt).toBeLessThanOrEqual(now)
    expect(season.endsAt).toBeGreaterThan(now)
    expect(seasonRemainingMs(season, now)).toBeGreaterThan(0)
    expect(seasonRemainingMs(season, season.endsAt + 1)).toBe(0)
  })

  it('남은 시간을 사람이 읽는 형태로 만든다', () => {
    expect(formatRemaining(0)).toBe('종료')
    expect(formatRemaining(3 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000)).toBe('3일 4시간')
    expect(formatRemaining(90 * 60 * 1000)).toBe('1시간 30분')
    expect(formatRemaining(45 * 1000)).toBe('0분')
  })
})
