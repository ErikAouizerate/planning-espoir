import Keycloak from 'keycloak-js';
import { authConfig } from './config';
import { MOCK_USERNAME } from './username';

export interface KeycloakApi {
  init(): Promise<void>;
  isEnabled(): boolean;
  getToken(): string | null;
  getUsername(): string;
  signout(): void;
}

function createDisabled(): KeycloakApi {
  return {
    async init() {
      // no-op in mock mode
    },
    isEnabled: () => false,
    getToken: () => null,
    getUsername: () => MOCK_USERNAME,
    signout: () => {
      // no-op in mock mode
    },
  };
}

function createEnabled(): KeycloakApi {
  const keycloak = new Keycloak({
    url: authConfig.url,
    realm: authConfig.realm,
    clientId: authConfig.clientId,
  });
  return {
    async init() {
      await keycloak.init({ onLoad: 'login-required' });
    },
    isEnabled: () => true,
    getToken: () => keycloak.token ?? null,
    getUsername: () => keycloak.tokenParsed?.preferred_username ?? MOCK_USERNAME,
    signout: () => {
      void keycloak.logout({ redirectUri: window.location.origin });
    },
  };
}

export const keycloak: KeycloakApi = authConfig.enabled ? createEnabled() : createDisabled();
