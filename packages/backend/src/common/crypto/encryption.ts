import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_BYTES = 32;

let cachedKey: Buffer | null = null;

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'ENCRYPTION_KEY ist nicht gesetzt. Bitte 64 Hex-Zeichen (256 Bit) in der .env hinterlegen.',
    );
  }

  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex');
  } else if (raw.length === KEY_BYTES) {
    // Backwards-Compat: 32 ASCII-Zeichen werden als UTF-8-Bytes interpretiert.
    key = Buffer.from(raw, 'utf8');
  } else {
    throw new Error(
      `ENCRYPTION_KEY hat ungültiges Format. Erwartet: 64 Hex-Zeichen (empfohlen) oder 32 ASCII-Zeichen. Aktuell: ${raw.length} Zeichen.`,
    );
  }

  if (key.length !== KEY_BYTES) {
    throw new Error(`ENCRYPTION_KEY muss exakt ${KEY_BYTES} Bytes ergeben.`);
  }

  cachedKey = key;
  return key;
}

/** Verschlüsselt einen String. Ausgabeformat: base64(iv | tag | ciphertext). */
export function encrypt(plaintext: string): string {
  if (plaintext === '' || plaintext == null) {
    throw new Error('encrypt(): plaintext darf nicht leer sein.');
  }
  const key = loadKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

/** Entschlüsselt einen vorher per `encrypt()` erzeugten Wert. */
export function decrypt(payload: string): string {
  if (!payload) {
    throw new Error('decrypt(): payload darf nicht leer sein.');
  }
  const key = loadKey();
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error('decrypt(): payload zu kurz oder beschädigt.');
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/** True, wenn der Wert wie ein per encrypt() produzierter base64-Blob aussieht (>= 29 Bytes nach base64-Decode). */
export function isEncrypted(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const buf = Buffer.from(value, 'base64');
    return buf.length >= IV_LENGTH + TAG_LENGTH + 1 && /^[A-Za-z0-9+/=]+$/.test(value);
  } catch {
    return false;
  }
}

/** Test-Hook — nur in Tests verwenden. */
export function __resetKeyCacheForTests() {
  cachedKey = null;
}
