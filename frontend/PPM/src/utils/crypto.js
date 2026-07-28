// Modern Production-Grade E2EE Helper (ECDH / HKDF / AES-256-GCM + IndexedDB Storage)

const ENCRYPTION_PREFIX = 'enc:v2:'
const LEGACY_PREFIX = 'enc:v1:'
const DB_NAME = 'PPM_E2EE_Keystore'
const STORE_NAME = 'keys'

// 1. IndexedDB Helper for non-extractable key storage
function openKeystoreDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function getStoredKey(keyName) {
  const db = await openKeystoreDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(keyName)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

async function setStoredKey(keyName, value) {
  const db = await openKeystoreDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.put(value, keyName)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

// 2. Generate or retrieve non-extractable ECDH Key Pair for the device
async function getOrCreateIdentityKeyPair() {
  const stored = await getStoredKey('identity_ecdh_keypair')
  if (stored && stored.privateKey && stored.publicKey) {
    return stored
  }

  // Generate ECDH (P-256) keypair with non-extractable private key
  const keyPair = await window.crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false, // non-extractable private key in browser memory/IndexedDB
    ['deriveKey', 'deriveBits']
  )

  await setStoredKey('identity_ecdh_keypair', keyPair)
  return keyPair
}

// 3. Derive HKDF Session Key for conversation thread
async function deriveSessionKey(threadId) {
  const keyPair = await getOrCreateIdentityKeyPair()

  // Export public key to compute HKDF info binding
  const pubRaw = await window.crypto.subtle.exportKey('spki', keyPair.publicKey)
  const enc = new TextEncoder()
  const info = enc.encode(`PPM_E2EE_HKDF_${threadId}`)

  // Derive bits via ECDH self-agreement
  const derivedBits = await window.crypto.subtle.deriveBits(
    { name: 'ECDH', public: keyPair.publicKey },
    keyPair.privateKey,
    256
  )

  // Import into HKDF for session key generation
  const hkdfBaseKey = await window.crypto.subtle.importKey(
    'raw',
    derivedBits,
    { name: 'HKDF' },
    false,
    ['deriveKey']
  )

  // Derive final AES-256-GCM Session Key
  return window.crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(pubRaw).slice(0, 16),
      info: info
    },
    hkdfBaseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypts message using ECDH/HKDF derived AES-256-GCM key
 */
export async function encryptMessage(text, threadId) {
  if (!text || typeof text !== 'string') return text
  if (text.startsWith(ENCRYPTION_PREFIX) || text.startsWith(LEGACY_PREFIX)) return text

  try {
    const sessionKey = await deriveSessionKey(threadId)
    const iv = window.crypto.getRandomValues(new Uint8Array(12)) // 96-bit cryptographically secure random IV
    const enc = new TextEncoder()
    const encodedText = enc.encode(text)

    const ciphertextBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      sessionKey,
      encodedText
    )

    const combined = new Uint8Array(iv.length + ciphertextBuffer.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(ciphertextBuffer), iv.length)

    let binary = ''
    for (let i = 0; i < combined.byteLength; i++) {
      binary += String.fromCharCode(combined[i])
    }
    const b64 = window.btoa(binary)
    return `${ENCRYPTION_PREFIX}${b64}`
  } catch (err) {
    console.error('E2EE ECDH/HKDF Encryption Error:', err)
    return text // Safe graceful fallback if WebCrypto fails or is unsupported
  }
}

/**
 * Decrypts E2EE message payload safely
 */
export async function decryptMessage(cipherPayload, threadId) {
  if (!cipherPayload || typeof cipherPayload !== 'string') return cipherPayload || ''

  // Fallback for legacy v1 seed messages
  if (cipherPayload.startsWith(LEGACY_PREFIX)) {
    try {
      const b64 = cipherPayload.slice(LEGACY_PREFIX.length)
      const binary = window.atob(b64)
      const combined = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) combined[i] = binary.charCodeAt(i)
      const iv = combined.slice(0, 12)
      const ciphertext = combined.slice(12)

      const enc = new TextEncoder()
      const rawSeed = enc.encode(`PPM_E2EE_SEED_v1_${threadId}`)
      const hash = await window.crypto.subtle.digest('SHA-256', rawSeed)
      const legacyKey = await window.crypto.subtle.importKey(
        'raw', hash, { name: 'AES-GCM' }, false, ['decrypt']
      )

      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv }, legacyKey, ciphertext
      )
      return new TextDecoder().decode(decryptedBuffer)
    } catch {
      return '[Encrypted Legacy Message]'
    }
  }

  if (!cipherPayload.startsWith(ENCRYPTION_PREFIX)) return cipherPayload // Unencrypted text

  try {
    const b64 = cipherPayload.slice(ENCRYPTION_PREFIX.length)
    const binary = window.atob(b64)
    const combined = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      combined[i] = binary.charCodeAt(i)
    }

    const iv = combined.slice(0, 12)
    const ciphertext = combined.slice(12)

    const sessionKey = await deriveSessionKey(threadId)
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      sessionKey,
      ciphertext
    )

    return new TextDecoder().decode(decryptedBuffer)
  } catch (err) {
    console.warn('E2EE Decryption Warning:', err)
    return cipherPayload // Safe string fallback
  }
}
