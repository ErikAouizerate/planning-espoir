import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('app entry', () => {
  it('mounts the app through the real main.tsx entry tree', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    await import('./main');
    expect(await screen.findByRole('heading', { name: 'Planning Espoir' })).toBeInTheDocument();
  });
});
