export interface AuthConfig {
  enabled: boolean;
  url: string;
  realm: string;
  clientId: string;
  gatewayUrl: string;
  appGroup: string;
}

function str(value: string | undefined, fallback: string): string {
  return value && value.trim() !== '' ? value : fallback;
}

export const authConfig: AuthConfig = {
  enabled: (import.meta.env.VITE_AUTH_ENABLED ?? 'true') !== 'false',
  url: str(import.meta.env.VITE_KEYCLOAK_URL, 'http://localhost:8080'),
  realm: str(import.meta.env.VITE_KEYCLOAK_REALM, 'gateway'),
  clientId: str(import.meta.env.VITE_KEYCLOAK_CLIENT_ID, 'gateway'),
  gatewayUrl: str(import.meta.env.VITE_GATEWAY_URL, 'http://localhost:5173'),
  appGroup: str(import.meta.env.VITE_APP_GROUP, 'app-planning-espoir'),
};
