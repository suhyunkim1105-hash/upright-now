import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUpRight,
  BotMessageSquare,
  Camera,
  Check,
  ChevronDown,
  Clock3,
  Gamepad2,
  GraduationCap,
  HeartPulse,
  MonitorCheck,
  Moon,
  ShieldCheck,
  Sparkles,
  StretchHorizontal,
  Trophy,
  UsersRound,
  Volume2,
} from 'lucide-react'
import { CharacterViewport } from '@/components/character/CharacterViewport'
import { ROUTES } from '@/constants/routes'
import './landing.css'

const LandingHero3D = lazy(() => import('@/components/landing/LandingHero3D').then((module) => ({ default: module.LandingHero3D })))

const steps = [
  {
    number: '01',
    title: '편안한 오늘의 자세를 등록해요',
    body: '얼굴과 양쪽 어깨가 보이게 앉아 5초만 유지해요. 정답 자세가 아니라, 오늘의 나를 기준으로 삼아요.',
    visual: 'baseline',
  },
  {
    number: '02',
    title: '내 리듬으로 집중을 시작해요',
    body: '15분, 25분, 50분 또는 직접 정한 시간으로 시작해요. 처음이면 3분 데모로 흐름부터 볼 수 있어요.',
    visual: 'focus',
  },
  {
    number: '03',
    title: '필요한 순간에만 알아차려요',
    body: '좋음, 가벼운 흐트러짐, 회복 제안, 자리 비움, 측정 불안정을 구분해 집중을 방해하지 않아요.',
    visual: 'notice',
  },
  {
    number: '04',
    title: '돌아온 순간을 다음 루틴으로 남겨요',
    body: '회복은 콤보와 캐릭터 성장으로 이어지고, 세션 뒤에는 오늘의 한 가지 다음 행동을 확인해요.',
    visual: 'recovery',
  },
] as const

const feedbackStates = [
  ['편안함', '좋음', '지금의 기준에 가까워요.', 'mint'],
  ['가벼운 변화', '알아차림', '조금만 편하게 돌아와 볼까요?', 'yellow'],
  ['회복 제안', '잠깐 쉬기', '집중을 멈추지 않는 짧은 안내예요.', 'pink'],
  ['측정 보류', '다시 확인', '자리 비움이나 조명 문제는 판단하지 않아요.', 'blue'],
] as const

const environmentTools = [
  [PictureInPicture, '작은 동행 창', '다른 탭으로 가면 아기 거북이 PiP가 동행해요. 거북이를 눌러 내 모습을 확인할 수 있어요.'],
  [StretchHorizontal, '2분 회복 루틴', '목과 어깨를 위한 6가지 짧은 동작을 집중 사이에 제안해요.'],
  [Volume2, '소리와 TTS', '조용한 곳에서는 끄고, 필요한 순간에만 짧은 안내를 들을 수 있어요.'],
  [Moon, '나에게 맞는 모드', '도서관, 내 공간, 팀플과 직접 만든 학습 환경을 고를 수 있어요.'],
] as const

const faq = [
  ['카메라 영상이나 사진이 저장되나요?', '아니요. 영상, 스냅샷, 프레임 데이터는 브라우저 안에서만 처리하며 저장하거나 외부로 보내지 않아요. 로컬에는 세션 결과 요약만 남길 수 있어요.'],
  ['자세를 의료적으로 진단하나요?', '아니요. Upright Now는 개인 기준과 비교한 변화로 습관 형성을 돕는 비의료적 피드백 서비스예요. 통증이나 불편이 계속되면 전문가와 상담해 주세요.'],
  ['카메라가 잘 연결되지 않으면 어떻게 하나요?', 'Chrome 또는 Edge의 HTTPS 환경에서 권한을 허용해 주세요. 세션 안의 카메라 패널에서 다시 연결할 수 있고, 다른 앱이 카메라를 쓰고 있는지도 확인할 수 있어요.'],
  ['3분 데모에서는 무엇을 볼 수 있나요?', '개인 기준 없이도 집중 타이머, 자세 상태 변화, 캐릭터 반응, 회복 흐름을 빠르게 둘러볼 수 있어요. 실제 비교 피드백에는 기준 등록이 필요해요.'],
  ['AI 세션 회고는 어떤 정보를 보나요?', '집중 시간과 회복 횟수처럼 세션에서 집계된 요약만 바탕으로 다음 행동을 제안해요. 카메라 영상, 얼굴 이미지, 랜드마크는 AI 리포트에 전달하지 않아요.'],
  ['PiP가 열리지 않으면 서비스가 멈추나요?', '아니요. PiP는 지원 브라우저에서 제공하는 보조 경험이에요. 지원하지 않거나 브라우저가 자동 열기를 막아도 세션과 본문 카메라 확인은 계속돼요.'],
] as const

