import { HttpError } from '../errors/http-error'

/**
 * Checks whether a request uses JSON as its body format.
 */
export const isJsonContentType = (contentType: string | null): boolean => {
	if (!contentType) return false

	const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase()

	return (
		mediaType === 'application/json' ||
		(mediaType?.startsWith('application/') === true &&
			mediaType.endsWith('+json'))
	)
}

/**
 * Throws 415 when the request body is not declared as JSON.
 */
export const requireJsonContentType = (contentType: string | null): void => {
	if (!isJsonContentType(contentType)) {
		throw new HttpError(415, 'Unsupported Media Type')
	}
}

/**
 * Checks whether an Accept header permits a given response media type.
 *
 * Supports exact types, type wildcards,  and q= quality values.
 * A missing Accept header means any response type is acceptable.
 */
export const acceptsMediaType = (
	acceptHeader: string | null,
	responseType: string
): boolean => {
	if (!acceptHeader || !acceptHeader.trim()) return true

	const [targetType, targetSubtype] = responseType.toLowerCase().split('/')

	if (!targetType || !targetSubtype) return false

	const ranges = acceptHeader.split(',').map((item) => {
		const [rawType, ...parameters] = item.trim().toLowerCase().split(';')
		const [type, subtype] = (rawType ?? '').trim().split('/')

		const qualityParameter = parameters.find((parameter) =>
			parameter.trim().startsWith('q=')
		)

		const quality = qualityParameter
			? Number(qualityParameter.trim().slice(2))
			: 1

		return {
			type,
			subtype,
			quality:
				Number.isFinite(quality) && quality >= 0 && quality <= 1
					? quality
					: 0
		}
	})

	// Prefer the most specific matching media range.
	const matchingRanges = ranges
		.filter(
			({ type, subtype }) =>
				(type === targetType || type === '*') &&
				(subtype === targetSubtype || subtype === '*')
		)
		.sort((a, b) => {
			const specificity = (range: typeof a) =>
				Number(range.type !== '*') + Number(range.subtype !== '*')

			return specificity(b) - specificity(a)
		})

	return (matchingRanges[0]?.quality ?? 0) > 0
}

/**
 * Throws 406 when the client does not accept the response media type.
 */
export const requireAccepts = (
	acceptHeader: string | null,
	responseType: string
): void => {
	if (!acceptsMediaType(acceptHeader, responseType)) {
		throw new HttpError(406, 'Not Acceptable')
	}
}
