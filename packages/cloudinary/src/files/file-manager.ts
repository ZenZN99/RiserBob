import { HttpError } from 'riser-bob'
import { v2 as cloudinary } from 'cloudinary'
import { randomUUID } from 'node:crypto'

import { normalizeFolder } from '../shared/normalize-folder'
import { isValidPublicId } from '../shared/public-id'
import { validateBlob } from '../shared/validate-blob'
import { uploadBlobStream } from '../shared/upload-stream'
import { uploadBatch } from '../shared/upload-batch'
import { destroyBatch } from '../shared/destroy-batch'
import { assertConcurrency } from '../shared/concurrency'

import { detectFileType } from './file-type'

import {
	FILE_EXTENSIONS,
	type FileMimeType,
	type UploadedFile,
	type UploadFileOptions,
	type UploadFilesManyOptions
} from './types'

import {
	DEFAULT_ALLOWED_FILE_TYPES,
	DEFAULT_MAX_FILE_BYTES,
	DEFAULT_UPLOAD_CONCURRENCY,
	DEFAULT_DESTROY_CONCURRENCY
} from '../types/config'

import type {
	CloudinaryCredentials,
	CloudinaryManagerOptions,
	DestroyManyOptions
} from '../types/config'

export class FileManager {
	private readonly credentials: CloudinaryCredentials
	private readonly maxFileSize: number
	private readonly allowedTypes: readonly FileMimeType[]

	constructor(
		credentials: CloudinaryCredentials,
		options: CloudinaryManagerOptions['files'] = {}
	) {
		this.credentials = credentials
		this.maxFileSize = options.maxFileSize ?? DEFAULT_MAX_FILE_BYTES
		this.allowedTypes = options.allowedTypes ?? DEFAULT_ALLOWED_FILE_TYPES
	}

	async uploadFile(
		file: Blob,
		folder: string,
		options: UploadFileOptions = {}
	): Promise<UploadedFile> {
		const targetFolder = normalizeFolder(folder)

		if (
			options.publicId !== undefined &&
			!isValidPublicId(options.publicId)
		) {
			throw new HttpError(400, 'Invalid public ID')
		}

		const mimeType = await this.validateFile(file, options)

		const result = await uploadBlobStream(file, this.credentials, {
			folder: targetFolder,
			resource_type: 'raw',
			public_id:
				options.publicId ??
				`${randomUUID()}.${FILE_EXTENSIONS[mimeType]}`,
			...(options.tags?.length ? { tags: options.tags } : {})
		})

		return {
			url: result.secure_url,
			publicId: result.public_id,
			bytes: result.bytes,
			mimeType
		}
	}

	async uploadFilesMany(
		files: readonly Blob[],
		folder: string,
		options: UploadFilesManyOptions = {}
	): Promise<UploadedFile[]> {
		const { concurrency = DEFAULT_UPLOAD_CONCURRENCY, ...uploadOptions } =
			options

		assertConcurrency(concurrency)
		normalizeFolder(folder)

		return uploadBatch(
			files,
			concurrency,
			(file) => this.validateFile(file, uploadOptions),
			(file) => this.uploadFile(file, folder, uploadOptions),
			(publicId) => this.destroyFile(publicId)
		)
	}

	async destroyFile(publicId: string): Promise<void> {
		if (typeof publicId !== 'string' || !publicId.trim()) {
			throw new HttpError(400, 'Public ID is required')
		}

		const destroyOptions = {
			...this.credentials,
			resource_type: 'raw' as const,
			invalidate: true
		}

		const result = await cloudinary.uploader.destroy(
			publicId,
			destroyOptions
		)

		if (result.result === 'not found') {
			throw new HttpError(404, 'File not found')
		}

		if (result.result !== 'ok') {
			throw new HttpError(502, 'Failed to destroy file')
		}
	}

	async destroyFilesMany(
		publicIds: readonly string[],
		options: DestroyManyOptions = {}
	): Promise<void> {
		await destroyBatch(
			publicIds,
			options.concurrency ?? DEFAULT_DESTROY_CONCURRENCY,
			(publicId) => this.destroyFile(publicId)
		)
	}

	private validateFile(
		file: Blob,
		options: UploadFileOptions
	): Promise<FileMimeType> {
		return validateBlob(file, {
			maxFileSize: options.maxFileSize ?? this.maxFileSize,
			allowedTypes: options.allowedTypes ?? this.allowedTypes,
			detect: detectFileType,
			label: 'file'
		})
	}
}