function PictureInPicture(props: { size?: number; strokeWidth?: number }) {
  return <MonitorCheck {...props} />
}

function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (!('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setVisible(true)
        observer.unobserve(entry.target)
      },
      { threshold: 0.22, rootMargin: '0px 0px -14% 0px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`landing-reveal ${visible ? 'landing-reveal--visible' : ''} ${className}`}
      style={{ '--landing-delay': `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  )
}

function Statement() {
  const words = ['자세가', '흐트러져도', '집중은', '끊기지', '않도록.', 'Upright', 'Now가', '조용히', '곁에', '있을게요.']
  return (
    <section className="landing-statement" aria-label="서비스 약속">
      <Reveal>
        <p className="landing-kicker">집중을 방해하지 않는 자세 루틴</p>
        <h2>
          {words.map((word, index) => (
            <span key={`${word}-${index}`} style={{ transitionDelay: `${index * 145}ms` }}>
              {word}{' '}
            </span>
          ))}
        </h2>
      </Reveal>
    </section>
  )
}

export function Landing() {
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'Upright Now | 집중을 지키는 자세 회복 루틴'
    document.querySelector('meta[name="description"]')?.setAttribute(
      'content',
      'Upright Now는 개인 자세 기준, 온디바이스 카메라 분석, 집중 루틴과 회복 기록으로 오래 앉아 있는 시간을 돕는 웹 서비스입니다.',
    )
  }, [])

  const begin = () => navigate(ROUTES.onboardingName)

  return (
    <div className="landing-page">
      <a className="landing-skip" href="#landing-main">본문으로 건너뛰기</a>
      <header className="landing-nav" aria-label="Upright Now 탐색">
        <a className="landing-brand" href="#top" aria-label="Upright Now 처음으로">
          <span className="landing-brand__mark" aria-hidden="true">u</span>
          <span>Upright Now</span>
        </a>
        <nav className="landing-nav__links" aria-label="랜딩 탐색">
          <a href="#routine">사용 방법</a>
          <a href="#trust">개인정보</a>
          <a href="#reflection">세션 회고</a>
        </nav>
        <button type="button" className="landing-nav__cta" onClick={begin}>
          내 기준 만들기 <ArrowUpRight size={16} aria-hidden="true" />
        </button>
      </header>

      <main id="landing-main">
        <section id="top" className="landing-hero" aria-labelledby="landing-title">
          <Reveal className="landing-hero__copy">
            <p className="landing-kicker"><Sparkles size={15} aria-hidden="true" /> 오래 앉아 있는 오늘을 위한 루틴</p>
            <h1 id="landing-title"><span>PC 앞 집중을</span><span className="landing-hero__title-line--accent">가벼운 자세로</span></h1>
            <p className="landing-hero__description">
              개인 기준을 한 번 등록하면, Upright Now가 집중을 끊지 않는 선에서
              자세 변화를 알아차리고 회복할 순간을 알려드려요.
            </p>
            <button type="button" className="landing-button landing-button--bright" onClick={begin}>
              내 기준 만들기 <ArrowUpRight size={19} aria-hidden="true" />
            </button>
            <p className="landing-hero__proof"><ShieldCheck size={16} aria-hidden="true" /> 카메라 영상은 저장하거나 전송하지 않아요</p>
          </Reveal>
          <Suspense fallback={<div className="landing-hero-3d__fallback">오늘의 집중 장면을 준비하고 있어요.</div>}>
            <LandingHero3D />
          </Suspense>
          <a className="landing-hero__scroll" href="#routine">
            어떻게 쓰는지 보기 <ArrowDown size={16} aria-hidden="true" />
          </a>
        </section>

        <section className="landing-problem" aria-labelledby="problem-title">
          <Reveal className="landing-problem__question">
            <p className="landing-kicker">오래 앉아 공부할 때</p>
            <h2 id="problem-title">자세가 흐트러진 건 알겠는데,<br />집중까지 끊고 싶지는 않아요.</h2>
          </Reveal>
          <Reveal delay={150} className="landing-problem__answer">
            <span className="landing-problem__orb" aria-hidden="true" />
            <p>그래서 정답 자세를 채점하지 않아요. 오늘의 편안한 자세와 비교해, 필요한 변화만 조용히 알려드려요.</p>
            <div><Camera size={20} aria-hidden="true" /><span>내 기기 안에서 분석</span></div>
          </Reveal>
        </section>

        <Statement />

        <section id="routine" className="landing-section landing-routine" aria-labelledby="routine-title">
          <Reveal className="landing-section__heading">
            <p className="landing-kicker">한 번의 기준 설정, 매일의 집중</p>
            <h2 id="routine-title">복잡한 교정 대신,<br />네 번의 자연스러운 흐름으로.</h2>
          </Reveal>
          <div className="landing-routine__grid">
            <div className="landing-routine__visual" aria-hidden="true">
              <div className="landing-routine__sun" />
              <div className="landing-routine__screen">
                <div className="landing-routine__screen-head"><span>오늘의 집중</span><span>25:00</span></div>
                <CharacterViewport stage={1} size={205} decorative />
                <div className="landing-routine__screen-bar"><span /><span /><span /></div>
              </div>
            </div>
            <ol className="landing-routine__steps">
              {steps.map((step, index) => (
                <Reveal key={step.number} delay={index * 180}>
                  <li>
                    <span className="landing-step__number">{step.number}</span>
                    <div>
                      <h3>{step.title}</h3>
                      <p>{step.body}</p>
                    </div>
                    <Check size={19} aria-hidden="true" />
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        <section id="trust" className="landing-trust" aria-labelledby="trust-title">
          <Reveal className="landing-trust__content">
            <div className="landing-trust__seal"><ShieldCheck size={42} strokeWidth={1.45} aria-hidden="true" /></div>
            <p className="landing-kicker">카메라를 써도, 내 영상은 내 기기에</p>
            <h2 id="trust-title">원본 영상과 스냅샷은<br />저장하지 않아요.</h2>
            <p className="landing-trust__body">MediaPipe 기반 자세 분석은 브라우저 안에서 처리돼요. 세션 결과는 요약 정보만 로컬에 남기며, 의료 진단이나 자세 점수 경쟁을 하지 않아요.</p>
            <ul>
              <li><Check size={17} aria-hidden="true" /> 카메라 프레임 외부 전송 없음</li>
              <li><Check size={17} aria-hidden="true" /> 개인 기준 대비 변화만 안내</li>
              <li><Check size={17} aria-hidden="true" /> 결과 데이터는 직접 초기화 가능</li>
            </ul>
          </Reveal>
          <Reveal delay={180} className="landing-trust__diagram" aria-label="온디바이스 분석 흐름">
            <div><Camera size={28} aria-hidden="true" /><span>카메라</span></div>
            <i aria-hidden="true" />
            <div><MonitorCheck size={28} aria-hidden="true" /><span>브라우저 안 분석</span></div>
            <i aria-hidden="true" />
            <div><ShieldCheck size={28} aria-hidden="true" /><span>요약만 기록</span></div>
          </Reveal>
        </section>

        <section className="landing-section landing-session" aria-labelledby="session-title">
          <Reveal className="landing-section__heading">
            <p className="landing-kicker">내가 고른 시간으로 집중</p>
            <h2 id="session-title">공부는 내 속도로,<br />피드백은 필요한 만큼만.</h2>
          </Reveal>
          <div className="landing-session__cards">
            <Reveal className="landing-session-card landing-session-card--timer">
              <Clock3 size={31} strokeWidth={1.55} aria-hidden="true" />
              <span className="landing-session-card__eyebrow">집중 세션</span>
              <strong>25:00</strong>
              <p>15분, 25분, 50분, 직접 설정과 3분 데모까지. 시작에 필요한 선택만 남겼어요.</p>
              <div className="landing-session-card__pills"><span>15분</span><span className="is-active">25분</span><span>50분</span><span>직접 설정</span></div>
            </Reveal>
            <Reveal delay={220} className="landing-session-card landing-session-card--feedback">
              <HeartPulse size={31} strokeWidth={1.55} aria-hidden="true" />
              <span className="landing-session-card__eyebrow">단계적 자세 피드백</span>
              <p className="landing-session-card__lead">잔소리나 점수 대신, 상태에 맞는 짧은 안내로 강도를 조절해요.</p>
              <div className="landing-feedback-list">
                {feedbackStates.map(([label, title, body, tone]) => <div key={title} className={`landing-feedback-list__item is-${tone}`}><span>{label}</span><strong>{title}</strong><p>{body}</p></div>)}
              </div>
            </Reveal>
          </div>
        </section>

        <section className="landing-game" aria-labelledby="game-title">
          <div className="landing-game__inner">
            <Reveal className="landing-game__copy">
              <p className="landing-kicker">돌아온 순간이 남는 이유</p>
              <h2 id="game-title">몸을 다시 편 순간이,<br />오늘의 성장으로 이어져요.</h2>
              <p>회복 기회는 콤보가 되고, 콤보는 몬스터 공격과 XP로 이어져요. 집중을 잘한 날의 변화가 다음 접속에도 남아요.</p>
              <div className="landing-game__facts"><span><Gamepad2 size={17} aria-hidden="true" /> 회복 콤보</span><span><Trophy size={17} aria-hidden="true" /> 거북이에서 기린까지 6단계</span></div>
            </Reveal>
            <Reveal delay={160} className="landing-game__scene" aria-label="캐릭터 성장 예시">
              <span className="landing-game__spark landing-game__spark--one" aria-hidden="true">✦</span>
              <span className="landing-game__spark landing-game__spark--two" aria-hidden="true">✦</span>
              <div className="landing-game__character"><CharacterViewport stage={1} size={218} decorative /></div>
              <div className="landing-game__combo"><small>회복 콤보</small><strong>03</strong><span>다음 회복까지 조금만 더</span></div>
            </Reveal>
          </div>
        </section>

        <section className="landing-section landing-environment" aria-labelledby="environment-title">
          <Reveal className="landing-section__heading landing-section__heading--center">
            <p className="landing-kicker">집중 환경도 내 방식으로</p>
            <h2 id="environment-title">방해는 줄이고,<br />회복만 곁에 남겨요.</h2>
          </Reveal>
          <div className="landing-environment__grid">
            {environmentTools.map(([Icon, title, body], index) => <Reveal key={title} delay={index * 180}><article className="landing-environment-card"><span><Icon size={25} strokeWidth={1.55} aria-hidden="true" /></span><h3>{title}</h3><p>{body}</p></article></Reveal>)}
          </div>
        </section>

        <section id="reflection" className="landing-reflection" aria-labelledby="reflection-title">
          <Reveal className="landing-reflection__summary">
            <p className="landing-kicker">끝난 뒤에는 한 장의 회고</p>
            <h2 id="reflection-title">숫자를 보여주는 데서<br />끝나지 않아요.</h2>
            <p>집중 시간, 감지 가능 시간, 회복 기록, 출석을 한눈에 보고 다음 세션에서 할 한 가지를 정해요. 동의한 경우 Gemini 기반 AI 회고가 세션 요약을 짧은 행동 제안으로 바꿔드려요.</p>
          </Reveal>
          <Reveal delay={220} className="landing-reflection__report" aria-label="세션 리포트 예시">
            <header><span>오늘의 리포트</span><span>25분 집중</span></header>
            <div className="landing-reflection__numbers"><div><small>집중 시간</small><strong>24분</strong></div><div><small>회복 성공</small><strong>4회</strong></div><div><small>감지 가능</small><strong>21분</strong></div></div>
            <div className="landing-reflection__ai"><BotMessageSquare size={22} aria-hidden="true" /><p>다음 세션에는 시작 전 어깨 힘을 한 번만 빼 볼까요?</p></div>
            <small className="landing-reflection__note">카메라 영상이 아닌 세션 요약만 사용해요.</small>
          </Reveal>
        </section>

        <section className="landing-together" aria-labelledby="together-title">
          <Reveal>
            <p className="landing-kicker">혼자서도, 함께여도</p>
            <h2 id="together-title">친구와 같은 괴물을 만나고,<br />학교에서 쌓은 회복도 볼 수 있어요.</h2>
            <p>2인 방의 공동 괴물과 기린 싱크, 학교 테마와 시즌 기여는 집중을 계속할 수 있는 작은 이유가 돼요.</p>
          </Reveal>
          <Reveal delay={240} className="landing-together__people" aria-hidden="true"><UsersRound size={54} strokeWidth={1.3} /><span>기린 싱크</span><div><i /><i /><i /></div></Reveal>
        </section>

        <section className="landing-section landing-more" aria-labelledby="more-title">
          <Reveal className="landing-more__heading"><p className="landing-kicker">더 깊이 쓰고 싶다면</p><h2 id="more-title">확장 기능은<br />필요할 때만 열어 보세요.</h2></Reveal>
          <Reveal delay={180}><details className="landing-more__details"><summary><span><GraduationCap size={22} aria-hidden="true" /> 캠퍼스, 꾸미기, 개발 검증까지</span><ChevronDown size={22} aria-hidden="true" /></summary><div><article><strong>친구와 캠퍼스</strong><p>2인 방, 공동 괴물, 기린 싱크, 학교 테마, 96영토와 시즌 기여로 연결되는 집중 경험이에요.</p></article><article><strong>성장과 꾸미기</strong><p>XP와 포인트로 과잠과 백팩을 꾸미며 거북이에서 기린까지의 변화를 이어가요.</p></article><article><strong>내 데이터와 품질</strong><p>로컬 데이터 초기화, QA Lab, TF.js MoveNet 성능 진단은 제품을 안전하게 확인하기 위한 보조 도구예요.</p></article></div></details></Reveal>
        </section>

        <section className="landing-section landing-faq" aria-labelledby="faq-title">
          <Reveal className="landing-section__heading"><p className="landing-kicker">시작하기 전 자주 묻는 질문</p><h2 id="faq-title">가볍게 시작해도,<br />알아야 할 건 분명하게.</h2></Reveal>
          <div className="landing-faq__list">{faq.map(([question, answer], index) => <Reveal key={question} delay={index * 120}><details><summary>{question}<span>+</span></summary><p>{answer}</p></details></Reveal>)}</div>
        </section>

        <section className="landing-final" aria-labelledby="final-title">
          <Reveal>
            <p className="landing-kicker"><Sparkles size={15} aria-hidden="true" /> 오늘의 집중을 위한 준비</p>
            <h2 id="final-title">지금 앉아 있는 자리에서,<br />나만의 기준을 만들어 보세요.</h2>
            <button type="button" className="landing-button landing-button--dark" onClick={begin}>내 기준 만들기 <ArrowUpRight size={19} aria-hidden="true" /></button>
            <p>처음이면 3분 데모로 흐름부터 볼 수 있어요.</p>
          </Reveal>
        </section>
      </main>
      <footer className="landing-footer"><span>© 2026 Upright Now</span><span>개인 기준 대비 변화를 돕는 비의료적 집중 루틴</span></footer>
    </div>
  )
}
