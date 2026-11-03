import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MedicineCapsule } from '../components/medicines/MedicineCapsule';

describe('MedicineCapsule component', () => {
  it('renders the SVG capsule with proper accessible label and numbers', () => {
    render(<MedicineCapsule dosesTaken={0} totalDoses={6} remainingDoses={6} />);
    
    // Check accessible label
    const svg = screen.getByRole('img');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-label', 'Medicine Tracker Capsule: 0 doses taken out of 6 planned');

    // Check SVG text elements for numbers
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('updates numbers dynamically when props change', () => {
    const { rerender } = render(<MedicineCapsule dosesTaken={2} totalDoses={5} />);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();

    rerender(<MedicineCapsule dosesTaken={4} totalDoses={5} />);
    expect(screen.getByText('4')).toBeInTheDocument();
  });
});

