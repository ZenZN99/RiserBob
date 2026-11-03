import { HttpError } from 'riser-bob'

const MAX_CONCURRENCY = 10

/**
 * Validates the maximum number of concurrent operations.
 */
export function assertConcurrency(concurrency: number): void {
	if (
		!Number.isInteger(concurrency) ||
		concurrency < 1 ||
		concurrency > MAX_CONCURRENCY
	) {
		throw new HttpError(
			400,
			`Concurrency must be an integer between 1 and ${MAX_CONCURRENCY}`
		)
	}
}

/**
 * Runs tasks with a limited number of concurrent workers.
 *
 * Each task receives its original index.
 * If shouldStop returns true, no new tasks are started.
 * Already running tasks are allowed to finish.
 */
export async function runWithConcurrency(
	total: number,
	concurrency: number,
	task: (index: number) => Promise<void>,
	shouldStop: () => boolean = () => false
): Promise<void> {
	assertConcurrency(concurrency)

	if (!Number.isInteger(total) || total < 0) {
		throw new HttpError(400, 'Total must be a non-negative integer')
	}

	let nextIndex = 0

	const worker = async (): Promise<void> => {
		while (nextIndex < total && !shouldStop()) {
			const index = nextIndex++
			await task(index)
		}
	}

	const workerCount = Math.min(total, concurrency)

	await Promise.all(Array.from({ length: workerCount }, () => worker()))
}
