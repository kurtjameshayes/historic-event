import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AboutScreen } from '../AboutScreen'

describe('AboutScreen', () => {
  const mockOnBack = vi.fn()

  it('renders the title', () => {
    render(<AboutScreen onBack={mockOnBack} />)
    expect(screen.getByText(/About Historical Causal Timeline Agent/)).toBeInTheDocument()
  })

  it('renders the description', () => {
    render(<AboutScreen onBack={mockOnBack} />)
    expect(screen.getByText(/autonomous AI system/i)).toBeInTheDocument()
  })

  it('renders how it works section', () => {
    render(<AboutScreen onBack={mockOnBack} />)
    expect(screen.getByText('How it works')).toBeInTheDocument()
  })

  it('renders features section', () => {
    render(<AboutScreen onBack={mockOnBack} />)
    expect(screen.getByText('Features')).toBeInTheDocument()
  })

  it('has a back button that calls onBack', async () => {
    render(<AboutScreen onBack={mockOnBack} />)
    await userEvent.click(screen.getByText('Back'))
    expect(mockOnBack).toHaveBeenCalled()
  })

  it('lists key features', () => {
    render(<AboutScreen onBack={mockOnBack} />)
    expect(screen.getByText(/Multi-threaded causal timelines/)).toBeInTheDocument()
    expect(screen.getByText(/Source citations and confidence scores/)).toBeInTheDocument()
    expect(screen.getByText(/Session history/)).toBeInTheDocument()
  })
})
