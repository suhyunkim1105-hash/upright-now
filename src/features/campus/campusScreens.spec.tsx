import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

/** 캠퍼스 테마·영토전 플래그가 모두 켜진 빌드 */
const ON = {
  camera: false,
  friendRoom: false,
  realtimeRoom: false,
  pictureInPicture: false,
  qaLab: false,
  optionalSlouchCalibration: false,
  campusTheme: true,
  campusTerritory: true,
  campusSchoolPicker: true,
}

vi.mock('@/lib/feature-flags/flags', () => ({
  featureFlags: ON,
  parseFlag: () => false,
  readFeatureFlags: () => ON,
}))

const { App } = await import('@/app/App')
const { CAMPUS_COPY } = await import('@/constants/campus')
const { useCampusThemeStore } = await import('./campusThemeStore')
const { disposeCampus } = await import('./campusStore')
const { resetMockCampusForTest } = await import('./mockRepository')
const { useDemoStore } = await import('@/features/demo/demoMode')
const { SEOUL_DISTRICTS } = await import('./seoulDistrictMap')

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

async function choosePresetSchool(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.selectOptions(screen.getByRole('combobox', { name: '지역 선택' }), '서울')
  await user.type(screen.getByRole('textbox', { name: '대학 검색' }), name)
  await user.click(screen.getByRole('option', { name: new RegExp(name) }))
}

/** 공식 대항전·공식 순위처럼 읽히면 안 되는 표현 */
const BANNED_PHRASES = [
  '공식 대항전이에요',
  '공식 대항전입니다',
  '공식 순위예요',
  '공식 순위입니다',
  '공식 색상이에요',
  '공식 색상입니다',
  '대학 인증 완료',
  '학교를 대표해요',
  '학교 대표로',
]

