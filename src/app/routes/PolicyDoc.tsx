import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import { getPolicy, POLICIES } from '@/content/policies'

/**
 * 정책·고지 공개 페이지 — 랜딩 푸터에서 연결됩니다.
 * 로그인·앱 셸 없이 누구나 볼 수 있는 정적 문서 화면입니다.
 */
export function PolicyDoc() {
  const { slug = '' } = useParams()
  const doc = getPolicy(slug)

  if (!doc) {
    return <Navigate to={ROUTES.landing} replace />
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto w-full max-w-[760px] px-5 py-10 sm:px-6 sm:py-14">
        <Link
          to={ROUTES.landing}
          className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition hover:text-ink"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          홈으로
        </Link>

        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{doc.eyebrow}</p>
        <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">{doc.title}</h1>
        <p className="mt-2 text-xs text-ink-soft">{doc.updated}</p>

        {doc.intro && <p className="mt-6 text-sm leading-relaxed text-ink-soft">{doc.intro}</p>}

        <div className="mt-8 flex flex-col gap-8">
          {doc.sections.map((section, i) => (
            <section key={section.heading ?? i}>
              {section.heading && <h2 className="text-lg font-semibold text-ink">{section.heading}</h2>}
              {section.paragraphs?.map((p, j) => (
                <p key={j} className="mt-3 text-sm leading-relaxed text-ink-soft">
                  {p}
                </p>
              ))}
              {section.list && (
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-soft">
                  {section.list.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              )}
              {section.table && (
                <div className="mt-3 overflow-x-auto rounded-xl border border-black/5">
                  <table className="w-full min-w-[420px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-black/5 bg-black/[0.02]">
                        {section.table.headers.map((h) => (
                          <th key={h} className="px-4 py-2.5 font-semibold text-ink">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.table.rows.map((row, ri) => (
                        <tr key={ri} className="border-b border-black/5 last:border-0">
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-4 py-2.5 align-top text-ink-soft">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {section.note && (
                <p className="mt-3 rounded-lg bg-black/[0.03] px-3 py-2.5 text-xs leading-relaxed text-ink-soft">
                  {section.note}
                </p>
              )}
            </section>
          ))}
        </div>

        <nav className="mt-14 border-t border-black/5 pt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">다른 정책·고지</p>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {POLICIES.filter((p) => p.slug !== doc.slug).map((p) => (
              <li key={p.slug}>
                <Link to={`/policies/${p.slug}`} className="text-ink-soft underline decoration-black/15 underline-offset-2 hover:text-ink">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  )
}
