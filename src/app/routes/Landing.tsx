import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  BotMessageSquare,
  Camera,
  Check,
  Clock3,
  Focus,
  PictureInPicture2,
  ScanFace,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { CharacterViewport } from '@/components/character/CharacterViewport'
import { ROUTES } from '@/constants/routes'
import './landing.css'

const benefits = [
  { icon: ScanFace, title: '나만의 기준선', description: '정답 자세를 강요하지 않고, 편안한 오늘의 자세를 기준으로 삼아요.', tone: 'pink' },
  { icon: Clock3, title: '집중의 리듬', description: '집중 시간에는 방해를 줄이고, 필요한 순간에만 짧게 쉬어가요.', tone: 'yellow' },
  { icon: PictureInPicture2, title: '곁에 있는 작은 창', description: '작은 PiP 창으로도 흐름을 놓치지 않고 상태를 확인할 수 있어요.', tone: 'blue' },
  { icon: BotMessageSquare, title: '한 장의 회고', description: '세션이 끝나면 숫자를 오늘의 다음 행동으로 바꿔드려요.', tone: 'green' },
] as const

const steps = [
  ['01', '편한 자리에 앉아요.', '얼굴과 어깨가 보이도록 카메라를 한 번만 맞춰요.'],
  ['02', '집중을 시작해요.', '타이머와 작은 동행 창이 조용히 오늘의 흐름을 지켜봐요.'],
  ['03', '짧게 돌아봐요.', '세션이 끝나면 다음 집중을 위한 한 가지 행동만 남겨요.'],
] as const

const faq = [
  ['카메라 영상이 저장되나요?', '아니요. 카메라 영상과 스냅샷은 브라우저 안에서만 처리하며 저장하거나 외부로 전송하지 않아요.'],
  ['자세를 의료적으로 진단하나요?', '아니요. Upright Now는 개인 기준 대비 변화에 관한 습관 형성 피드백을 제공하며 의료 진단을 하지 않아요.'],
  ['PiP는 무엇인가요?', '작은 별도 창에서 집중 시간과 상태를 확인하는 기능이에요. 지원하지 않는 브라우저에서는 화면 안의 작은 동행 화면으로 이어져요.'],
  ['AI 리포트는 언제 볼 수 있나요?', '세션이 끝난 뒤 설정이 활성화되어 있으면, 저장하지 않은 집계 결과를 바탕으로 짧은 회고를 받아볼 수 있어요.'],
] as const

function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (!('IntersectionObserver' in window)) {
      setIsVisible(true)
      return
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true)
        observer.unobserve(entry.target)
      }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return <div ref={ref} className={`landing-reveal ${isVisible ? 'landing-reveal--visible' : ''} ${className}`} style={{ '--landing-delay': `${delay}ms` } as CSSProperties}>{children}</div>
}

