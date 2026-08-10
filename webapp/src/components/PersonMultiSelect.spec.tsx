import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Person } from '@planning-espoir/shared';
import { PersonMultiSelect } from './PersonMultiSelect';

const people: Person[] = [
  { name: 'BOB Dylan', role: 'R', colorIndex: 0, weeks: [] },
  { name: 'TAUZIN Caroline', role: 'R', colorIndex: 1, weeks: [] },
];

describe('PersonMultiSelect', () => {
  it('shows the selection count and calls onToggle with the clicked name', async () => {
    const onToggle = vi.fn();
    render(<PersonMultiSelect people={people} selected={['BOB Dylan']} onToggle={onToggle} />);

    expect(screen.getByRole('button', { name: 'Personnes (1)' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Personnes (1)' }));
    const checkbox = screen.getByRole('checkbox', { name: 'TAUZIN Caroline' });
    expect(checkbox).not.toBeChecked();
    await userEvent.click(checkbox);
    expect(onToggle).toHaveBeenCalledWith('TAUZIN Caroline');
  });
});
