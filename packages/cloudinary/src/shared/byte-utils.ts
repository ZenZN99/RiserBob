export const startsWith = (
	bytes: Uint8Array,
	signature: readonly number[],
	offset = 0
): boolean => signature.every((byte, index) => bytes[offset + index] === byte)
