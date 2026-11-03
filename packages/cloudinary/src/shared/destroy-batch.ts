import { assertConcurrency, runWithConcurrency } from './concurrency'

type DestroyFunction = (publicId: string) => Promise<void>

interface DestroyFailure {
	index: number
	reason: unknown
}

/**
 * Deletes multiple Cloudinary resources with limited concurrency.
 *
 * - Removes duplicate public IDs.
 * - Attempts every deletion, even if some fail.
 * - Throws the first failure according to the original input order.
 */
export async function destroyBatch(
	publicIds: readonly string[],
	concurrency: number,
	destroy: DestroyFunction
): Promise<void> {
	assertConcurrency(concurrency)

	const uniqueIds = [...new Set(publicIds)]

	const failures: DestroyFailure[] = []

	await runWithConcurrency(uniqueIds.length, concurrency, async (index) => {
		const publicId = uniqueIds[index]

		if (publicId === undefined) return

		try {
			await destroy(publicId)
		} catch (reason) {
			failures.push({ index, reason })
		}
	})

	if (failures.length === 0) return

	const firstFailure = failures.sort((a, b) => a.index - b.index)[0]

	if (firstFailure) {
		throw firstFailure.reason
	}
}
