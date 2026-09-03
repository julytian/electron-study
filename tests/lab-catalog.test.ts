import { describe, expect, it } from 'vitest'
import { labModules } from '../src/renderer/src/lab/catalog'
import { routeGroups } from '../src/shared/routes'

const labPaths = routeGroups.find((group) => group.key === 'lab')?.items.map((item) => item.path)

describe('lab catalog', () => {
  it('covers exactly the 12 lab routes from routeGroups', () => {
    expect(labPaths).toHaveLength(12)
    expect(labModules.map((module) => module.path)).toEqual(labPaths)
  })
})
