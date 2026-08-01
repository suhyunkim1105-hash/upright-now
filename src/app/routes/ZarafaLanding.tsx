import './zarafa-landing.css'

export function ZarafaLanding() {
  const hash = typeof window === 'undefined' ? '' : window.location.hash

  return (
    <iframe
      className="zarafa-landing-frame"
      title="Zarafa 랜딩"
      src={`/zarafa-legacy/index.html${hash}`}
    />
  )
}
