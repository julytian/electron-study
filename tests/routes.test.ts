import { describe, expect, it } from 'vitest'
import { routeGroups } from '../src/shared/routes'

describe('routeGroups', () => {
  it('has five sidebar groups', () => {
    expect(routeGroups.map((g) => g.key)).toEqual([
      'workbench',
      'windows',
      'browser',
      'lab',
      'settings'
    ])
  })

  it('includes note and lab advanced routes', () => {
    const paths = routeGroups.flatMap((g) => g.items.map((i) => i.path))
    expect(paths).toContain('/workbench/notes')
    expect(paths).toContain('/lab/advanced')
  })

  it('keeps MessagePort child routes out of the sidebar', () => {
    const paths = routeGroups.flatMap((g) => g.items.map((i) => i.path))
    expect(paths).toContain('/windows/ports')
    expect(paths).not.toContain('/ports/left')
    expect(paths).not.toContain('/ports/right')
  })
})
