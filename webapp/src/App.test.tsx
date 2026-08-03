import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import App from './App';
import { configureStore } from './store/store';

describe('App', () => {
  it('renders the header title and initial loading state', () => {
    render(
      <Provider store={configureStore()}>
        <App />
      </Provider>,
    );
    expect(screen.getByRole('heading', { name: 'Planning Espoir' })).toBeInTheDocument();
  });
});
