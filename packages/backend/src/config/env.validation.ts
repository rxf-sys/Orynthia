import { Logger } from '@nestjs/common';

const logger = new Logger('EnvValidation');

const REQUIRED_VARS = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'ENCRYPTION_KEY'] as const;
const MIN_SECRET_LENGTH = 32;

/**
 * Validiert Pflicht-Umgebungsvariablen beim Bootstrap, damit Fehlkonfiguration
 * sofort mit einer klaren Meldung scheitert statt erst zur Laufzeit
 * (Passport-Init, erste Verschlüsselung) mit kryptischen Fehlern.
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const errors: string[] = [];

  for (const key of REQUIRED_VARS) {
    const value = config[key];
    if (typeof value !== 'string' || value.trim().length === 0) {
      errors.push(`${key} ist nicht gesetzt.`);
    }
  }

  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET'] as const) {
    const value = config[key];
    if (typeof value === 'string' && value.length > 0 && value.length < MIN_SECRET_LENGTH) {
      errors.push(`${key} muss mindestens ${MIN_SECRET_LENGTH} Zeichen lang sein (aktuell ${value.length}).`);
    }
  }

  const frontendUrl = config['FRONTEND_URL'];
  if (typeof frontendUrl === 'string' && frontendUrl.length > 0) {
    try {
      new URL(frontendUrl);
    } catch {
      errors.push(`FRONTEND_URL ist keine gültige URL: "${frontendUrl}"`);
    }
  }

  if (errors.length > 0) {
    for (const err of errors) logger.error(err);
    throw new Error(
      `Ungültige Umgebungskonfiguration:\n- ${errors.join('\n- ')}\nSiehe .env.example für das erwartete Format.`,
    );
  }

  return config;
}
