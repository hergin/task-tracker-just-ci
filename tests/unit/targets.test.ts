import { describe, expect, it } from 'vitest'
import { resolveSeedProject } from '../../scripts/lib/targets'

describe('resolveSeedProject', () => {
  it('defaults to the local emulators', () => {
    expect(resolveSeedProject({})).toBe('demo-seed-app')
  })

  it('uses the demo project that firebase emulators:exec sets', () => {
    expect(resolveSeedProject({ emulatorProject: 'demo-other' })).toBe('demo-other')
  })

  it('prefers the project it is given', () => {
    expect(resolveSeedProject({ project: 'demo-given', emulatorProject: 'demo-other' })).toBe('demo-given')
  })

  it('refuses a real project', () => {
    expect(() => resolveSeedProject({ project: 'task-tracker-prod' })).toThrow(/Refusing/)
  })

  it('refuses a real project that only comes from the environment', () => {
    expect(() => resolveSeedProject({ emulatorProject: 'task-tracker-staging' })).toThrow(/Refusing/)
  })
})
