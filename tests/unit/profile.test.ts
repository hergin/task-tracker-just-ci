import { describe, expect, it } from 'vitest'
import { LIMITS } from '../../src/data/types'
import { profileFromAuthUser } from '../../src/lib/profile'

const account = { displayName: null, email: null, photoURL: null }

describe('profileFromAuthUser', () => {
  it('uses the display name and photo when present', () => {
    expect(
      profileFromAuthUser({ ...account, displayName: 'Ada Lovelace', photoURL: 'https://example.com/ada.png' }),
    ).toEqual({ name: 'Ada Lovelace', image: 'https://example.com/ada.png' })
  })

  it('falls back to the part of the email before the @', () => {
    expect(profileFromAuthUser({ ...account, displayName: '  ', email: 'ada@example.com' }).name).toBe('ada')
  })

  it('falls back to a placeholder when there is no name or email', () => {
    expect(profileFromAuthUser(account)).toEqual({ name: 'Unnamed user', image: null })
  })

  it('keeps the name and image within the limits the rules enforce', () => {
    const profile = profileFromAuthUser({
      ...account,
      displayName: 'x'.repeat(LIMITS.userName + 50),
      photoURL: `https://example.com/${'x'.repeat(LIMITS.userImage)}`,
    })
    expect(profile.name).toHaveLength(LIMITS.userName)
    expect(profile.image).toBeNull()
  })
})
