import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ResultsScreen } from '../ResultsScreen'
import { MOCK_DAG_DATA } from '../../mockData'
import type { DAGData } from '../../types'

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    aside: ({ children, ...props }: any) => <aside {...props}>{children}</aside>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

vi.mock('../TimelineView', () => ({
  TimelineView: () => <div data-testid="timeline-view">Timeline</div>,
}))

vi.mock('../NarrativeView', () => ({
  NarrativeView: () => <div data-testid="narrative-view">Narrative Content</div>,
}))

vi.mock('../BrowseView', () => ({
  BrowseView: () => <div data-testid="browse-view">Browse Content</div>,
}))

const mockData: DAGData = MOCK_DAG_DATA as DAGData

describe('ResultsScreen', () => {
  const mockOnReset = vi.fn()

  it('renders the header with target event name', () => {
    render(<ResultsScreen data={mockData} onReset={mockOnReset} />)
    expect(screen.getByText('Fall of the Berlin Wall')).toBeInTheDocument()
  })

  it('shows analysis complete badge', () => {
    render(<ResultsScreen data={mockData} onReset={mockOnReset} />)
    expect(screen.getByText('Analysis Complete')).toBeInTheDocument()
  })

  it('renders browse view by default', () => {
    render(<ResultsScreen data={mockData} onReset={mockOnReset} />)
    expect(screen.getByTestId('browse-view')).toBeInTheDocument()
  })

  it('has tab buttons for browse and narrative', () => {
    render(<ResultsScreen data={mockData} onReset={mockOnReset} />)
    const header = screen.getByRole('banner')
    expect(within(header).getByText('Browse')).toBeInTheDocument()
    expect(within(header).getByText('Narrative')).toBeInTheDocument()
  })

  it('switches to narrative tab', async () => {
    render(<ResultsScreen data={mockData} onReset={mockOnReset} />)
    const header = screen.getByRole('banner')
    await userEvent.click(within(header).getByText('Narrative'))
    await waitFor(() => {
      expect(screen.getByTestId('narrative-view')).toBeInTheDocument()
    })
  })

  it('calls onReset when New Query button is clicked', async () => {
    render(<ResultsScreen data={mockData} onReset={mockOnReset} />)
    const header = screen.getByRole('banner')
    await userEvent.click(within(header).getByText('New Query'))
    expect(mockOnReset).toHaveBeenCalled()
  })
})
