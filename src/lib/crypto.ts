const MAGIC = new Uint8Array([66, 73, 78, 72, 85, 66, 48, 49]) // BINHUB01
const FORMAT_VERSION = 1
const ITERATIONS = 310_000
const SALT_LENGTH = 16
const IV_LENGTH = 12
const TAG_LENGTH = 16

export const MIN_BACKUP_PASSWORD_LENGTH = 8

export type BackupCryptoErrorCode =
  | 'crypto-unavailable'
  | 'password-required'
  | 'invalid-file'
  | 'wrong-password'

export class BackupCryptoError extends Error {
  code: BackupCryptoErrorCode

  constructor(code: BackupCryptoErrorCode, message: string) {
    super(message)
    this.name = 'BackupCryptoError'
    this.code = code
  }
}

function getSubtle(): SubtleCrypto {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new BackupCryptoError(
      'crypto-unavailable',
      'La crittografia non è disponibile in questo contesto.',
    )
  }
  return crypto.subtle
}

function toBytes(value: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(value.byteLength)
  copy.set(value)
  return copy
}

function deriveKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
  usage: 'encrypt' | 'decrypt',
): Promise<CryptoKey> {
  const subtle = getSubtle()
  return subtle
    .importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
    .then((baseKey) =>
      subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        [usage],
      ),
    )
}

export function isEncryptedBackup(bytes: Uint8Array): boolean {
  if (bytes.length < MAGIC.length) return false
  return MAGIC.every((value, index) => bytes[index] === value)
}

export async function isEncryptedBackupFile(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, MAGIC.length).arrayBuffer())
  return isEncryptedBackup(head)
}

export async function encryptBackup(zip: Uint8Array, password: string): Promise<Uint8Array> {
  if (!password) {
    throw new BackupCryptoError('password-required', 'La password è obbligatoria.')
  }
  const subtle = getSubtle()
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))

  const header = new Uint8Array(14 + SALT_LENGTH + IV_LENGTH)
  header.set(MAGIC, 0)
  header[8] = FORMAT_VERSION
  new DataView(header.buffer).setUint32(9, ITERATIONS, false)
  header[13] = SALT_LENGTH
  header.set(salt, 14)
  header.set(iv, 14 + SALT_LENGTH)

  const key = await deriveKey(password, salt, ITERATIONS, 'encrypt')
  const ciphertext = new Uint8Array(
    await subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: header, tagLength: TAG_LENGTH * 8 },
      key,
      toBytes(zip),
    ),
  )

  const output = new Uint8Array(header.length + ciphertext.length)
  output.set(header, 0)
  output.set(ciphertext, header.length)
  return output
}

export async function decryptBackup(container: Uint8Array, password: string): Promise<Uint8Array> {
  if (!password) {
    throw new BackupCryptoError('password-required', 'La password è obbligatoria.')
  }
  if (!isEncryptedBackup(container)) {
    throw new BackupCryptoError('invalid-file', 'Il file non è un backup BinHub cifrato.')
  }
  if (container.length < 14 + 8 + IV_LENGTH + TAG_LENGTH) {
    throw new BackupCryptoError('invalid-file', 'Il file cifrato è incompleto.')
  }

  const view = new DataView(container.buffer, container.byteOffset, container.byteLength)
  const version = container[8]
  if (version !== FORMAT_VERSION) {
    throw new BackupCryptoError('invalid-file', 'Versione del backup cifrato non supportata.')
  }
  const iterations = view.getUint32(9, false)
  if (iterations < 10_000 || iterations > 2_000_000) {
    throw new BackupCryptoError('invalid-file', 'Parametri di derivazione non validi.')
  }
  const saltLength = container[13] ?? 0
  if (saltLength < 8 || saltLength > 64) {
    throw new BackupCryptoError('invalid-file', 'Salt del backup non valido.')
  }

  const saltStart = 14
  const ivStart = saltStart + saltLength
  if (container.length < ivStart + IV_LENGTH + TAG_LENGTH) {
    throw new BackupCryptoError('invalid-file', 'Il file cifrato è incompleto.')
  }
  const salt = toBytes(container.slice(saltStart, ivStart))
  const iv = toBytes(container.slice(ivStart, ivStart + IV_LENGTH))
  const header = toBytes(container.slice(0, ivStart + IV_LENGTH))
  const ciphertext = toBytes(container.slice(ivStart + IV_LENGTH))

  const subtle = getSubtle()
  const key = await deriveKey(password, salt, iterations, 'decrypt')
  try {
    const plain = await subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: header, tagLength: TAG_LENGTH * 8 },
      key,
      ciphertext,
    )
    return new Uint8Array(plain)
  } catch {
    throw new BackupCryptoError('wrong-password', 'Password errata o file danneggiato.')
  }
}
