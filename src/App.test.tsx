import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App.tsx'
import { Harness } from './test/storeHarness.ts'

describe('首页', () => {
  it('显示标题「美食剪刀布」', () => {
    const h = new Harness()
    render(<App store={h.store()} env="OK" />)
    expect(screen.getByRole('heading', { level: 1, name: '美食剪刀布' })).toBeInTheDocument()
  })
})
