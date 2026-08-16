import { describe, expect, it } from 'vitest'
import { CAMPUS_SCHOOLS } from '@/constants/campus'
import { filterSchoolPickerResults } from './schoolPickerSearch'

describe('filterSchoolPickerResults', () => {
  it('검색어로 프리셋 학교의 이름과 짧은 이름을 찾는다', () => {
    const results = filterSchoolPickerResults(CAMPUS_SCHOOLS, [], '한양')

    expect(results).toHaveLength(1)
    expect(results[0]?.kind).toBe('preset')
    expect(results[0]?.school.id).toBe('hanyang')
  })

  it('검색어가 비어 있으면 프리셋과 사용자 등록 학교를 함께 보여준다', () => {
    const results = filterSchoolPickerResults(CAMPUS_SCHOOLS, [
      {
        id: 'custom-a1b2',
        displayName: '서울예술대학교',
        shortName: '서울예대',
        color: '#123456',
        isCustom: true,
      },
    ], '')

    expect(results.some((result) => result.kind === 'preset')).toBe(true)
    expect(results.some((result) => result.kind === 'registered')).toBe(true)
  })
})
