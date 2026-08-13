import type { CampusSchoolDirectoryEntry, CampusSchoolPreset } from './types'

export type SchoolPickerSearchResult =
  | { kind: 'preset'; school: CampusSchoolPreset }
  | { kind: 'registered'; school: CampusSchoolDirectoryEntry }

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('ko-KR')
}

/** 프리셋과 사용자 등록 학교를 한 검색 결과로 합칩니다. */
export function filterSchoolPickerResults(
  presets: CampusSchoolPreset[],
  registeredSchools: CampusSchoolDirectoryEntry[],
  query: string,
): SchoolPickerSearchResult[] {
  const needle = normalize(query)
  const matches = (values: string[]) =>
    needle.length === 0 || values.some((value) => normalize(value).includes(needle))

  const presetResults: SchoolPickerSearchResult[] = presets
    .filter((school) => !school.custom)
    .filter((school) => matches([school.name, school.short, school.colorLabel]))
    .map((school) => ({ kind: 'preset' as const, school }))

  const presetIds = new Set(presetResults.map((result) => result.school.id))
  const registeredResults: SchoolPickerSearchResult[] = registeredSchools
    .filter((school) => !presetIds.has(school.id))
    .filter((school) => matches([school.displayName, school.shortName]))
    .map((school) => ({ kind: 'registered' as const, school }))

  return [...presetResults, ...registeredResults]
}
