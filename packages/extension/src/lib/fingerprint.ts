/**
 * Device fingerprint generation for anonymous usage tracking
 *
 * Creates a stable fingerprint based on browser characteristics.
 * Not meant to be a bulletproof tracking mechanism, just a reasonable
 * way to track anonymous usage across sessions.
 */

const FINGERPRINT_STORAGE_KEY = 'groundcheck_device_fingerprint'

/**
 * Generate a SHA-256 hash of the input string
 */
async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate a device fingerprint from browser characteristics
 */
async function generateFingerprint(): Promise<string> {
  // Use optional chaining for screen/window properties as they may not be available in all contexts
  // In service workers, neither screen nor window is available
  let screenWidth = ''
  let screenHeight = ''
  let colorDepth = ''

  if (typeof screen !== 'undefined') {
    screenWidth = screen.width?.toString() || ''
    screenHeight = screen.height?.toString() || ''
    colorDepth = screen.colorDepth?.toString() || ''
  } else if (typeof window !== 'undefined') {
    screenWidth = window.innerWidth?.toString() || ''
    screenHeight = window.innerHeight?.toString() || ''
  }

  const components = [
    navigator.userAgent,
    navigator.language,
    screenWidth,
    screenHeight,
    colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.hardwareConcurrency?.toString() || '',
    navigator.platform || '',
  ]

  const data = components.join('|')
  return hashString(data)
}

/**
 * Get the stored fingerprint or generate a new one
 */
export async function getOrCreateFingerprint(): Promise<string> {
  try {
    // Try to get from chrome.storage.local first
    const result = await chrome.storage.local.get(FINGERPRINT_STORAGE_KEY)
    const storedFingerprint = result[FINGERPRINT_STORAGE_KEY] as string | undefined

    if (storedFingerprint && isValidFingerprint(storedFingerprint)) {
      return storedFingerprint
    }

    // Generate new fingerprint
    const newFingerprint = await generateFingerprint()

    // Store for future use
    await chrome.storage.local.set({ [FINGERPRINT_STORAGE_KEY]: newFingerprint })

    return newFingerprint
  } catch {
    // If storage fails, generate a new fingerprint each time
    // This is a fallback - usage won't persist but extension will still work
    return generateFingerprint()
  }
}

/**
 * Validate fingerprint format (64 char hex string)
 */
function isValidFingerprint(fingerprint: string): boolean {
  return /^[a-f0-9]{64}$/i.test(fingerprint)
}

/**
 * Get the stored fingerprint without generating a new one
 * Returns null if no fingerprint is stored
 */
export async function getStoredFingerprint(): Promise<string | null> {
  try {
    const result = await chrome.storage.local.get(FINGERPRINT_STORAGE_KEY)
    const fingerprint = result[FINGERPRINT_STORAGE_KEY] as string | undefined

    if (fingerprint && isValidFingerprint(fingerprint)) {
      return fingerprint
    }
    return null
  } catch {
    return null
  }
}
