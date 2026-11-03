import { v2 as cloudinary } from 'cloudinary'
import { HttpError } from 'riser-bob'
import { normalizeFolder } from '../shared/normalize-folder'
import type {
	CropMode,
	ImageFormat,
	ImageMimeType,
	UploadedImage,
	UploadManyOptions,
	UploadOptions,
	UrlOptions
} from './types'
import { errorMessage } from '../shared/error-message'
import type { UploadApiOptions, UploadApiResponse } from 'cloudinary'
import {
	CloudinaryCredentials,
	CloudinaryManagerOptions,
	DEFAULT_ALLOWED_TYPES,
	DEFAULT_DESTROY_CONCURRENCY,
	DEFAULT_MAX_FILE_SIZE,
	DEFAULT_UPLOAD_CONCURRENCY,
	DestroyManyOptions
} from '../types/config'
import { validateBlob } from '../shared/validate-blob'
import { detectImageType } from './image-type'
import { destroyBatch } from '../shared/destroy-batch'

function toUploadedImage(result: UploadApiResponse): UploadedImage {
	return {
		url: result.secure_url,
		publicId: result.public_id,
		width: result.width,
		height: result.height,
		format: result.format,
		bytes: result.bytes
	}
}

export class ImageManager {
	private readonly credentials: CloudinaryCredentials

	private readonly maxFileSize: number
	private readonly allowedTypes: readonly ImageMimeType[]

	constructor(
		credentials: CloudinaryCredentials,
		options: CloudinaryManagerOptions['images'] = {}
	) {
		this.credentials = credentials
		this.maxFileSize = options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE
		this.allowedTypes = options.allowedTypes ?? DEFAULT_ALLOWED_TYPES
	}
	/**
	 * Validates and uploads an image. Throws HttpError 400 (empty file or bad
	 * folder), 413 (too large), 415 (unsupported type) or 502 (Cloudinary failure).
	 */
	async uploadImage(
		file: Blob,
		folder: string,
		options: UploadOptions = {}
	): Promise<UploadedImage> {
		const targetFolder = normalizeFolder(folder)
		const buffer = await this.readAndValidate(file, options)

		const result = await this.uploadBuffer(buffer, {
			folder: targetFolder,
			resource_type: 'image',
			...(options.publicId ? { public_id: options.publicId } : {}),
			...(options.tags?.length ? { tags: options.tags } : {})
		})

		return toUploadedImage(result)
	}

	/**
	 * Uploads several images. If any upload fails, the ones that already
	 * succeeded are deleted and the first error is thrown.
	 */
	async uploadImagesMany(
		files: readonly Blob[],
		folder: string,
		options: UploadManyOptions = {}
	): Promise<UploadedImage[]> {
		if (files.length === 0) {
			throw new HttpError(400, 'At least one file is required')
		}

		const { concurrency = DEFAULT_UPLOAD_CONCURRENCY, ...uploadOptions } =
			options

		if (!Number.isInteger(concurrency) || concurrency < 1) {
			throw new HttpError(400, 'Concurrency must be a positive integer')
		}

		const uploaded: Array<{
			index: number
			image: UploadedImage
		}> = []

		const failures: Array<{
			index: number
			reason: unknown
		}> = []

		let nextIndex = 0

		const worker = async (): Promise<void> => {
			while (nextIndex < files.length) {
				const index = nextIndex++

				try {
					const file = files[index]

					if (!file) continue

					const image = await this.uploadImage(
						file,
						folder,
						uploadOptions
					)
					uploaded.push({ index, image })
				} catch (reason) {
					failures.push({ index, reason })
				}
			}
		}

		const workerCount = Math.min(concurrency, files.length)

		await Promise.all(Array.from({ length: workerCount }, () => worker()))

		if (failures.length > 0) {
			failures.sort((a, b) => a.index - b.index)

			const cleanupResults = await Promise.allSettled(
				uploaded.map(async ({ image }) => {
					try {
						await this.destroyImage(image.publicId)
						return null
					} catch (reason) {
						return {
							publicId: image.publicId,
							reason
						}
					}
				})
			)

			const cleanupFailures = cleanupResults.flatMap((result) => {
				if (result.status === 'rejected') {
					return [{ publicId: 'unknown', reason: result.reason }]
				}

				return result.value ? [result.value] : []
			})

			const firstFailure = failures[0]

			if (!firstFailure) {
				throw new HttpError(500, 'Unexpected upload failure')
			}

			const uploadError = firstFailure.reason

			if (cleanupFailures.length > 0) {
				throw new AggregateError(
					[uploadError, ...cleanupFailures],
					'Image upload failed and some uploaded images could not be removed'
				)
			}

			throw uploadError
		}

		return uploaded
			.sort((a, b) => a.index - b.index)
			.map(({ image }) => image)
	}

