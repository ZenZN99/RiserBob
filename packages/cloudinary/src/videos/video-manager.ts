import { HttpError } from 'riser-bob'

import { normalizeFolder } from '../shared/normalize-folder'
import { isValidPublicId } from '../shared/public-id'
import { validateBlob } from '../shared/validate-blob'
import { uploadBlobStream } from '../shared/upload-stream'
import { uploadBatch } from '../shared/upload-batch'
import { destroyBatch } from '../shared/destroy-batch'
import { assertConcurrency } from '../shared/concurrency'

import {
	DEFAULT_ALLOWED_VIDEO_TYPES,
	DEFAULT_DESTROY_CONCURRENCY,
	DEFAULT_MAX_VIDEO_BYTES,
	DEFAULT_VIDEO_CONCURRENCY
} from '../types/config'

import type {
	CloudinaryCredentials,
	CloudinaryManagerOptions,
	DestroyManyOptions
} from '../types/config'

import { detectVideoType } from './video-type'

import type {
	VideoMimeType,
	UploadedVideo,
	UploadVideoOptions,
	UploadVideosManyOptions
} from './types'
import { v2 as cloudinary } from 'cloudinary'

export class VideoManager {
	private readonly credentials: CloudinaryCredentials
	private readonly maxFileSize: number
	private readonly allowedTypes: readonly VideoMimeType[]

	constructor(
		credentials: CloudinaryCredentials,
		options: CloudinaryManagerOptions['videos'] = {}
	) {
		this.credentials = credentials

		this.maxFileSize = options.maxFileSize ?? DEFAULT_MAX_VIDEO_BYTES

		this.allowedTypes = options.allowedTypes ?? DEFAULT_ALLOWED_VIDEO_TYPES
	}

	async uploadVideo(
		file: Blob,
		folder: string,
		options: UploadVideoOptions = {}
	): Promise<UploadedVideo> {
		const targetFolder = normalizeFolder(folder)

		if (
			options.publicId !== undefined &&
			!isValidPublicId(options.publicId)
		) {
			throw new HttpError(400, 'Invalid public ID')
		}

		await this.validateVideo(file, options)

		const result = await uploadBlobStream(file, this.credentials, {
			folder: targetFolder,
			resource_type: 'video',
			...(options.publicId ? { public_id: options.publicId } : {}),
			...(options.tags?.length ? { tags: options.tags } : {})
		})

		return {
			url: result.secure_url,
			publicId: result.public_id,
			width: result.width,
			height: result.height,
			format: result.format,
			bytes: result.bytes,
			duration: typeof result.duration === 'number' ? result.duration : 0
		}
	}

	async uploadVideosMany(
		files: readonly Blob[],
		folder: string,
		options: UploadVideosManyOptions = {}
	): Promise<UploadedVideo[]> {
		if (files.length === 0) {
			throw new HttpError(400, 'At least one file is required')
		}

		const { concurrency = DEFAULT_VIDEO_CONCURRENCY, ...uploadOptions } =
			options

		assertConcurrency(concurrency)
		normalizeFolder(folder)

		return uploadBatch(
			files,
			concurrency,
			(file) => this.validateVideo(file, uploadOptions),
			(file) => this.uploadVideo(file, folder, uploadOptions),
			(publicId) => this.destroyVideo(publicId)
		)
	}

	async destroyVideo(publicId: string): Promise<void> {
		if (!publicId || typeof publicId !== 'string' || !publicId.trim()) {
			throw new HttpError(400, 'Public ID is required')
		}

		const result = await cloudinary.uploader.destroy(publicId, {
			...this.credentials,
			resource_type: 'video',
			invalidate: true
		})

		if (result.result === 'not found') {
			throw new HttpError(404, 'Video not found')
		}

		if (result.result !== 'ok') {
			throw new HttpError(502, 'Failed to destroy video')
		}
	}

	async destroyVideosMany(
		publicIds: readonly string[],
		options: DestroyManyOptions = {}
	): Promise<void> {
		await destroyBatch(
			publicIds,
			options.concurrency ?? DEFAULT_DESTROY_CONCURRENCY,
			(publicId) => this.destroyVideo(publicId)
		)
	}

	private validateVideo(
		file: Blob,
		options: UploadVideoOptions
	): Promise<VideoMimeType> {
		return validateBlob(file, {
			maxFileSize: options.maxFileSize ?? this.maxFileSize,
			allowedTypes: options.allowedTypes ?? this.allowedTypes,
			detect: detectVideoType,
			label: 'video'
		})
	}
}
