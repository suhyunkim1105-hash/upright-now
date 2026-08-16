import { useMemo, useState } from 'react'
import {
  CAMPUS_COPY,
  CAMPUS_SCHOOLS,
  CUSTOM_COLOR_CHOICES,
  CUSTOM_SCHOOL_ID,
} from '@/constants/campus'
import { Badge, Button, TextField } from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { useCampusThemeStore } from '@/features/campus/campusThemeStore'
import {
  listRegisteredCustomSchools,
  useCampusDirectoryStore,
} from '@/features/campus/schoolDirectory'
import { resolveCampusTheme } from '@/features/campus/theme'
import {
  formatNextAllowed,
  SCHOOL_CHANGE_MESSAGE,
  type SchoolChangeDecision,
} from '@/features/campus/schoolChange'
import { seasonAt } from '@/features/campus/season'
import { filterSchoolPickerResults } from '@/features/campus/schoolPickerSearch'
import { CampusColorSourceNote } from './CampusBits'

/**
 * 학교 선택 — 설정 화면과 캠퍼스 화면에서 같은 컴포넌트를 씁니다.
 *
 * - 대학 인증이 없다는 사실을 화면에 그대로 노출합니다.
 * - 색은 프로토타입 컬러 프리셋이라고 표시합니다. 공식 색상이라고 주장하지 않습니다.
 * - 기타 학교는 사용자가 색을 직접 고릅니다.
 * - 학교 변경은 시즌 중 1회 · 7일에 1회로 제한합니다.
 */
