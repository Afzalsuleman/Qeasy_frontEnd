/**
 * JWT token utilities
 */

export interface DecodedToken {
  role?: string;
  userId?: string;
  email?: string;
  name?: string;
  [key: string]: unknown;
}

/**
 * Decode JWT token (without verification)
 * Note: This only decodes the token, it doesn't verify the signature
 */
export function decodeJWT(token: string): DecodedToken | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return decoded as DecodedToken;
  } catch (error) {
    console.error("Error decoding JWT:", error);
    return null;
  }
}

