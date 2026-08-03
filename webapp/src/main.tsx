import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import App from './App';
import { keycloak } from './auth/keycloak';
import { configureStore } from './store/store';
import './index.css';

const store = configureStore();

async function bootstrap(): Promise<void> {
  if (keycloak.isEnabled()) {
    await keycloak.init();
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Provider store={store}>
        <App />
      </Provider>
    </StrictMode>,
  );
}

void bootstrap();
