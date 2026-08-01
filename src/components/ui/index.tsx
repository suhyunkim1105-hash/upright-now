import { useId } from 'react'
import type {
  ButtonHTMLAttributes,
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
} from 'react'

/** 기본 UI 프리미티브 — docs/12_DESIGN_SYSTEM.md §10 */

type Variant = 'primary' | 'secondary' | 'ghost' | 'soft'
type Size = 'sm' | 'md' | 'lg'

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'campus-primary-bg text-white hover:brightness-105 shadow-card',
  secondary: 'bg-surface text-ink border border-line hover:bg-canvas',
  ghost: 'bg-transparent text-ink-soft hover:bg-surface',
  soft: 'bg-blue-soft text-ink hover:brightness-[0.98]',
}

const SIZE_CLASS: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-xl',
  md: 'h-11 px-5 text-[15px] rounded-2xl',
  lg: 'h-14 px-7 text-lg rounded-2xl',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={[
        'inline-flex items-center justify-center gap-2 font-semibold transition',
        'disabled:opacity-45 disabled:cursor-not-allowed',
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...rest}
    />
  )
}

type CardTone =
  | 'surface'
  | 'pink'
  | 'yellow'
  | 'blue'
  | 'green'
  | 'canvas'
  | 'coral'

const CARD_TONE: Record<CardTone, string> = {
  surface: 'bg-surface border-line',
  pink: 'campus-soft-bg border-transparent',
  /** bad 상태처럼 "가볍게 돌아와 볼까요?" 를 알릴 때만 씁니다. */
  coral: 'bg-[#FBDCDC] border-coral',
  yellow: 'bg-yellow-soft border-transparent',
  blue: 'bg-blue-soft border-transparent',
  green: 'bg-green-soft border-transparent',
  canvas: 'bg-canvas border-line',
}

interface CardProps {
  tone?: CardTone
  className?: string
  children: ReactNode
}

export function Card({ tone = 'surface', className = '', children }: CardProps) {
  return (
    <section
      className={[
        'rounded-card border p-6 shadow-card',
        CARD_TONE[tone],
        className,
      ].join(' ')}
    >
      {children}
    </section>
  )
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-lg font-bold text-ink">{children}</h2>
}

type BadgeTone = 'green' | 'yellow' | 'coral' | 'muted' | 'blue' | 'pink'

const BADGE_TONE: Record<BadgeTone, string> = {
  green: 'bg-green-soft text-green',
  yellow: 'bg-yellow-soft text-[#8a6b12]',
  coral: 'bg-pink-soft text-[#b8285a]',
  muted: 'bg-canvas text-muted border border-line',
  blue: 'bg-blue-soft text-[#2b52a8]',
  pink: 'campus-primary-bg text-white',
}

export function Badge({
  tone = 'muted',
  children,
  className = '',
}: {
  tone?: BadgeTone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold',
        BADGE_TONE[tone],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  )
}

export const PROGRESS_FILL: Record<'blue' | 'pink' | 'coral' | 'green', string> = {
  blue: 'var(--color-blue)',
  pink: 'var(--color-pink)',
  coral: 'var(--color-coral)',
  green: 'var(--color-green)',
}

/** 네이티브 <progress> 를 씁니다. (jsx-a11y/prefer-tag-over-role) */
export function Progress({
  value,
  tone = 'blue',
  label,
  thick = false,
}: {
  value: number
  tone?: 'blue' | 'pink' | 'coral' | 'green'
  label?: string
  thick?: boolean
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)

  return (
    <progress
      className={`un-progress ${thick ? 'un-progress--thick' : ''}`}
      style={{ '--un-fill': PROGRESS_FILL[tone] } as CSSProperties}
      max={100}
      value={pct}
      aria-label={label}
    >
      {`${pct}%`}
    </progress>
  )
}

export interface SegmentedOption {
  id: string
  label: string
  sublabel?: string
  /** 라벨 옆에 붙는 작은 칩 (예: 준비 중) */
  badge?: string
}

/**
 * 카드형 선택 컨트롤.
 * 겉모습은 카드지만 실제 요소는 네이티브 <input type="radio"> 입니다.
 * 키보드 좌우 이동과 그룹 탐색이 브라우저 기본 동작으로 동작합니다.
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
  columns = 1,
}: {
  options: SegmentedOption[]
  value: string
  onChange: (id: string) => void
  ariaLabel: string
  columns?: number
}) {
  const groupName = useId()

  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="sr-only">{ariaLabel}</legend>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {options.map((option) => {
          const selected = option.id === value
          return (
            <label
              key={option.id}
              className={[
                'un-radio-card block cursor-pointer rounded-2xl border px-4 py-3 text-left transition',
                selected
                  ? 'campus-selected-border campus-selected-ring bg-surface shadow-card ring-2'
                  : 'border-line bg-surface hover:bg-canvas',
              ].join(' ')}
            >
              <input
                type="radio"
                className="sr-only"
                name={groupName}
                value={option.id}
                checked={selected}
                onChange={() => onChange(option.id)}
              />
              <span className="flex items-center gap-1.5 text-[15px] font-bold text-ink">
                {option.label}
                {option.badge && (
                  <span className="rounded-full bg-canvas px-1.5 py-0.5 text-[10px] font-bold text-ink-soft">
                    {option.badge}
                  </span>
                )}
              </span>
              {option.sublabel && (
                <span className="block text-xs text-ink-soft">{option.sublabel}</span>
              )}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
}

export function TextField({ label, hint, id, ...rest }: TextFieldProps) {
  const inputId = id ?? `field-${label}`
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id={inputId}
        className="h-12 rounded-2xl border border-line bg-surface px-4 text-[15px] text-ink placeholder:text-muted"
        {...rest}
      />
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-line bg-surface/60 px-6 py-6 text-center">
      <p className="text-base font-bold text-ink">{title}</p>
      <p className="max-w-sm text-sm text-ink-soft">{description}</p>
      {action}
    </div>
  )
}

export function StatTile({
  label,
  value,
  unit,
  tone = 'surface',
}: {
  label: string
  value: string
  unit?: string
  tone?: CardTone
}) {
  return (
    <div
      className={[
        'rounded-2xl border px-4 py-3',
        CARD_TONE[tone],
      ].join(' ')}
    >
      <p className="text-xs font-semibold text-ink-soft">{label}</p>
      <p className="mt-1 text-xl font-bold text-ink tabular">
        {value}
        {unit && <span className="ml-1 text-sm font-semibold text-ink-soft">{unit}</span>}
      </p>
    </div>
  )
}