export function SchoolPicker({
  onChanged,
}: {
  onChanged?: (schoolId: string) => void
}) {
  const schoolId = useCampusThemeStore((s) => s.schoolId)
  const customColor = useCampusThemeStore((s) => s.customColor)
  const customSchoolName = useCampusThemeStore((s) => s.customSchoolName)
  const customSchoolShortName = useCampusThemeStore((s) => s.customSchoolShortName)
  const setCustomSchoolName = useCampusThemeStore((s) => s.setCustomSchoolName)
  const selectSchool = useCampusThemeStore((s) => s.selectSchool)
  const setCustomColor = useCampusThemeStore((s) => s.setCustomColor)
  const checkChange = useCampusThemeStore((s) => s.checkChange)

  const [message, setMessage] = useState<string | null>(null)
  const [colorDraft, setColorDraft] = useState(customColor)
  const [customFormOpen, setCustomFormOpen] = useState(false)
  const [selectedRegion, setSelectedRegion] = useState('')
  const [schoolSearch, setSchoolSearch] = useState('')
  const directoryEntries = useCampusDirectoryStore((s) => s.entries)
  const registeredSchools = useMemo(
    () => listRegisteredCustomSchools(directoryEntries),
    [directoryEntries],
  )
  const searchResults = useMemo(
    () => filterSchoolPickerResults(CAMPUS_SCHOOLS, registeredSchools, schoolSearch),
    [registeredSchools, schoolSearch],
  )
  const saveCustomSchool = useCampusThemeStore((s) => s.saveCustomSchool)
  const syncStatus = useCampusThemeStore((s) => s.syncStatus)
  const canSaveCustom =
    customSchoolName.trim().length >= 2 &&
    customSchoolShortName.trim().length >= 2 &&
    /^#[0-9a-fA-F]{6}$/.test(customColor)

  const now = Date.now()
  const season = useMemo(() => seasonAt(now), [now])

  /** 현재 학교를 제외한 임의 후보로 변경 가능 여부를 미리 봅니다. */
  const probe: SchoolChangeDecision = useMemo(() => {
    const candidate = CAMPUS_SCHOOLS.find((s) => s.id !== schoolId)?.id ?? CUSTOM_SCHOOL_ID
    return checkChange(candidate, now)
  }, [checkChange, schoolId, now])

  const locked = Boolean(schoolId) && !probe.allowed
  const nextAllowed = formatNextAllowed(probe.nextAllowedAt)
  const currentTheme = resolveCampusTheme(schoolId, customColor)
  const showSearchResults = selectedRegion.length > 0 && schoolSearch.trim().length > 0

  const isCustomSelected =
    customFormOpen || Boolean(schoolId?.startsWith('custom'))

  const pick = (nextId: string) => {
    // 기타 / 직접 설정: 서버 호출 없이 입력 폼만 엽니다.
    if (nextId === CUSTOM_SCHOOL_ID) {
      setCustomFormOpen(true)
      setMessage(null)
      return
    }
    setCustomFormOpen(false)
    if (nextId === schoolId) return
    const decision = selectSchool(nextId, Date.now())
    if (!decision.allowed) {
      const reason = decision.reason ? SCHOOL_CHANGE_MESSAGE[decision.reason] : null
      const when = formatNextAllowed(decision.nextAllowedAt)
      setMessage([reason, when ? `${when} 이후에 다시 바꿀 수 있어요.` : null]
        .filter(Boolean)
        .join(' '))
      return
    }
    setMessage(null)
    onChanged?.(nextId)
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/* 요청서에 명시된 고지 문구 — 화면에 그대로 노출합니다. */}
      <p
        data-testid="campus-unofficial-line"
        className="rounded-2xl bg-yellow-soft px-3 py-2 text-xs font-bold text-[#8a6b12]"
      >
        {CAMPUS_COPY.unofficialTheme}
      </p>

      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="sr-only">학교 선택</legend>
        <div className="grid grid-cols-1 gap-2 @[560px]:grid-cols-2">
          <label className="relative block">
            <span className="sr-only">지역 선택</span>
            <select
              value={selectedRegion}
              onChange={(e) => {
                setSelectedRegion(e.target.value)
                setSchoolSearch('')
              }}
              aria-label="지역 선택"
              className="h-11 w-full appearance-none rounded-2xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-[#8b6cf6]"
            >
              <option value="">지역 선택</option>
              <option value="서울">서울</option>
            </select>
          </label>
          <label className="relative block">
            <span className="sr-only">대학 검색</span>
            <input
              value={schoolSearch}
              disabled={!selectedRegion}
              onChange={(e) => setSchoolSearch(e.target.value)}
              placeholder={selectedRegion ? '대학 이름 검색' : '먼저 지역을 선택하세요'}
              aria-label="대학 검색"
              className="h-11 w-full rounded-2xl border border-line bg-surface px-3 text-sm text-ink outline-none transition placeholder:text-ink-soft focus:border-[#8b6cf6] disabled:cursor-not-allowed disabled:bg-canvas disabled:opacity-70"
            />
          </label>
        </div>
        {schoolId && currentTheme && (
          <p className="mt-2 rounded-xl bg-canvas px-3 py-2 text-xs text-ink-soft">
            현재 선택: <strong className="text-ink">{currentTheme.schoolName}</strong>
          </p>
        )}
        {!selectedRegion && (
          <p className="mt-2 text-xs text-ink-soft">지역을 선택하면 해당 지역의 대학을 검색할 수 있어요.</p>
        )}
        {showSearchResults && (
          <div className="relative z-10 mt-2">
            <ul
              role="listbox"
              aria-label="대학 검색 결과"
              className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-2xl border border-line bg-surface p-1 shadow-card"
            >
              {searchResults.map((result) => {
            const preset = result.kind === 'preset' ? result.school : null
            const entry = result.kind === 'registered' ? result.school : null
            const id = preset?.id ?? entry?.id ?? ''
            const name = preset?.name ?? entry?.displayName ?? ''
            const color = preset?.primary ?? entry?.color ?? customColor
            const theme = resolveCampusTheme(id, color)
            // 커스텀 학교는 stable key(custom-xxxx)로 저장되므로 prefix 로 판정합니다.
            const selected = preset ? preset.id === schoolId : entry?.id === schoolId
            const disabled = locked && !selected
            return (
              <li
                key={id}
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={disabled}
                  onClick={() => {
                    if (entry) {
                      setCustomSchoolName(entry.displayName, entry.shortName)
                      setCustomColor(entry.color)
                      setColorDraft(entry.color)
                      const decision = saveCustomSchool(Date.now())
                      if (!decision.allowed) {
                        const reason = decision.reason
                          ? SCHOOL_CHANGE_MESSAGE[decision.reason]
                          : null
                        setMessage(reason ?? '지금은 학교를 바꿀 수 없어요.')
                        return
                      }
                      setSchoolSearch('')
                      setMessage(null)
                      onChanged?.(useCampusThemeStore.getState().schoolId ?? '')
                      return
                    }
                    setSchoolSearch('')
                    pick(id)
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
                >
                <span
                  aria-hidden="true"
                  className="inline-block h-7 w-7 shrink-0 rounded-full border border-line"
                  style={{ backgroundColor: theme?.primary }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold text-ink">
                    {name}
                  </span>
                  <span className="block truncate text-[11px] text-ink-soft">
                    {preset ? `${preset.colorLabel} · 프로토타입 프리셋` : '사용자가 등록한 학교'}
                  </span>
                </span>
                {selected && (
                  <span className="shrink-0">
                    <Icon name="check" size={18} />
                    <span className="sr-only">선택됨</span>
                  </span>
                )}
                </button>
              </li>
            )
              })}
            </ul>
            {searchResults.length === 0 && (
              <p className="mt-2 rounded-2xl border border-dashed border-line bg-canvas px-3 py-3 text-sm text-ink-soft">
                검색 결과가 없어요. 아래에서 목록에 없는 대학을 직접 추가할 수 있어요.
              </p>
            )}
          </div>
        )}
      </fieldset>

      {/* 기타 / 직접 설정 — 새 학교 등록 (비공식) */}
      <div className="mb-3 flex flex-wrap items-end gap-2 text-sm">
          <button
            type="button"
            onClick={() => {
              setCustomFormOpen(true)
              setMessage(null)
            }}
            className="w-full rounded-2xl border border-line bg-canvas px-3 py-2 text-left text-sm font-bold text-ink hover:bg-surface"
          >
            목록에 없는 대학 직접 추가
          </button>
          <p className="w-full text-[11px] text-ink-soft">
            저장하면 학교 디렉터리에 등록되어 다른 사용자도 검색하고 선택할 수 있어요.
          </p>
      </div>

      {isCustomSelected && (
        <div className="mb-3 flex flex-wrap items-end gap-2 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-soft">학교 이름 (2~30자)</span>
            <input
              maxLength={30}
              value={customSchoolName}
              onChange={(e) => setCustomSchoolName(e.target.value, customSchoolShortName)}
              className="h-9 w-52 rounded-xl border border-line bg-surface px-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-soft">짧은 표기 (2~8자)</span>
            <input
              maxLength={8}
              value={customSchoolShortName}
              onChange={(e) => setCustomSchoolName(customSchoolName, e.target.value)}
              className="h-9 w-28 rounded-xl border border-line bg-surface px-2"
            />
          </label>
          <p className="w-full text-[11px] text-ink-soft">
            사용자가 직접 입력한 비공식 학교 정보입니다.
          </p>
        </div>
      )}

      {/* 기타 / 직접 설정 — 색 직접 선택 */}
      {isCustomSelected && (
        <div className="rounded-2xl border border-line bg-canvas p-3">
          <p className="text-sm font-bold text-ink">내 색 고르기</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {CUSTOM_COLOR_CHOICES.map((choice) => (
              <button
                key={choice.color}
                type="button"
                aria-pressed={customColor.toUpperCase() === choice.color.toUpperCase()}
                onClick={() => {
                  setCustomColor(choice.color)
                  setColorDraft(choice.color)
                }}
                className={[
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                  customColor.toUpperCase() === choice.color.toUpperCase()
                    ? 'border-ink text-ink'
                    : 'border-line text-ink-soft',
                ].join(' ')}
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-3.5 w-3.5 rounded-full"
                  style={{ backgroundColor: choice.color }}
                />
                {choice.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex min-w-0 items-end gap-2">
            <div className="min-w-0 flex-1">
              <TextField
                id="campus-custom-color"
                label="직접 입력 (HEX)"
                value={colorDraft}
                maxLength={7}
                onChange={(e) => setColorDraft(e.target.value)}
                hint="예: #4A5CA8"
              />
            </div>
            <Button
              size="sm"
              onClick={() => {
                if (!setCustomColor(colorDraft)) {
                  setMessage('색 코드를 확인해 주세요. 예: #4A5CA8')
                  return
                }
                setMessage(null)
              }}
            >
              적용
            </Button>
          </div>
          {/* 명시 저장 — 이 버튼을 누르기 전에는 서버에 아무것도 만들지 않습니다. */}
          <button
            type="button"
            data-testid="campus-save-custom-school"
            disabled={!canSaveCustom || syncStatus === 'saving'}
            onClick={() => {
              const decision = saveCustomSchool(Date.now())
              if (!decision.allowed) {
                const reason = decision.reason ? SCHOOL_CHANGE_MESSAGE[decision.reason] : null
                setMessage(reason ?? '학교 이름(2~30자)·짧은 이름(2~8자)·색을 확인해 주세요.')
                return
              }
              setMessage(null)
              onChanged?.(useCampusThemeStore.getState().schoolId ?? '')
            }}
            className="campus-primary-bg mt-3 h-10 w-full rounded-xl text-sm font-bold disabled:opacity-40"
          >
            {syncStatus === 'saving' ? '저장하는 중…' : '학교 정보 저장하고 선택'}
          </button>
        </div>
      )}

      {currentTheme && <CampusColorSourceNote theme={currentTheme} />}

      <div className="flex flex-col gap-1 text-xs text-ink-soft">
        <p>· {CAMPUS_COPY.schoolChangeNotice}</p>
        <p>· {CAMPUS_COPY.schoolChangeContribution}</p>
        <p>· {CAMPUS_COPY.noLogo}</p>
      </div>

      {locked && (
        <p
          data-testid="campus-change-locked"
          className="flex flex-wrap items-center gap-2 rounded-2xl bg-canvas px-3 py-2 text-xs text-ink"
        >
          <Badge tone="muted">변경 제한</Badge>
          {probe.reason ? SCHOOL_CHANGE_MESSAGE[probe.reason] : ''}
          {nextAllowed ? ` ${nextAllowed} 이후에 다시 바꿀 수 있어요.` : ''}
          {` (${season.name})`}
        </p>
      )}

      {message && (
        <output className="block text-xs font-bold text-[#b8285a]">{message}</output>
      )}
    </div>
  )
}