describe('캠퍼스 화면 (플래그 ON)', () => {
  beforeEach(() => {
    localStorage.clear()
    resetMockCampusForTest()
    disposeCampus()
    useCampusThemeStore.getState().reset()
    useDemoStore.setState({ isDemo: false })
  })

  afterEach(() => {
    disposeCampus()
    resetMockCampusForTest()
    localStorage.clear()
    document.documentElement.removeAttribute('data-campus-school')
    document.documentElement.style.removeProperty('--campus-primary')
  })

  it('설정에 학교 검색형 선택기가 있고 비공식 고지 문구가 그대로 보인다', async () => {
    const user = userEvent.setup()
    renderAt('/settings')

    expect(screen.getByText('학교 선택 (캠퍼스 테마)')).toBeInTheDocument()
    expect(screen.getByTestId('campus-unofficial-line')).toHaveTextContent(
      CAMPUS_COPY.unofficialTheme,
    )
    expect(screen.getByRole('combobox', { name: '지역 선택' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '대학 검색' })).toBeDisabled()

    await choosePresetSchool(user, '서울대학교')
    expect(screen.getByText('현재 선택:')).toBeInTheDocument()
    expect(screen.getByText('서울대학교')).toBeInTheDocument()
  })

  it('학교를 고르면 배지와 캠퍼스 CSS 변수가 나타난다', async () => {
    const user = userEvent.setup()
    renderAt('/settings')

    await choosePresetSchool(user, '고려대학교')

    expect(useCampusThemeStore.getState().schoolId).toBe('korea')
    expect(document.documentElement.getAttribute('data-campus-school')).toBe('korea')
    expect(document.documentElement.style.getPropertyValue('--campus-primary')).toBe(
      '#8E2438',
    )
    expect(screen.getAllByTestId('campus-school-badge').length).toBeGreaterThan(0)
  })

  it('색 출처를 공식 색상이라고 표시하지 않는다', async () => {
    const user = userEvent.setup()
    renderAt('/settings')
    await choosePresetSchool(user, '연세대학교')

    expect(
      screen.getByText(/프로토타입이 임의로 고른 컬러 프리셋/),
    ).toBeInTheDocument()
  })

  it('기타 학교에서는 색을 직접 고를 수 있다', async () => {
    const user = userEvent.setup()
    renderAt('/settings')

    await user.click(screen.getByRole('button', { name: '목록에 없는 대학 직접 추가' }))
    expect(screen.getByText('내 색 고르기')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /딥 퍼플/ }))
    expect(useCampusThemeStore.getState().customColor).toBe('#7A4FA3')
  })

  it('/campus 에 서울 25개 자치구 지도와 비공식 프로토타입 안내가 있다', async () => {
    useCampusThemeStore.getState().selectSchool('snu')
    renderAt('/campus')

    expect(await screen.findByTestId('territory-map')).toBeInTheDocument()
    expect(screen.getAllByTestId('territory-district')).toHaveLength(SEOUL_DISTRICTS.length)
    expect(SEOUL_DISTRICTS).toHaveLength(25)
    expect(screen.getAllByTestId('campus-unofficial-notice').length).toBeGreaterThan(0)
    expect(screen.getByText('내 학교')).toBeInTheDocument()
    expect(screen.getByText('이번 시즌')).toBeInTheDocument()
    expect(screen.getByText('점령 타일 수')).toBeInTheDocument()
    expect(screen.getByText('내 기여도')).toBeInTheDocument()
  })

  it('/campus 는 학교를 고르기 전에는 학교 선택을 먼저 보여준다', () => {
    renderAt('/campus')
    expect(screen.getByText('먼저 학교를 골라 주세요')).toBeInTheDocument()
  })

  it('캠퍼스 화면 문구가 공식 경쟁처럼 읽히지 않는다', async () => {
    useCampusThemeStore.getState().selectSchool('snu')
    renderAt('/campus')
    await screen.findByTestId('territory-map')

    const text = document.body.textContent ?? ''
    for (const phrase of BANNED_PHRASES) {
      expect(text).not.toContain(phrase)
    }
    expect(text).toContain('비공식')
  })

  it('/campus/map 에서 타일을 고르면 상세가 보이고 기여 대상으로 설정할 수 있다', async () => {
    const user = userEvent.setup()
    useCampusThemeStore.getState().selectSchool('snu')
    renderAt('/campus/map')

    await screen.findByTestId('territory-map')
    const district = screen
      .getAllByTestId('territory-district')
      .find((candidate) => candidate.querySelector('path[role="button"]'))
    expect(district).toBeDefined()
    const selectableDistrict = within(district as HTMLElement).getByRole('button')
    await user.click(selectableDistrict)

    expect(screen.getByText('현재 점령 학교')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '기여 대상으로 설정' }))
    expect(useCampusThemeStore.getState().targetTileId).toBeTruthy()
  })

  it('/campus/history 는 시즌 영토 변화를 보여준다', async () => {
    useCampusThemeStore.getState().selectSchool('snu')
    renderAt('/campus/history')

    expect(await screen.findByText(/영토 변화$/)).toBeInTheDocument()
    expect(screen.getByText('지난 시즌 최종 지도')).toBeInTheDocument()
  })

  it('사이드바에 캠퍼스 메뉴가 있고 대시보드에 캠퍼스 카드가 있다', () => {
    renderAt('/')
    expect(screen.getByRole('link', { name: '캠퍼스' })).toBeInTheDocument()
    expect(screen.getByTestId('campus-dashboard-card')).toBeInTheDocument()
  })

  it('시즌 중 두 번째 학교 변경은 화면에서 막힌다', async () => {
    const user = userEvent.setup()
    renderAt('/settings')

    // 첫 선택 (제한 없음) → 1회 변경 → 그 뒤로는 잠깁니다.
    await choosePresetSchool(user, '서울대학교')
    await choosePresetSchool(user, '고려대학교')

    expect(screen.getByTestId('campus-change-locked')).toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: '지역 선택' }), '서울')
    await user.type(screen.getByRole('textbox', { name: '대학 검색' }), '연세대학교')
    expect(screen.getByRole('option', { name: /연세대학교/ })).toBeDisabled()
    expect(useCampusThemeStore.getState().schoolId).toBe('korea')
  })

  it('결과 화면 공유 카드에 학교 테두리와 배지가 붙는다', () => {
    useCampusThemeStore.getState().selectSchool('skku')
    // 코어의 결과 화면 가드(세션 id 검증)를 통과하려면 데모 모드가 필요합니다.
    useDemoStore.setState({ isDemo: true })
    renderAt('/result/demo')

    const frame = screen.getByTestId('campus-share-frame')
    expect(frame).toBeInTheDocument()
    expect(within(frame).getByTestId('campus-school-badge')).toBeInTheDocument()
  })
})
