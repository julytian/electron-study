import { describe, expect, it } from 'vitest'
import { labModules } from '../src/renderer/src/lab/catalog'
import { routeGroups } from '../src/shared/routes'

const labPaths = routeGroups.find((group) => group.key === 'lab')?.items.map((item) => item.path)

describe('lab catalog', () => {
  it('covers exactly the 12 lab routes from routeGroups', () => {
    expect(labPaths).toHaveLength(12)
    expect(labModules.map((module) => module.path)).toEqual(labPaths)
  })

  it('lists app-info and security-status on the security module', () => {
    const security = labModules.find((module) => module.path === '/lab/security')
    expect(security?.actions.map((action) => action.id)).toEqual(['app-info', 'security-status'])
  })

  it('lists refresh and recent-gone on the metrics module', () => {
    const metrics = labModules.find((module) => module.path === '/lab/metrics')
    expect(metrics?.actions.map((action) => action.id)).toEqual(['refresh', 'recent-gone'])
  })
})
