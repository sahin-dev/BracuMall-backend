const DEFAULT_CORS_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

// Read directly from process.env (not ConfigService) so this can also be
// called from a @WebSocketGateway decorator, which is evaluated at class
// definition time — before Nest's DI container exists to inject a service
// into. dotenv has already populated process.env by then either way.
export function getCorsOrigins(): string[] {
  const configured = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return configured.length ? configured : DEFAULT_CORS_ORIGINS;
}
