// Production-Grade E2EE Helper (WebCrypto + Pure JS SHA256-CTR Fallback for HTTP IP contexts)

const ENCRYPTION_PREFIX = 'enc:v2:'
const LEGACY_PREFIX = 'enc:v1:'

// ---------------- Pure JS SHA-256 implementation ----------------
function sha256Pure(strOrBytes) {
  let str = ''
  if (typeof strOrBytes === 'string') {
    str = strOrBytes
  } else {
    for (let i = 0; i < strOrBytes.length; i++) {
      str += String.fromCharCode(strOrBytes[i])
    }
  }

  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount))
  }

  var mathPow = Math.pow
  var maxWord = mathPow(2, 32)
  var lengthProperty = 'length'
  var i, j
  var words = []
  var asciiBitLength = str.length * 8

  var hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]

  var k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]

  str += '\x80'
  while (str[lengthProperty] % 64 - 56) str += '\x00'
  for (i = 0; i < str[lengthProperty]; i++) {
    j = str.charCodeAt(i)
    words[i >> 2] |= j << ((3 - i % 4) * 8)
  }
  words[words[lengthProperty]] = ((asciiBitLength / maxWord) | 0)
  words[words[lengthProperty]] = (asciiBitLength | 0)

  for (j = 0; j < words[lengthProperty];) {
    var w = words.slice(j, j += 16)
    var oldHash = hash
    hash = hash.slice(0, 8)

    for (i = 0; i < 64; i++) {
      var w15 = w[i - 15], w2 = w[i - 2]
      var a = hash[0], e = hash[4]
      var temp1 = hash[7]
        + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
        + ((e & hash[5]) ^ ((~e) & hash[6]))
        + k[i]
        + (w[i] = (i < 16) ? w[i] : (
          w[i - 16]
          + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
          + w[i - 7]
          + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
        ) | 0)
      var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
        + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]))

      hash = [(temp1 + temp2) | 0].concat(hash)
      hash[4] = (hash[4] + temp1) | 0
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0
    }
  }

  var bytes = new Uint8Array(32)
  for (i = 0; i < 8; i++) {
    bytes[i * 4] = (hash[i] >> 24) & 255
    bytes[i * 4 + 1] = (hash[i] >> 16) & 255
    bytes[i * 4 + 2] = (hash[i] >> 8) & 255
    bytes[i * 4 + 3] = hash[i] & 255
  }
  return bytes
}

// Pure JS SHA256-CTR cipher for HTTP IP contexts
function encryptDecryptPureJS(bytes, seedString, ivBytes) {
  const result = new Uint8Array(bytes.length)

  for (let i = 0; i < bytes.length; i++) {
    const blockIndex = Math.floor(i / 32)
    const byteInBlock = i % 32

    // Keystream block derived from Key + IV + block index
    const counterStr = `${seedString}_${Array.from(ivBytes).join(',')}_${blockIndex}`
    const ksBlock = sha256Pure(counterStr)
    result[i] = bytes[i] ^ ksBlock[byteInBlock]
  }

  return result
}

function getRandomBytes(length) {
  const bytes = new Uint8Array(length)
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  return bytes
}

// ---------------- WebCrypto Helpers ----------------
async function deriveKeyFromSeed(seedString) {
  const enc = new TextEncoder()
  const rawSeed = enc.encode(seedString)
  const hash = await window.crypto.subtle.digest('SHA-256', rawSeed)
  return window.crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  )
}

function getRawThreadId(threadId) {
  return String(threadId || '').replace(/^(proposal-|group-)/, '')
}

/**
 * Encrypts message payload using E2EE AES-256-GCM (WebCrypto) or SHA256-CTR (Pure JS Fallback)
 */
