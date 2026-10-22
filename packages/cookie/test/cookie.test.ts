import { describe, expect, test } from 'bun:test'
import {
	CookieError,
	CookieManager,
	type CookieErrorCode,
	type CookieOptions
} from '../cookie'

const SECRET_A = 'a-very-long-secret-number-one-0123456789'
const SECRET_B = 'b-very-long-secret-number-two-0123456789'

const pairOf = (setCookie: string): string => setCookie.split(';')[0] as string

const only = (cookies: CookieManager): string => {
	const headers = cookies.getSetCookieHeaders()
	expect(headers).toHaveLength(1)
	return headers[0] as string
}

const expectCookieError = (fn: () => unknown, code: CookieErrorCode): void => {
	try {
		fn()
	} catch (error) {
		expect(error).toBeInstanceOf(CookieError)
		expect((error as CookieError).code).toBe(code)
		return
	}

	throw new Error(`Expected CookieError ${code} but nothing was thrown`)
}

describe('CookieManager', () => {
	describe('parsing', () => {
		test('should read cookies from the Cookie header', () => {
			const cookies = new CookieManager('theme=dark; lang=en')

			expect(cookies.get('theme')).toBe('dark')
			expect(cookies.has('lang')).toBe(true)
			expect(cookies.get('missing')).toBeUndefined()
			expect(cookies.has('missing')).toBe(false)
			expect(cookies.names()).toEqual(['theme', 'lang'])
			expect(cookies.getAll()).toEqual({ theme: 'dark', lang: 'en' })
		})

		test.each([null, undefined, ''])(
			'should handle an empty header: %p',
			(header) => {
				const cookies = new CookieManager(header)

				expect(cookies.getAll()).toEqual({})
				expect(cookies.headerRejected).toBe(false)
			}
		)

		test('should decode URI-encoded values', () => {
			const cookies = new CookieManager('name=Zen%20Academy')

			expect(cookies.get('name')).toBe('Zen Academy')
		})

		test('should never throw on malformed headers', () => {
			expect(
				() => new CookieManager('=; ;;; a; b==c; bad=%E0%A4%A')
			).not.toThrow()
		})

		test('should not expose Object.prototype members', () => {
			const cookies = new CookieManager('__proto__=x; constructor=y')

			expect(cookies.get('constructor')).toBe('y')
			expect(cookies.get('__proto__')).toBe('x')
			expect(cookies.get('toString')).toBeUndefined()
			expect(cookies.has('hasOwnProperty')).toBe(false)
			expect(({} as Record<string, unknown>).polluted).toBeUndefined()
		})

		test('should ignore an oversized Cookie header', () => {
			const cookies = new CookieManager('a=1', { maxHeaderBytes: 2 })

			expect(cookies.headerRejected).toBe(true)
			expect(cookies.getAll()).toEqual({})
		})

		test('should read cookies from a Request', () => {
			const request = new Request('https://example.com', {
				headers: { cookie: 'sid=abc' }
			})

			expect(CookieManager.fromRequest(request).get('sid')).toBe('abc')
		})
	})

	describe('set()', () => {
		test('should apply secure defaults', () => {
			const header = only(new CookieManager().set('sid', 'abc'))

			expect(header).toContain('sid=abc')
			expect(header).toContain('Path=/')
			expect(header).toContain('HttpOnly')
			expect(header).toContain('Secure')
			expect(header).toContain('SameSite=Lax')
		})

		test('should let options override the defaults', () => {
			const header = only(
				new CookieManager().set('sid', 'abc', {
					httpOnly: false,
					sameSite: 'strict',
					path: '/app'
				})
			)

			expect(header).not.toContain('HttpOnly')
			expect(header).toContain('SameSite=Strict')
			expect(header).toContain('Path=/app')
		})

		test('should ignore options that are explicitly undefined', () => {
			const header = only(
				new CookieManager().set('sid', 'abc', {
					secure: undefined
				} as unknown as CookieOptions)
			)

			expect(header).toContain('Secure')
		})

		test('should use manager-level defaults', () => {
			const cookies = new CookieManager(null, {
				defaults: { secure: false, sameSite: 'strict' }
			})
			const header = only(cookies.set('sid', 'abc'))

			expect(header).not.toContain('Secure')
			expect(header).toContain('SameSite=Strict')
		})

		test('should reject contradictory manager defaults immediately', () => {
			expectCookieError(
				() =>
					new CookieManager(null, {
						defaults: { sameSite: 'none', secure: false }
					}),
				'INVALID_OPTION'
			)
		})

		test('should round-trip special characters', () => {
			const original = 'a b;c=d,é"\\'
			const header = only(new CookieManager().set('v', original))
			const parsed = new CookieManager(pairOf(header))

			expect(parsed.get('v')).toBe(original)
		})

		test.each(['', 'a b', 'a;b', 'a=b', 'é', 'a\nb'])(
			'should reject the invalid name %p',
			(name) => {
				expectCookieError(
					() => new CookieManager().set(name, 'x'),
					'INVALID_NAME'
				)
			}
		)

		test('should reject non-string values', () => {
			expectCookieError(
				() => new CookieManager().set('a', 123 as unknown as string),
				'INVALID_VALUE'
			)
		})

		test.each([
			['path without slash', { path: 'x' }],
			['path with semicolon', { path: '/a;b' }],
			['domain with space', { domain: 'ex ample.com' }],
			['domain with scheme', { domain: 'https://example.com' }],
			['negative maxAge', { maxAge: -1 }],
			['fractional maxAge', { maxAge: 1.5 }],
			['NaN maxAge', { maxAge: Number.NaN }],
			['invalid expires', { expires: new Date('nope') }],
			['unknown priority', { priority: 'x' as never }],
			['unknown sameSite', { sameSite: 'x' as never }]
		])('should reject %s', (_label, options) => {
			expectCookieError(
				() => new CookieManager().set('a', '1', options),
				'INVALID_OPTION'
			)
		})

		test('should require Secure for SameSite=None and Partitioned', () => {
			expectCookieError(
				() =>
					new CookieManager().set('a', '1', {
						sameSite: 'none',
						secure: false
					}),
				'INVALID_OPTION'
			)
			expectCookieError(
				() =>
					new CookieManager().set('a', '1', {
						partitioned: true,
						secure: false
					}),
				'INVALID_OPTION'
			)

			const header = only(
				new CookieManager().set('a', '1', {
					sameSite: 'none',
					partitioned: true
				})
			)

			expect(header).toContain('SameSite=None')
			expect(header).toContain('Partitioned')
		})

		test('should enforce __Host- and __Secure- prefix rules', () => {
			expect(() =>
				new CookieManager().set('__Host-sid', '1')
			).not.toThrow()
			expect(() =>
				new CookieManager().set('__Secure-sid', '1')
			).not.toThrow()

			expectCookieError(
				() =>
					new CookieManager().set('__Host-sid', '1', {
						domain: 'example.com'
					}),
				'INVALID_OPTION'
			)
			expectCookieError(
				() =>
					new CookieManager().set('__Host-sid', '1', {
						path: '/app'
					}),
				'INVALID_OPTION'
			)
			expectCookieError(
				() =>
					new CookieManager().set('__Host-sid', '1', {
						secure: false
					}),
				'INVALID_OPTION'
			)
			expectCookieError(
				() =>
					new CookieManager().set('__Secure-sid', '1', {
						secure: false
					}),
				'INVALID_OPTION'
			)
		})

		test('should cap maxAge at 400 days', () => {
			const header = only(
				new CookieManager().set('a', '1', { maxAge: 10 ** 9 })
			)

			expect(header).toContain('Max-Age=34560000')
		})

		test('should cap expires at 400 days', () => {
			const farFuture = new Date(Date.now() + 10 * 365 * 24 * 3600 * 1000)
			const header = only(
				new CookieManager().set('a', '1', { expires: farFuture })
			)
			const expires = new Date(/Expires=([^;]+)/.exec(header)?.[1] ?? '')
			const limit = Date.now() + 400 * 24 * 3600 * 1000

			expect(expires.getTime()).toBeLessThanOrEqual(limit + 1000)
		})

		test('should reject cookies larger than 4096 bytes and keep state clean', () => {
			const cookies = new CookieManager()

			expectCookieError(
				() => cookies.set('big', 'x'.repeat(5000)),
				'COOKIE_TOO_LARGE'
			)
			expect(cookies.getSetCookieHeaders()).toEqual([])
			expect(cookies.has('big')).toBe(false)
		})

		test('should keep only the last write per name, domain and path', () => {
			const cookies = new CookieManager()
				.set('a', '1')
				.set('a', '2')
				.set('a', '3', { path: '/other' })

			expect(cookies.getSetCookieHeaders()).toHaveLength(2)
			expect(cookies.getSetCookieHeaders()[0]).toContain('a=2')
			expect(cookies.getSetCookieHeaders()[1]).toContain('a=3')
		})

		test('should reflect changes in get() and has()', () => {
			const cookies = new CookieManager('a=old')

			cookies.set('a', 'new').set('b', '1')
			expect(cookies.get('a')).toBe('new')
			expect(cookies.get('b')).toBe('1')

			cookies.set('b', '1', { maxAge: 0 })
			expect(cookies.has('b')).toBe(false)
		})

		test('should return a copy from getSetCookieHeaders()', () => {
			const cookies = new CookieManager().set('a', '1')

			cookies.getSetCookieHeaders().push('hacked=1')

			expect(cookies.getSetCookieHeaders()).toHaveLength(1)
		})
	})

	describe('delete()', () => {
		test('should emit an expired cookie and update the view', () => {
			const cookies = new CookieManager('sid=abc').delete('sid')
			const header = only(cookies)

			expect(header).toContain('sid=;')
			expect(header).toContain('Max-Age=0')
			expect(header).toContain('Expires=Thu, 01 Jan 1970')
			expect(cookies.has('sid')).toBe(false)
		})

		test('should mirror domain and path', () => {
			const header = only(
				new CookieManager().delete('sid', {
					domain: 'example.com',
					path: '/app'
				})
			)

			expect(header).toContain('Domain=example.com')
			expect(header).toContain('Path=/app')
		})

		test('should work for __Host- cookies', () => {
			expect(() => new CookieManager().delete('__Host-sid')).not.toThrow()
		})

		test('should replace a pending set for the same cookie', () => {
			const header = only(
				new CookieManager().set('sid', 'abc').delete('sid')
			)

			expect(header).toContain('Max-Age=0')
		})
	})

	describe('signed cookies', () => {
		const signedPair = (
			name: string,
			value: string,
			secrets = [SECRET_A]
		): string =>
			pairOf(
				only(
					new CookieManager(null, { secrets }).setSigned(name, value)
				)
			)

		test('should round-trip a signed value', () => {
			const verifier = new CookieManager(
				signedPair('session', 'user:42'),
				{
					secrets: [SECRET_A]
				}
			)

			expect(verifier.getSigned('session')).toBe('user:42')
		})

		test('should round-trip values that contain dots, spaces and empty strings', () => {
			for (const value of ['a.b.c', 'hello world', '']) {
				const verifier = new CookieManager(signedPair('s', value), {
					secrets: [SECRET_A]
				})

				expect(verifier.getSigned('s')).toBe(value)
			}
		})

		test('should reject a tampered value', () => {
			const pair = signedPair('session', 'user:42')
			// The colon is encoded by cookie@1 and left as-is by cookie@2.
			const tampered = pair.replace(/user(%3A|:)42/, 'user:1')
			const verifier = new CookieManager(tampered, {
				secrets: [SECRET_A]
			})

			expect(tampered).not.toBe(pair)
			expect(verifier.getSigned('session')).toBeUndefined()
		})

		test('should reject a tampered signature', () => {
			const pair = signedPair('session', 'user:42')
			const tampered = `${pair.slice(0, -1)}${pair.endsWith('A') ? 'B' : 'A'}`
			const verifier = new CookieManager(tampered, {
				secrets: [SECRET_A]
			})

			expect(verifier.getSigned('session')).toBeUndefined()
		})

		test('should reject a cookie copied under another name', () => {
			const value = signedPair('a', 'secret')
				.split('=')
				.slice(1)
				.join('=')
			const verifier = new CookieManager(`b=${value}`, {
				secrets: [SECRET_A]
			})

			expect(verifier.getSigned('b')).toBeUndefined()
		})

		test('should return undefined for missing or unsigned cookies', () => {
			const verifier = new CookieManager('plain=value', {
				secrets: [SECRET_A]
			})

			expect(verifier.getSigned('plain')).toBeUndefined()
			expect(verifier.getSigned('missing')).toBeUndefined()
		})

		test('should support secret rotation', () => {
			const pair = signedPair('session', 'user:42', [SECRET_A])

			expect(
				new CookieManager(pair, {
					secrets: [SECRET_B, SECRET_A]
				}).getSigned('session')
			).toBe('user:42')
			expect(
				new CookieManager(pair, { secrets: [SECRET_B] }).getSigned(
					'session'
				)
			).toBeUndefined()

			// New cookies are signed with the first secret.
			const rotated = signedPair('session', 'user:42', [
				SECRET_B,
				SECRET_A
			])

			expect(
				new CookieManager(rotated, { secrets: [SECRET_B] }).getSigned(
					'session'
				)
			).toBe('user:42')
		})

		test('should require a secret to sign but not to verify', () => {
			expectCookieError(
				() => new CookieManager().setSigned('a', '1'),
				'SECRETS_REQUIRED'
			)
			expect(new CookieManager('a=1.abc').getSigned('a')).toBeUndefined()
		})

		test('should reject weak secrets', () => {
			expectCookieError(
				() => new CookieManager(null, { secrets: ['short'] }),
				'WEAK_SECRET'
			)
		})

		test('should apply the same validation as set()', () => {
			const cookies = new CookieManager(null, { secrets: [SECRET_A] })

			expectCookieError(
				() => cookies.setSigned('bad name', '1'),
				'INVALID_NAME'
			)
			expectCookieError(
				() => cookies.setSigned('a', 5 as unknown as string),
				'INVALID_VALUE'
			)
		})
	})

	describe('applyTo()', () => {
		test('should append one Set-Cookie header per cookie', () => {
			const cookies = new CookieManager().set('a', '1').set('b', '2')
			const response = cookies.applyTo(new Response('ok'))

			expect(response.headers.getSetCookie()).toHaveLength(2)
		})

		test('should keep Set-Cookie headers that already exist', () => {
			const original = new Response('ok')

			original.headers.append('Set-Cookie', 'existing=1')

			const response = new CookieManager().set('a', '1').applyTo(original)

			expect(response.headers.getSetCookie()).toHaveLength(2)
		})

		test('should return the same response when nothing is pending', () => {
			const original = new Response('ok')

			expect(new CookieManager().applyTo(original)).toBe(original)
		})

		test('should handle responses with immutable headers', async () => {
			const redirect = Response.redirect('https://example.com/next', 302)
			const response = new CookieManager().set('a', '1').applyTo(redirect)

			expect(response.status).toBe(302)
			expect(response.headers.get('location')).toBe(
				'https://example.com/next'
			)
			expect(response.headers.getSetCookie()).toHaveLength(1)
		})
	})
})
