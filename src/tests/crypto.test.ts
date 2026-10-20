import { describe, expect, it } from 'vitest'
import { decryptBackup, encryptBackup, isEncryptedBackup } from '@/lib/crypto'

const payload = new TextEncoder().encode('binhub encrypted payload')
const password = 'password123'

describe('backup encryption', () => {
  it('roundtrips encrypted bytes', async () => {
    const encrypted = await encryptBackup(payload, password)
    expect(isEncryptedBackup(encrypted)).toBe(true)
    expect(isEncryptedBackup(payload)).toBe(false)
    const decrypted = await decryptBackup(encrypted, password)
    expect(new TextDecoder().decode(decrypted)).toBe('binhub encrypted payload')
  })

  it('rejects a wrong password', async () => {
    const encrypted = await encryptBackup(payload, password)
    await expect(decryptBackup(encrypted, 'wrong-password')).rejects.toMatchObject({
      code: 'wrong-password',
    })
  })

  it('rejects tampered ciphertext', async () => {
    const encrypted = await encryptBackup(payload, password)
    const tampered = encrypted.slice()
    tampered[tampered.length - 1] = tampered[tampered.length - 1]! ^ 0xff
    await expect(decryptBackup(tampered, password)).rejects.toMatchObject({
      code: 'wrong-password',
    })
  })

  it('rejects a non encrypted input', async () => {
    await expect(decryptBackup(payload, password)).rejects.toMatchObject({
      code: 'invalid-file',
    })
  })

  it('requires a password', async () => {
    await expect(encryptBackup(payload, '')).rejects.toMatchObject({
      code: 'password-required',
    })
  })
})
