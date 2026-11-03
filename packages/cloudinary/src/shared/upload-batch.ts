import { HttpError } from 'riser-bob'
import { assertConcurrency, runWithConcurrency } from './concurrency'

interface BatchFailure {
	index: number
	reason: unknown
}

type UploadValidator = (file: Blob) => Promise<unknown>

type UploadFunction<TItem> = (file: Blob) => Promise<TItem>

type DestroyFunction = (publicId: string) => Promise<void>

/**
 * Validates and uploads multiple files with limited concurrency.
 *
 * - Validates all files before starting uploads.
 * - Stops scheduling new uploads after the first failure.
 * - Waits for already running uploads to finish.
 * - Removes successfully uploaded resources if an upload fails.
 * - Preserves the original input order.
 */
export async function uploadBatch<TItem extends { publicId: string }>(
	files: readonly Blob[],
	concurrency: number,
	validate: UploadValidator,
	upload: UploadFunction<TItem>,
	destroy: DestroyFunction
): Promise<TItem[]> {
	assertConcurrency(concurrency)

	if (files.length === 0) {
		throw new HttpError(400, 'At least one file is required')
	}

	// Reject sparse arrays and missing file entries.
	for (let index = 0; index < files.length; index++) {
		if (!(index in files) || files[index] == null) {
			throw new HttpError(400, 'Invalid file entry in upload batch')
		}
	}

	// Validate all files before starting uploads.
	const validationFailures: BatchFailure[] = []

	await runWithConcurrency(files.length, concurrency, async (index) => {
		const file = files[index]

		if (!file) return

		try {
			await validate(file)
		} catch (reason) {
			validationFailures.push({ index, reason })
		}
	})

	if (validationFailures.length > 0) {
		validationFailures.sort((a, b) => a.index - b.index)

		const firstFailure = validationFailures[0]

		if (firstFailure) {
			throw firstFailure.reason
		}
	}

	// Upload files while preserving their original indexes.
	const results: Array<TItem | undefined> = new Array(files.length)

	const uploadFailure: { current: BatchFailure | null } = {
		current: null
	}

	await runWithConcurrency(
		files.length,
		concurrency,
		async (index) => {
			const file = files[index]

			if (!file) return

			try {
				results[index] = await upload(file)
			} catch (reason) {
				const currentFailure = uploadFailure.current

				if (!currentFailure || index < currentFailure.index) {
					uploadFailure.current = { index, reason }
				}
			}
		},
		() => uploadFailure.current !== null
	)

	const uploaded = results.filter((item): item is TItem => item !== undefined)

	const failure = uploadFailure.current

	if (!failure) {
		return uploaded
	}

	// Roll back successfully uploaded resources.
	const cleanupFailures: Array<{
		publicId: string
		reason: unknown
	}> = []

	await runWithConcurrency(uploaded.length, concurrency, async (index) => {
		const item = uploaded[index]

		if (!item) return

		try {
			await destroy(item.publicId)
		} catch (reason) {
			cleanupFailures.push({
				publicId: item.publicId,
				reason
			})
		}
	})

	if (cleanupFailures.length > 0) {
		const cleanupErrors = cleanupFailures.map(
			({ publicId, reason }) =>
				new Error(`Failed to remove resource "${publicId}"`, {
					cause: reason
				})
		)

		throw new AggregateError(
			[failure.reason, ...cleanupErrors],
			'Upload failed and some uploaded resources could not be removed'
		)
	}

	throw failure.reason
}
