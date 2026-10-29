import { createPrivateKey, createPublicKey, sign, verify, JsonWebKeyInput } from 'crypto'

const APPLE_ORIGIN = 'https://appleid.apple.com'

type AppleConfiguration = {
  clientId: string
  teamId: string
  keyId: string
  privateKey: string
}

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')

export async function revokeAppleTokens(
  authorizationCode: string,
  appleUserId: string,
  configuration: AppleConfiguration,
  request: typeof fetch = fetch,
  now = Math.floor(Date.now() / 1000)
): Promise<void> {
  const { clientId, teamId, keyId, privateKey } = configuration
  if (!clientId || !teamId || !keyId || !privateKey) {
    throw new Error('Apple revocation is not configured.')
  }
  const signingKey = createPrivateKey(privateKey)
  if (signingKey.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
    throw new Error('Apple revocation requires a P-256 key.')
  }
  const unsigned = `${encode({ alg: 'ES256', kid: keyId })}.${encode({
    iss: teamId,
    iat: now,
    exp: now + 300,
    aud: APPLE_ORIGIN,
    sub: clientId,
  })}`
  const signature = sign('sha256', Buffer.from(unsigned), {
    key: signingKey,
    dsaEncoding: 'ieee-p1363',
  }).toString('base64url')
  const clientSecret = `${unsigned}.${signature}`
  const post = (path: string, fields: Record<string, string>) =>
    request(`${APPLE_ORIGIN}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...fields }),
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
    })

  // Exchange the single-use code ourselves: never accept a client-supplied refresh token or UID.
  const response = await post('/auth/token', {
    code: authorizationCode,
    grant_type: 'authorization_code',
  })
  if (!response.ok) throw new Error('Apple authorization exchange failed.')
  const tokens = (await response.json()) as { refresh_token?: unknown; id_token?: unknown }
  if (
    typeof tokens.refresh_token !== 'string' ||
    !tokens.refresh_token ||
    typeof tokens.id_token !== 'string'
  ) {
    throw new Error('Apple authorization response is incomplete.')
  }

  const parts = tokens.id_token.split('.')
  if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) {
    throw new Error('Invalid Apple identity token.')
  }
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString())
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') {
    throw new Error('Invalid Apple signing algorithm.')
  }
  const keysResponse = await request(`${APPLE_ORIGIN}/auth/keys`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(10000),
  })
  if (!keysResponse.ok) throw new Error('Apple signing keys are unavailable.')
  const { keys } = (await keysResponse.json()) as {
    keys: (JsonWebKeyInput['key'] & { kid?: string; alg?: string; use?: string })[]
  }
  const key =
    Array.isArray(keys) &&
    keys.find(
      candidate =>
        candidate.kid === header.kid &&
        candidate.alg === 'RS256' &&
        candidate.kty === 'RSA' &&
        candidate.use === 'sig'
    )
  if (
    !key ||
    !verify(
      'RSA-SHA256',
      Buffer.from(`${parts[0]}.${parts[1]}`),
      createPublicKey({ key, format: 'jwk' }),
      Buffer.from(parts[2], 'base64url')
    )
  ) {
    throw new Error('Invalid Apple identity signature.')
  }
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
  if (
    claims.iss !== APPLE_ORIGIN ||
    claims.aud !== clientId ||
    claims.sub !== appleUserId ||
    !Number.isFinite(claims.exp) ||
    claims.exp <= now ||
    !Number.isFinite(claims.iat) ||
    claims.iat > now + 30 ||
    claims.iat < now - 300 ||
    (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > now + 30))
  ) {
    throw new Error('Apple identity does not match this account.')
  }

  const revoked = await post('/auth/revoke', {
    token: tokens.refresh_token,
    token_type_hint: 'refresh_token',
  })
  if (!revoked.ok) throw new Error('Apple revocation failed.')
}
