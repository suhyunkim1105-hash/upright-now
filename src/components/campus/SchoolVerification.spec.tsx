import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SchoolVerification } from './SchoolVerification'

describe('SchoolVerification', () => {
  it('explains that a school email is required before territory participation', () => {
    render(<SchoolVerification schoolId="snu" schoolName="서울대학교" />)
    expect(screen.getByText('학교 이메일 인증이 필요해요')).toBeVisible()
    expect(screen.getByLabelText('서울대학교 이메일')).toBeVisible()
  })
})