export function Landing() {
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'Upright Now | 앉아 있는 시간을 내 편으로'
    document.querySelector('meta[name="description"]')?.setAttribute('content', 'Upright Now는 개인 자세 기준선, 집중 타이머, PiP, AI 회고로 PC 앞의 집중 리듬을 돕는 웹 서비스입니다.')
  }, [])

  const begin = () => navigate(ROUTES.onboardingName)

  return (
    <div className="landing-page">
      <a className="landing-skip" href="#landing-main">본문으로 건너뛰기</a>
      <header className="landing-nav" aria-label="Upright Now 안내">
        <a className="landing-brand" href="#top" aria-label="Upright Now 처음으로"><span className="landing-brand__mark" aria-hidden="true">u</span><span>Upright Now</span></a>
        <nav className="landing-nav__links" aria-label="랜딩 내비게이션"><a href="#how">이용 방법</a><a href="#features">기능</a><a href="#privacy">개인정보</a></nav>
        <button type="button" className="landing-nav__cta" onClick={begin}>내 기준 만들기 <ArrowUpRight size={17} aria-hidden="true" /></button>
      </header>

      <main id="landing-main">
        <section id="top" className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero__copy">
            <Reveal><p className="landing-eyebrow"><Sparkles size={15} aria-hidden="true" /> 집중을 지키는 자세 루틴</p></Reveal>
            <Reveal delay={120}><h1 id="landing-title">앉아 있는 시간은 그대로.<br /><span>자세를 돌보는 방식은 다르게.</span></h1></Reveal>
            <Reveal delay={220}><p className="landing-hero__description">Upright Now는 카메라로 오늘의 편안한 자세를 기준 삼고,<br />집중을 끊지 않는 작은 신호를 건네는 웹 루틴이에요.</p></Reveal>
            <Reveal delay={320} className="landing-hero__actions"><button type="button" className="landing-button landing-button--primary" onClick={begin}>내 기준 자세 만들기 <ArrowUpRight size={19} aria-hidden="true" /></button><p><ShieldCheck size={17} aria-hidden="true" /> 영상은 저장하지 않아요.</p></Reveal>
          </div>

          <Reveal delay={180} className="landing-hero__scene" aria-label="Upright Now 집중 화면 미리보기">
            <div className="landing-hero__sun" aria-hidden="true" /><div className="landing-hero__orbit landing-hero__orbit--one" aria-hidden="true" /><div className="landing-hero__orbit landing-hero__orbit--two" aria-hidden="true" />
            <div className="landing-hero__panel"><div className="landing-hero__panel-top"><span>오늘의 자세 리듬</span><span className="landing-live"><i /> 집중 중</span></div><div className="landing-hero__character" aria-hidden="true"><CharacterViewport stage={2} size={276} decorative /></div><div className="landing-hero__status"><div><small>집중</small><strong>25:00</strong></div><div><small>회복</small><strong>2회</strong></div><div><small>콤보</small><strong>× 3</strong></div></div></div>
            <div className="landing-hero__pip" aria-hidden="true"><Camera size={19} /><span>개인 기준 확인 중</span><i /></div>
          </Reveal>
        </section>

        <section className="landing-proof" aria-label="서비스 약속"><p>처음 한 번은 기준을 잡고</p><span aria-hidden="true" /><p>그다음부터는 변화만 살펴봐요</p><span aria-hidden="true" /><p>집중의 흐름은 그대로</p></section>

        <section className="landing-tagline" aria-label="핵심 메시지"><Reveal><p className="landing-tagline__overline">당신을 감시하지 않는 집중 도구</p><h2>{['자세가', '신경', '쓰여서', '집중을', '놓치지', '않도록.', 'Upright', 'Now가', '조용히', '곁에', '있을게요.'].map((word, index) => <span key={`${word}-${index}`} style={{ transitionDelay: `${index * 95}ms` }}>{word} </span>)}</h2></Reveal></section>

        <section id="features" className="landing-section landing-features" aria-labelledby="features-title">
          <Reveal><p className="landing-section__eyebrow">네 가지로 충분한 루틴</p><h2 id="features-title">더 오래 앉기 위해,<br />더 자주 나를 확인해요.</h2></Reveal>
          <div className="landing-feature-grid">{benefits.map(({ icon: BenefitIcon, title, description, tone }, index) => <Reveal key={title} delay={index * 110} className={`landing-feature-card landing-feature-card--${tone}`}><div className="landing-feature-card__icon"><BenefitIcon size={26} strokeWidth={1.75} aria-hidden="true" /></div><h3>{title}</h3><p>{description}</p><span className="landing-feature-card__index">0{index + 1}</span></Reveal>)}</div>
        </section>

        <section id="how" className="landing-section landing-steps" aria-labelledby="how-title">
          <div className="landing-steps__visual" aria-hidden="true"><span className="landing-steps__bubble landing-steps__bubble--pink" /><span className="landing-steps__bubble landing-steps__bubble--blue" /><Focus size={66} strokeWidth={1.25} /></div>
          <div className="landing-steps__content"><Reveal><p className="landing-section__eyebrow">한 번의 기준 설정, 매일의 집중</p><h2 id="how-title">복잡한 교정 대신<br />세 장면으로 시작해요.</h2></Reveal><ol>{steps.map(([number, title, description], index) => <Reveal key={number} delay={index * 130}><li><span>{number}</span><div><h3>{title}</h3><p>{description}</p></div><Check size={22} aria-hidden="true" /></li></Reveal>)}</ol></div>
        </section>

        <section id="privacy" className="landing-privacy" aria-labelledby="privacy-title"><Reveal className="landing-privacy__card"><div className="landing-privacy__seal"><ShieldCheck size={38} strokeWidth={1.6} aria-hidden="true" /></div><div><p className="landing-section__eyebrow">카메라 앞에서도 안심할 수 있게</p><h2 id="privacy-title">원본 영상은<br />어디에도 남기지 않아요.</h2><p>카메라 프레임은 브라우저 안에서만 처리됩니다. Upright Now는 개인 기준 대비 변화만 다루며, 의료적인 판단을 하지 않습니다.</p></div></Reveal></section>

        <section className="landing-section landing-faq" aria-labelledby="faq-title"><Reveal><p className="landing-section__eyebrow">시작하기 전, 자주 묻는 것</p><h2 id="faq-title">가볍게 시작해도<br />알아둘 건 분명하게.</h2></Reveal><div className="landing-faq__list">{faq.map(([question, answer], index) => <Reveal key={question} delay={index * 85}><details><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details></Reveal>)}</div></section>

        <section className="landing-final" aria-labelledby="final-title"><Reveal><p className="landing-eyebrow"><Sparkles size={15} aria-hidden="true" /> 오늘의 집중을 위한 준비</p><h2 id="final-title">내가 편한 자세에서<br />오늘의 루틴을 시작해요.</h2><button type="button" className="landing-button landing-button--dark" onClick={begin}>내 기준 자세 만들기 <ArrowUpRight size={19} aria-hidden="true" /></button></Reveal></section>
      </main>
      <footer className="landing-footer"><span>© 2026 Upright Now</span><span>카메라 영상은 브라우저 안에서만 처리됩니다.</span></footer>
    </div>
  )
}