	/** Deletes an image. Deleting an image that does not exist is not an error. */
	async destroyImage(publicId: string): Promise<void> {
		if (!publicId?.trim()) {
			throw new HttpError(400, 'Public ID is required')
		}

		let result: { result?: string }

		try {
			result = await cloudinary.uploader.destroy(publicId, {
				...this.credentials,
				resource_type: 'image',
				invalidate: true
			})
		} catch (error) {
			throw new HttpError(
				502,
				errorMessage(error, 'Cloudinary image deletion failed')
			)
		}

		if (result.result === 'not found') {
			throw new HttpError(404, 'Image not found')
		}

		if (result.result !== 'ok') {
			throw new HttpError(502, 'Cloudinary image deletion failed')
		}
	}

	/** Deletes several images. Every deletion is attempted, then the first error is thrown. */
	async destroyImagesMany(
		publicIds: readonly string[],
		options: DestroyManyOptions = {}
	): Promise<void> {
		await destroyBatch(
			publicIds,
			options.concurrency ?? DEFAULT_DESTROY_CONCURRENCY,
			(publicId) => this.destroyImage(publicId)
		)
	}

	/** Builds a delivery URL with optional resizing and format options. */
	url(publicId: string, options: UrlOptions = {}): string {
		if (typeof publicId !== 'string' || !publicId.trim()) {
			throw new HttpError(400, 'Public ID is required')
		}

		const { width, height, crop, quality, format } = options

		if (width !== undefined && (!Number.isInteger(width) || width < 1)) {
			throw new HttpError(400, 'Width must be a positive integer')
		}

		if (height !== undefined && (!Number.isInteger(height) || height < 1)) {
			throw new HttpError(400, 'Height must be a positive integer')
		}

		const allowedCrops: readonly CropMode[] = [
			'fill',
			'fit',
			'scale',
			'limit',
			'thumb'
		] as const

		if (crop !== undefined && !allowedCrops.includes(crop)) {
			throw new HttpError(400, 'Invalid crop mode')
		}

		if (
			quality !== undefined &&
			quality !== 'auto' &&
			(!Number.isInteger(quality) || quality < 1 || quality > 100)
		) {
			throw new HttpError(
				400,
				'Quality must be an integer between 1 and 100, or auto'
			)
		}

		const ALLOWED_FORMATS: readonly ImageFormat[] = [
			'auto',
			'jpg',
			'jpeg',
			'png',
			'gif',
			'webp',
			'avif'
		] as const

		if (
			format !== undefined &&
			!ALLOWED_FORMATS.includes(
				format as (typeof ALLOWED_FORMATS)[number]
			)
		) {
			throw new HttpError(400, 'Invalid image format')
		}

		const hasSize = width !== undefined || height !== undefined

		const transformation = {
			...(width !== undefined ? { width } : {}),
			...(height !== undefined ? { height } : {}),
			...(hasSize ? { crop: crop ?? 'limit' } : {}),
			...(quality !== undefined ? { quality } : {}),
			...(format !== undefined ? { fetch_format: format } : {})
		}

		return cloudinary.url(publicId, {
			cloud_name: this.credentials.cloud_name,
			secure: true,
			analytics: false,
			resource_type: 'image',
			...(Object.keys(transformation).length > 0
				? { transformation: [transformation] }
				: {})
		})
	}

	private uploadBuffer(
		buffer: Buffer,
		options: UploadApiOptions
	): Promise<UploadApiResponse> {
		return new Promise((resolve, reject) => {
			const stream = cloudinary.uploader.upload_stream(
				{ ...this.credentials, ...options },
				(error, result) => {
					if (error) {
						reject(
							new HttpError(
								502,
								errorMessage(error, 'Cloudinary upload failed')
							)
						)
						return
					}

					if (!result) {
						reject(new HttpError(502, 'Cloudinary upload failed'))
						return
					}

					resolve(result)
				}
			)

			stream.end(buffer)
		})
	}

	private async readAndValidate(
		file: Blob,
		options: UploadOptions
	): Promise<Buffer> {
		await validateBlob(file, {
			maxFileSize: options.maxFileSize ?? this.maxFileSize,
			allowedTypes: options.allowedTypes ?? this.allowedTypes,
			detect: detectImageType,
			label: 'image'
		})

		return Buffer.from(await file.arrayBuffer())
	}
}