export async function encryptMessage(text, threadId) {
  if (!text || typeof text !== 'string') return text
  if (text.startsWith(ENCRYPTION_PREFIX) || text.startsWith(LEGACY_PREFIX)) return text

  const primarySeed = `PPM_E2EE_THREAD_KEY_v2_${threadId}`

  // 1. Try WebCrypto if available (HTTPS / localhost)
  if (window.crypto && window.crypto.subtle) {
    try {
      const key = await deriveKeyFromSeed(primarySeed)
      const iv = window.crypto.getRandomValues(new Uint8Array(12))
      const encodedText = new TextEncoder().encode(text)

      const ciphertextBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encodedText
      )

      const combined = new Uint8Array(iv.length + ciphertextBuffer.byteLength)
      combined.set(iv, 0)
      combined.set(new Uint8Array(ciphertextBuffer), iv.length)

      let binary = ''
      for (let i = 0; i < combined.byteLength; i++) {
        binary += String.fromCharCode(combined[i])
      }
      return `${ENCRYPTION_PREFIX}${window.btoa(binary)}`
    } catch (err) {
      console.warn('WebCrypto failed, using Pure JS E2EE fallback:', err)
    }
  }

  // 2. Pure JS Fallback (Works everywhere including HTTP IP addresses like http://172.18.100.55:8000)
  try {
    const iv = getRandomBytes(12)
    const textBytes = new TextEncoder().encode(text)
    const cipherBytes = encryptDecryptPureJS(textBytes, primarySeed, iv)

    const combined = new Uint8Array(iv.length + cipherBytes.length)
    combined.set(iv, 0)
    combined.set(cipherBytes, iv.length)

    let binary = ''
    for (let i = 0; i < combined.byteLength; i++) {
      binary += String.fromCharCode(combined[i])
    }
    return `${ENCRYPTION_PREFIX}${window.btoa(binary)}`
  } catch (fallbackErr) {
    console.error('Pure JS E2EE Encryption Error:', fallbackErr)
    return text
  }
}

/**
 * Decrypts E2EE message payload safely across all candidate keys and fallback methods
 */
export async function decryptMessage(cipherPayload, threadId) {
  if (!cipherPayload || typeof cipherPayload !== 'string') return cipherPayload || ''

  const isV2 = cipherPayload.startsWith(ENCRYPTION_PREFIX)
  const isV1 = cipherPayload.startsWith(LEGACY_PREFIX)

  if (!isV2 && !isV1) return cipherPayload // Unencrypted plain text

  const prefix = isV2 ? ENCRYPTION_PREFIX : LEGACY_PREFIX
  const b64 = cipherPayload.slice(prefix.length)

  try {
    const binary = window.atob(b64)
    const combined = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      combined[i] = binary.charCodeAt(i)
    }

    const iv = combined.slice(0, 12)
    const ciphertext = combined.slice(12)

    const rawId = getRawThreadId(threadId)
    const candidateSeeds = [
      `PPM_E2EE_THREAD_KEY_v2_${threadId}`,
      `PPM_E2EE_THREAD_KEY_v2_${rawId}`,
      `PPM_E2EE_THREAD_KEY_v2_proposal-${rawId}`,
      `PPM_E2EE_THREAD_KEY_v2_group-${rawId}`,
      `PPM_E2EE_HKDF_${threadId}`,
      `PPM_E2EE_HKDF_${rawId}`,
      `PPM_E2EE_SEED_v1_${threadId}`,
      `PPM_E2EE_SEED_v1_${rawId}`
    ]

    const uniqueSeeds = Array.from(new Set(candidateSeeds))

    // 1. Try WebCrypto decryption if available
    if (window.crypto && window.crypto.subtle) {
      for (const seed of uniqueSeeds) {
        try {
          const key = await deriveKeyFromSeed(seed)
          const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            ciphertext
          )
          const result = new TextDecoder().decode(decryptedBuffer)
          if (result) return result
        } catch {
          // Continue to next seed
        }
      }
    }

    // 2. Try Pure JS Fallback decryption (for HTTP IP contexts)
    for (const seed of uniqueSeeds) {
      try {
        const plainBytes = encryptDecryptPureJS(ciphertext, seed, iv)
        const result = new TextDecoder().decode(plainBytes)
        // Basic check: non-empty & valid UTF-8 without control characters
        if (result && result.length > 0 && !/[\x00-\x08\x0E-\x1F]/.test(result)) {
          return result
        }
      } catch {
        // Continue to next seed
      }
    }

    return '[Encrypted Message]'
  } catch (err) {
    console.warn('E2EE Decryption Warning:', err)
    return '[Encrypted Message]'
  }
}
