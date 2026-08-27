/**
 * 정책·고지 공개 페이지 콘텐츠.
 *
 * 개인정보처리방침·이용약관은 `docs/privacy/PRIVACY_POLICY.md`,
 * `docs/privacy/TERMS_OF_SERVICE.md`(코드 감사 기반 초안)를 이용자에게
 * 보여줄 수 있는 분량으로 정리한 버전입니다. 세부 근거(참조 파일, 표 전체)는
 * 두 문서 원본을 참고하세요. 법률 자문 전 초안이라는 성격은 그대로 유지합니다.
 */

export interface PolicySection {
  heading?: string
  paragraphs?: string[]
  list?: string[]
  table?: { headers: string[]; rows: string[][] }
  note?: string
}

export interface PolicyDoc {
  slug: string
  title: string
  eyebrow: string
  updated: string
  intro?: string
  sections: PolicySection[]
}

const CONTACT_EMAIL = 'uniker.monkeys@gmail.com'
const REPO_URL = 'https://github.com/suhyunkim1105-hash/upright-now'

export const POLICIES: PolicyDoc[] = [
  {
    slug: 'privacy',
    title: '개인정보처리방침',
    eyebrow: 'Privacy Policy',
    updated: '2026-08-12 (법률 자문 전 초안)',
    intro:
      '웹캠 화면은 브라우저 안에서만 분석되고, 분석이 끝난 프레임은 즉시 버려집니다. 영상·사진·자세 좌표는 어떤 서버에도 저장되거나 전송되지 않습니다.',
    sections: [
      {
        heading: '이 기기에만 저장되는 정보',
        paragraphs: ['브라우저 localStorage에 저장되며, 설정의 전체 데이터 초기화로 언제든 지울 수 있습니다.'],
        list: [
          '닉네임, 학습 프로필(도서관·내 공간·팀플·내 모드), 소리·PiP 설정',
          '개인 기준 자세 요약 통계(원본 좌표 아님), 카메라 식별용 해시값',
          '세션 요약 기록, XP·잎사귀 포인트·출석, 보유·장착 아이템',
        ],
      },
      {
        heading: '서버(Supabase)에 저장되는 정보',
        paragraphs: [
          '친구 방에 들어가거나 캠퍼스 화면을 연 뒤부터 저장이 시작됩니다. 그 전까지는 서버에 아무것도 저장되지 않습니다.',
        ],
        list: [
          '익명 사용자 ID — 이메일·전화번호·비밀번호를 받지 않는 익명 로그인',
          '친구 방 정보 — 방 코드, 입력한 과목·목표, 참가자 닉네임·상태 (같은 방 친구에게 보임)',
          '캠퍼스 학교 인증 — 인증된 학교 ID, 이메일 도메인, 인증 시각 (이메일 원본은 Supabase Auth에만 보관, 앱 테이블에는 복사되지 않음)',
          'XP·포인트 성장 기록 — 중복 지급·조작 방지를 위해 서버가 계산',
        ],
      },
      {
        heading: 'AI 회고(Google Gemini)로 나가는 정보',
        paragraphs: [
          '결과 화면에서 동의 체크박스를 켜고 "AI 회고 만들기"를 누를 때만 전송됩니다. 전송값은 정확히 아래 8개뿐입니다.',
        ],
        list: [
          '계획/실제 진행 분, 감지 가능 분, 자리 비움 분',
          '회복 기회 수, 회복 성공 수, 최고 콤보, 완료 상태(completed/aborted)',
        ],
        note: '세션 ID, 닉네임, 과목·목표, 카메라 영상·좌표, 학교, 이메일, 건강 정보는 포함되지 않습니다. 호출은 store: false로 전송되어 Google 쪽에 대화가 보관되지 않도록 요청합니다.',
      },
      {
        heading: '수집하지 않는 정보',
        list: [
          '실명, 주민등록번호, 전화번호, 주소, 결제 정보',
          '카메라 영상·사진·스냅샷·얼굴 이미지, 프레임별 랜드마크·자세 좌표 원본',
          '통증·질환 등 건강 정보, 위치 정보(GPS), 광고 식별자·크로스 사이트 추적 쿠키',
        ],
      },
      {
        heading: '제3자 제공과 처리위탁',
        table: {
          headers: ['수탁자', '위탁 업무', '위탁하는 정보'],
          rows: [
            ['Vercel Inc.', '호스팅, AI 회고 서버 함수 실행', '접속 로그(IP·시각·User-Agent), AI 회고 8개 집계값'],
            ['Supabase Inc.', 'DB, 익명 로그인, 학교 이메일 인증, 실시간 통신', '익명 사용자 ID, 이메일, 닉네임, 방·캠퍼스 데이터'],
            ['Google LLC (Gemini API)', 'AI 회고 문장 생성', '세션 집계 8개 값 (식별자 없음)'],
          ],
        },
        note: '제3자에게 개인정보를 판매하지 않습니다. 법령에 따른 수사기관의 적법한 요청이 있는 경우에만 예외로 합니다.',
      },
      {
        heading: '보관 기간',
        list: [
          '기기 안 정보 — 이용자가 직접 지울 때까지 보관 (별도 만료 없음)',
          '종료된 친구 방, 학교 소속, 성장 기록 — 계정 삭제 시 함께 삭제',
          '캠퍼스 기여 기록 — 시즌 종료 후 1년',
          '장기 미접속 익명 계정 — 1년 미접속 시 정리 대상',
        ],
      },
      {
        heading: '이용자의 권리',
        list: [
          '열람 — 기기 안 정보는 브라우저 개발자 도구에서, 서버 정보는 아래 연락처로 요청',
          '정정 — 닉네임·학교·프로필은 설정 화면에서 직접 변경',
          '삭제 — 설정 → 전체 데이터 초기화(기기), 서버 정보 삭제는 아래 연락처로 요청',
          '처리정지 — 브라우저에서 카메라 권한을 철회하면 자세 감지가 즉시 멈춤',
        ],
        note: '요청은 접수 후 10일 이내에 처리 결과를 알려드립니다.',
      },
      {
        heading: '만 14세 미만 아동',
        paragraphs: [
          'UpRight Now는 대학생을 대상으로 하며, 만 14세 미만은 이용할 수 없습니다. 만 14세 미만의 개인정보를 의도적으로 수집하지 않으며, 확인되는 즉시 파기합니다.',
        ],
      },
      {
        heading: '문의',
        paragraphs: [`개인정보 관련 문의: ${CONTACT_EMAIL}`],
        list: [
          '개인정보침해신고센터 — privacy.kisa.or.kr / 국번없이 118',
          '개인정보 분쟁조정위원회 — kopico.go.kr / 1833-6972',
        ],
      },
    ],
  },
  {
    slug: 'terms',
    title: '서비스 이용약관',
    eyebrow: 'Terms of Service',
    updated: '법률 자문 전 초안',
    sections: [
      {
        heading: '의료 서비스가 아닙니다',
        paragraphs: [
          'UpRight Now는 의료기기가 아니며 의료 서비스를 제공하지 않습니다. 「의료기기법」상 의료기기로 허가·인증·신고된 제품이 아닙니다.',
          '자세 감지 결과, AI 회고 문장, 스트레칭 추천은 의료 전문가의 진료·상담을 대체하지 않습니다. 통증이 있다면 의료 전문가와 상담해 주세요.',
        ],
      },
      {
        heading: '이용자의 금지행위',
        list: [
          '타인의 계정·초대 코드·인증을 무단으로 도용하는 행위',
          '자동화·매크로 등 비정상적인 방법으로 친구 방·캠퍼스 점수를 조작하는 행위',
          '서비스 결과를 의료 목적으로 사용하거나 타인에게 의료 정보처럼 제공하는 행위',
          '캐릭터 이모티콘 반응 등 소셜 기능을 괴롭힘 용도로 사용하는 행위',
        ],
      },
      {
        heading: '캠퍼스·랭킹전에 대한 고지',
        paragraphs: [
          '학교 인증은 이메일 도메인 확인 방식이며, 캠퍼스 테마·영토전·랭킹전은 사용자가 직접 선택한 비공식 기능입니다. 학교의 공식 입장이 아니며, 학교를 대표하거나 공식 순위를 나타내지 않습니다.',
          '학교 로고·마스코트 등 공식 자산은 사용하지 않고 학교 이름과 일반 패턴만 사용합니다.',
        ],
        list: [
          '학교는 한 시즌에 1회, 마지막 변경 후 7일이 지나야 다시 바꿀 수 있습니다.',
          '학교를 바꿔도 이전 학교에 쌓인 기여도는 이전되지 않습니다.',
        ],
      },
      {
        heading: '면책',
        paragraphs: [
          '회사는 통신 장애, 브라우저·기기 호환성 문제, 천재지변 등 회사의 고의·과실이 없는 사유로 발생한 서비스 중단에 책임지지 않습니다.',
          '이용자가 서비스 결과를 의료적으로 해석하거나 그에 따라 행동해 발생한 결과에 대해 회사는 책임지지 않습니다.',
          'AI 회고 문장은 자동 생성되며, 회사는 생성된 문장의 정확성을 보증하지 않습니다.',
        ],
      },
      {
        heading: '서비스 변경·중단',
        paragraphs: ['서비스는 베타 단계로, 기능이 예고 없이 변경되거나 일시 중단될 수 있습니다. 중대한 변경은 서비스 내 공지로 안내합니다.'],
      },
      {
        heading: '연락처',
        table: {
          headers: ['구분', '내용'],
          rows: [
            ['문의', CONTACT_EMAIL],
          ],
        },
      },
    ],
  },
  {
    slug: 'camera',
    title: '카메라 사용 고지',
    eyebrow: 'Camera Notice',
    updated: '2026-08-28',
    intro: '자세 감지를 위해 카메라를 사용합니다. 무엇을 보고, 무엇을 절대 하지 않는지를 먼저 안내합니다.',
    sections: [
      {
        heading: '캡처 사양',
        list: [
          '해상도 약 640×480 수준의 프레임만 사용하며, 오디오는 받지 않습니다.',
          '실시간으로 어깨·눈·코·귀 등 신체 랜드마크를 추출해 자세 판정에만 사용합니다.',
          '영상·사진·프레임·좌표 어느 것도 저장하거나 서버로 전송하지 않습니다. 분석 직후 각 프레임은 폐기됩니다.',
        ],
      },
      {
        heading: '온보딩에서의 안내 순서',
        paragraphs: [
          '카메라 권한을 요청하기 전에 무엇을 보고 무엇을 저장하지 않는지 먼저 설명합니다. 이후 편안한 자세를 5초간 등록하는 개인 기준 캘리브레이션을 거쳐야 카메라 기반 세션을 시작할 수 있습니다.',
          '카메라를 쓰고 싶지 않다면 3분 데모로 카메라 없이 흐름을 체험할 수 있습니다.',
        ],
      },
      {
        heading: '사용자가 직접 제어할 수 있는 것',
        list: [
          '설정에서 현재 카메라 확인, 감지 민감도(부드럽게~민감하게) 조정',
          '탭을 벗어나면 PiP(그림 속 그림) 미니 위젯이 상태를 계속 보여주며, 미지원 브라우저에서는 화면 안 대체 위젯이 표시됩니다.',
          '브라우저 자체에서 카메라 권한을 언제든 철회할 수 있으며, 철회 즉시 자세 감지가 멈춥니다.',
        ],
      },
      {
        heading: '권한 거부·오류 시 동작',
        paragraphs: [
          '카메라 권한을 거부해도 서비스 자체는 계속 이용할 수 있으며, 3분 데모로 안내됩니다. 인식 모델 로딩에 실패해도 세션은 유지되고 재시도할 수 있습니다.',
        ],
      },
    ],
  },
  {
    slug: 'security',
    title: '보안 정책 및 취약점 신고',
    eyebrow: 'Security Policy',
    updated: '2026-08-28',
    sections: [
      {
        heading: '데이터 보호 원칙',
        list: [
          '웹캠 영상은 애초에 서버로 전송되지 않아, 서버 유출 경로 자체가 구조적으로 없습니다.',
          '친구 방 실시간 이벤트는 허용된 필드 목록 밖의 값이 섞이면 전송·수신 양쪽에서 차단합니다.',
          'Supabase의 모든 방 테이블에 행 수준 보안(RLS)이 적용되어, 방 멤버만 해당 방 데이터를 읽을 수 있습니다.',
          '점수·보스 체력 등은 클라이언트가 보낸 값을 그대로 믿지 않고 서버가 계산합니다.',
          'Google Gemini API 키 등 민감 값은 서버 환경 변수로만 두고 브라우저 번들에 포함하지 않습니다.',
          '학교 인증은 비밀번호 없는 이메일 인증 방식을 사용해 비밀번호 유출 위험을 원천적으로 줄입니다.',
          '모든 통신은 HTTPS로 암호화됩니다.',
        ],
      },
      {
        heading: '취약점을 발견했다면',
        paragraphs: [
          '인증 우회, 데이터 접근 제어 우회, 점수·보상 조작 등 보안 취약점을 발견한 경우 공개 이슈로 먼저 올리지 말고 아래로 제보해 주세요.',
        ],
        list: [
          `이메일 — ${CONTACT_EMAIL}`,
          `GitHub 저장소(${REPO_URL})에 비공개 Security Advisory로 등록`,
        ],
        note: '접수 후 합리적인 기간 내 1차 회신을 목표로 합니다. 성실하게 제보한 취약점에 대해서는 법적 조치를 취하지 않으며, 수정 완료 후 제보자 동의하에 감사 인사를 남길 수 있습니다.',
      },
    ],
  },
  {
    slug: 'accessibility',
    title: '접근성 고지',
    eyebrow: 'Accessibility',
    updated: '2026-08-28',
    sections: [
      {
        heading: '카메라 없이도 사용 가능',
        paragraphs: ['카메라 권한이 없거나 사용하고 싶지 않다면 첫 화면에서 카메라 없이 볼 수 있는 3분 데모를 제공합니다.'],
      },
      {
        heading: '감각·환경별 대안',
        list: [
          '소리 — 회복·완료 알림음을 켜고 끌 수 있으며 기본값은 꺼짐입니다.',
          '모드별 안내 방식 — 도서관 모드는 주변에 방해되지 않도록 소리 안내를 쓰지 않고, 내 공간 모드는 소리 안내를 제공합니다.',
          '감지 민감도 — 부드럽게(넓은 허용 범위)부터 민감하게(좁은 허용 범위)까지 조정해 신체 조건·촬영 환경 차이를 보정할 수 있습니다.',
          'PiP 대체 동작 — PiP를 지원하지 않거나 차단된 브라우저에서는 화면 안 대체 위젯이 상태를 계속 보여주어 기능이 막히지 않습니다.',
        ],
      },
      {
        heading: '시각적 보조',
        paragraphs: ['자세 상태는 색상뿐 아니라 문구로도 함께 전달되어(편안함·가벼운 변화·회복 제안·측정 보류), 색상 구분이 어려운 사용자도 상태를 알 수 있습니다.'],
      },
      {
        heading: '개선 중인 부분',
        paragraphs: [`키보드만으로 전체 플로우를 완주하는 경로와 스크린 리더 레이블은 계속 점검하고 있습니다. 접근성 관련 불편 사항은 ${CONTACT_EMAIL}로 알려주시면 우선 검토합니다.`],
      },
    ],
  },
  {
    slug: 'licenses',
    title: '오픈소스 라이선스 고지',
    eyebrow: 'Open Source Licenses',
    updated: '2026-08-28',
    intro: 'UpRight Now는 아래와 같은 오픈소스·외부 서비스를 사용합니다. 정확한 버전과 전체 목록은 저장소의 package.json을 함께 참고해 주세요.',
    sections: [
      {
        table: {
          headers: ['구성 요소', '용도'],
          rows: [
            ['@mediapipe/tasks-vision', '실시간 자세·얼굴 랜드마크 추출 (Google, Apache License 2.0)'],
            ['@tensorflow/tfjs-core, tfjs-backend-wasm, @tensorflow-models/pose-detection', '보조 자세 추정 엔진 (Google, Apache License 2.0)'],
            ['@supabase/supabase-js', '인증·데이터베이스·실시간 통신 클라이언트 (Apache License 2.0)'],
            ['react, react-dom, react-router-dom', 'UI 프레임워크·라우팅 (Meta 외, MIT License)'],
            ['zustand', '클라이언트 상태 관리 (MIT License)'],
            ['zod', '데이터 검증 (MIT License)'],
            ['@radix-ui/react-dialog, react-tooltip', '접근성 있는 UI 프리미티브 (MIT License)'],
            ['lucide-react', '아이콘 세트 (ISC License)'],
            ['tailwindcss, @tailwindcss/vite', '스타일링 (MIT License)'],
            ['three', '3D 렌더링 (MIT License)'],
            ['@google/genai, genkit, @ai-sdk/react', 'AI 회고 생성을 위한 Gemini 연동 (Google/Vercel, Apache License 2.0)'],
            ['@langfuse/client, @langfuse/tracing', 'AI 요청 관측(모델명·성공/실패·지연 시간만 기록) (MIT License)'],
          ],
        },
        note: '각 구성 요소는 해당 라이선스 원문의 조건을 따릅니다. 특정 라이브러리의 정확한 라이선스 고지 원문이 필요하면 문의해 주세요.',
      },
    ],
  },
  {
    slug: 'status',
    title: '서비스 상태 및 문의',
    eyebrow: 'Status & Contact',
    updated: '2026-08-28',
    sections: [
      {
        heading: '서비스 상태',
        paragraphs: [
          '현재 UpRight Now는 베타(프로토타입) 단계이며, 기능이 예고 없이 추가·변경될 수 있습니다.',
          `배포 주소: upright-now.vercel.app · 저장소: ${REPO_URL}`,
        ],
      },
      {
        heading: '문의 방법',
        table: {
          headers: ['유형', '채널'],
          rows: [
            ['일반 문의·버그 제보', CONTACT_EMAIL],
            ['보안 취약점 제보', '보안 정책 및 취약점 신고 페이지 참고'],
            ['개인정보 관련 문의', '개인정보처리방침 페이지 하단 연락처 참고'],
            ['접근성 관련 불편', '접근성 고지 페이지 하단 연락처 참고'],
          ],
        },
      },
    ],
  },
]

export function getPolicy(slug: string): PolicyDoc | undefined {
  return POLICIES.find((p) => p.slug === slug)
}
