import { Navigate, Route, Routes } from 'react-router-dom'
import { LandingDashboard } from '@/app/routes/LandingDashboard'
import { Landing } from '@/app/routes/Landing'
import { ZarafaLanding } from '@/app/routes/ZarafaLanding'
import { OnboardingName } from '@/app/routes/OnboardingName'
import { Profiles } from '@/app/routes/Profiles'
import { CameraIntro } from '@/app/routes/CameraIntro'
import { SessionSetup } from '@/app/routes/SessionSetup'
import { Session } from '@/app/routes/Session'
import { Result } from '@/app/routes/Result'
import { QaLab } from '@/app/routes/QaLab'
import { Calibration } from '@/app/routes/Calibration'
import { Stretch } from '@/app/routes/Stretch'
import { History } from '@/app/routes/History'
import { Growth } from '@/app/routes/Growth'
import { Shop } from '@/app/routes/Shop'
import { Settings } from '@/app/routes/Settings'
import { RoomNew } from '@/app/routes/RoomNew'
import { Room } from '@/app/routes/Room'
import { Campus } from '@/app/routes/Campus'
import { CampusMap } from '@/app/routes/CampusMap'
import { CampusHistory } from '@/app/routes/CampusHistory'
import { featureFlags } from '@/lib/feature-flags/flags'

/** 라우트 — docs/04_IA.md §1 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingDashboard />} />
      <Route path="/landing" element={<ZarafaLanding />} />
      <Route path="/zarafa" element={<ZarafaLanding />} />
      <Route path="/upright-now" element={<Landing />} />
      <Route path="/upright-now/landing" element={<Landing />} />
      <Route path="/onboarding/name" element={<OnboardingName />} />
      <Route path="/profiles" element={<Profiles />} />
      <Route path="/camera" element={<CameraIntro />} />
      <Route path="/calibration" element={<Calibration />} />

      <Route path="/session/setup" element={<SessionSetup />} />
      <Route path="/session/:sessionId" element={<Session />} />

      <Route path="/stretch" element={<Stretch />} />
      <Route path="/stretch/:routineId" element={<Stretch />} />

      <Route path="/result/:sessionId" element={<Result />} />

      <Route path="/history" element={<History />} />
      <Route path="/growth" element={<Growth />} />
      <Route path="/shop" element={<Shop />} />

      <Route path="/room/new" element={<RoomNew />} />
      <Route path="/room/:roomCode" element={<Room />} />

      <Route path="/settings" element={<Settings />} />

      {/*
        캠퍼스 영토전 — 플래그가 꺼진 빌드에서는 라우트 자체를 등록하지 않습니다.
        (주소로 직접 들어오면 아래 `*` 가 홈으로 보냅니다 → 404 없음)
      */}
      {featureFlags.campusTerritory && (
        <>
          <Route path="/campus" element={<Campus />} />
          <Route path="/campus/map" element={<CampusMap />} />
          <Route path="/campus/history" element={<CampusHistory />} />
        </>
      )}

      {/* 운영 빌드에서는 라우트 자체를 등록하지 않습니다. (docs/02 FR-017) */}
      {featureFlags.qaLab && <Route path="/lab" element={<QaLab />} />}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
