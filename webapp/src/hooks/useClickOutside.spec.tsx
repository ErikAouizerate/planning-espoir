import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useClickOutside } from './useClickOutside';

function Host({ onOutside }: { onOutside: () => void }) {
  const ref = createRef<HTMLDivElement>();
  useClickOutside(ref, onOutside);
  return (
    <div>
      <div ref={ref} data-testid="inside">
        inside
      </div>
      <button data-testid="outside">outside</button>
    </div>
  );
}

describe('useClickOutside', () => {
  it('calls the handler when clicking outside the ref', async () => {
    const user = userEvent.setup();
    const onOutside = vi.fn();
    render(<Host onOutside={onOutside} />);
    await user.click(document.querySelector('[data-testid="outside"]')!);
    expect(onOutside).toHaveBeenCalledTimes(1);
  });

  it('does not call the handler when clicking inside the ref', async () => {
    const user = userEvent.setup();
    const onOutside = vi.fn();
    render(<Host onOutside={onOutside} />);
    await user.click(document.querySelector('[data-testid="inside"]')!);
    expect(onOutside).not.toHaveBeenCalled();
  });
});
