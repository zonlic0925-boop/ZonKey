// Pure Local Cipher & Encoding toolkit

export function encodeBase64(str: string): string {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => {
      return String.fromCharCode(parseInt(p1, 16))
    })
  )
}

export function decodeBase64(str: string): string {
  return decodeURIComponent(
    Array.prototype.map
      .call(atob(str.trim()), (c: string) => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      })
      .join('')
  )
}

export function encodeHex(str: string): string {
  const bytes = new TextEncoder().encode(str)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function decodeHex(hexStr: string): string {
  const cleaned = hexStr.replace(/\s+/g, '')
  const bytes = new Uint8Array(cleaned.length / 2)
  for (let i = 0; i < cleaned.length; i += 2) {
    bytes[i / 2] = parseInt(cleaned.substring(i, i + 2), 16)
  }
  return new TextDecoder().decode(bytes)
}

export function parseJwt(token: string): { header: any; payload: any; signature: string } {
  const parts = token.trim().split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format (must have 3 parts separated by dots)')
  }
  const header = JSON.parse(decodeBase64(parts[0].replace(/-/g, '+').replace(/_/g, '/')))
  const payload = JSON.parse(decodeBase64(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
  return { header, payload, signature: parts[2] }
}

export async function encryptAesGcm(text: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    keyMaterial,
    enc.encode(text)
  )

  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), iv.length)

  return btoa(String.fromCharCode(...combined))
}

export async function decryptAesGcm(cipherBase64: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const raw = Uint8Array.from(atob(cipherBase64), (c) => c.charCodeAt(0))
  const iv = raw.slice(0, 12)
  const data = raw.slice(12)

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    keyMaterial,
    data
  )

  return new TextDecoder().decode(decrypted)
}
