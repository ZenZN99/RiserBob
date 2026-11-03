import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { HttpError } from 'riser-bob'
import type { UploadApiOptions, UploadApiResponse } from 'cloudinary'

import type { ImageManager as ImageManagerType } from '../../src/images/image-manager'

type UploadCallback = (
	error?: Error | undefined,
	result?: UploadApiResponse
) => void

type UploadHandler = (
	options: UploadApiOptions,
	callback: UploadCallback,
	buffer: Buffer
) => void

type UrlMockOptions = {
	cloud_name?: string
	secure?: boolean
	analytics?: boolean
	resource_type?: string
	transformation?: Array<Record<string, unknown>>
}

type DestroyHandler = (
	publicId: string,
	options: Record<string, unknown>
) => Promise<{ result?: string }>

type UploadStreamOptions = UploadApiOptions

const credentials = {
	cloud_name: 'test-cloud',
	api_key: 'test-api-key',
	api_secret: 'test-api-secret'
}

const pngBytes = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pWQAAAAASUVORK5CYII=',
	'base64'
)

function createFile(
	name = 'test.png',
	bytes: Uint8Array = pngBytes,
	type = 'image/png'
): File {
	const safeBytes = new Uint8Array(bytes)

	return new File([safeBytes.buffer], name, { type })
}

function createMarkedFile(marker: number): File {
	const bytes = new Uint8Array(pngBytes)

	bytes[40] = marker

	return createFile(`image-${marker}.png`, bytes)
}

function createUploadResponse(
	publicId: string,
	bytes = pngBytes.length
): UploadApiResponse {
	return {
		secure_url: `https://res.cloudinary.com/test-cloud/image/upload/${publicId}.png`,
		public_id: publicId,
		width: 100,
		height: 100,
		format: 'png',
		bytes
	} as UploadApiResponse
}

// Cloudinary mocks

let uploadHandler: UploadHandler
let destroyHandler: DestroyHandler
let generatedId = 0

const uploadStreamMock = mock(
	(options: UploadStreamOptions, callback: UploadCallback) => ({
		end(buffer: Buffer) {
			uploadHandler(options, callback, buffer)
		}
	})
)

const destroyMock = mock((publicId: string, options: Record<string, unknown>) =>
	destroyHandler(publicId, options)
)

const urlMock = mock(
	(_publicId: string, _options: UrlMockOptions) =>
		'https://res.cloudinary.com/test-cloud/image/upload/test.png'
)

mock.module('cloudinary', () => ({
	v2: {
		uploader: {
			upload_stream: uploadStreamMock,
			destroy: destroyMock
		},
		url: urlMock
	}
}))

const { ImageManager } = await import('../../src/images/image-manager')

let manager: InstanceType<typeof ImageManagerType>

function createManager(
	options: ConstructorParameters<typeof ImageManager>[1] = {}
): InstanceType<typeof ImageManagerType> {
	return new ImageManager(credentials, options)
}

function defaultUploadHandler(
	options: UploadApiOptions,
	callback: UploadCallback,
	buffer: Buffer
): void {
	generatedId++

	const publicId = options.public_id ?? `generated-image-${generatedId}`

	callback(undefined, createUploadResponse(publicId, buffer.length))
}

beforeEach(() => {
	generatedId = 0

	uploadHandler = defaultUploadHandler

	destroyHandler = async () => ({
		result: 'ok'
	})

	uploadStreamMock.mockClear()
	destroyMock.mockClear()
	urlMock.mockClear()

	manager = createManager()
})

afterEach(() => {
	uploadStreamMock.mockClear()
	destroyMock.mockClear()
	urlMock.mockClear()
})

// uploadImage

describe('ImageManager.uploadImage', () => {
	test('uploads an image successfully', async () => {
		const image = await manager.uploadImage(createFile(), 'uploads')

		expect(image).toEqual({
			url: expect.any(String),
			publicId: 'generated-image-1',
			width: 100,
			height: 100,
			format: 'png',
			bytes: pngBytes.length
		})

		expect(uploadStreamMock).toHaveBeenCalledTimes(1)

		const options = uploadStreamMock.mock.calls[0]?.[0]

		expect(options).toMatchObject({
			...credentials,
			folder: 'uploads',
			resource_type: 'image'
		})
	})

	test('normalizes the folder before uploading', async () => {
		await manager.uploadImage(createFile(), '/uploads/images/')

		const options = uploadStreamMock.mock.calls[0]?.[0]

		expect(options?.folder).toBe('uploads/images')
	})

	test('passes publicId and tags to Cloudinary', async () => {
		await manager.uploadImage(createFile(), 'uploads', {
			publicId: 'profile/avatar',
			tags: ['profile', 'avatar']
		})

		const options = uploadStreamMock.mock.calls[0]?.[0]

		expect(options).toMatchObject({
			public_id: 'profile/avatar',
			tags: ['profile', 'avatar']
		})
	})

	test('does not send optional properties when they are omitted', async () => {
		await manager.uploadImage(createFile(), 'uploads')

		const options = uploadStreamMock.mock.calls[0]?.[0]

		expect(options).not.toHaveProperty('public_id')
		expect(options).not.toHaveProperty('tags')
	})

	test('rejects an empty image', async () => {
		const file = createFile('empty.png', new Uint8Array())

		await expect(
			manager.uploadImage(file, 'uploads')
		).rejects.toBeInstanceOf(HttpError)

		expect(uploadStreamMock).not.toHaveBeenCalled()
	})

	test('rejects an image exceeding the maximum file size', async () => {
		const limitedManager = createManager({
			maxFileSize: 10
		})

		await expect(
			limitedManager.uploadImage(createFile(), 'uploads')
		).rejects.toBeInstanceOf(HttpError)

		expect(uploadStreamMock).not.toHaveBeenCalled()
	})

	test('rejects unsupported MIME types', async () => {
		const file = createFile(
			'document.pdf',
			Buffer.from('%PDF-1.7'),
			'application/pdf'
		)

		await expect(
			manager.uploadImage(file, 'uploads')
		).rejects.toBeInstanceOf(HttpError)

		expect(uploadStreamMock).not.toHaveBeenCalled()
	})

	test('rejects a file whose actual type does not match its declared MIME type', async () => {
		const file = createFile(
			'fake.png',
			Buffer.from('%PDF-1.7'),
			'image/png'
		)

		await expect(
			manager.uploadImage(file, 'uploads')
		).rejects.toBeInstanceOf(HttpError)

		expect(uploadStreamMock).not.toHaveBeenCalled()
	})

	test('uses custom maxFileSize configuration', async () => {
		const customManager = createManager({
			maxFileSize: 1024 * 1024
		})

		await expect(
			customManager.uploadImage(createFile(), 'uploads')
		).resolves.toBeDefined()
	})

	test('uses custom allowedTypes configuration', async () => {
		const customManager = createManager({
			allowedTypes: ['image/jpeg']
		})

		await expect(
			customManager.uploadImage(createFile(), 'uploads')
		).rejects.toBeInstanceOf(HttpError)

		expect(uploadStreamMock).not.toHaveBeenCalled()
	})

	test('rejects an invalid folder', async () => {
		await expect(
			manager.uploadImage(createFile(), '../uploads')
		).rejects.toBeInstanceOf(HttpError)

		expect(uploadStreamMock).not.toHaveBeenCalled()
	})

	test('wraps Cloudinary upload errors in HttpError', async () => {
		uploadHandler = (_options, callback) => {
			callback(new Error('Cloudinary unavailable'))
		}

		await expect(
			manager.uploadImage(createFile(), 'uploads')
		).rejects.toBeInstanceOf(HttpError)
	})

	test('rejects when Cloudinary returns no result', async () => {
		uploadHandler = (_options, callback) => {
			callback(undefined, undefined)
		}

		await expect(
			manager.uploadImage(createFile(), 'uploads')
		).rejects.toBeInstanceOf(HttpError)
	})
})

// uploadImagesMany

describe('ImageManager.uploadImagesMany', () => {
	test('uploads multiple images successfully', async () => {
		const files = [
			createFile('one.png'),
			createFile('two.png'),
			createFile('three.png')
		]

		const images = await manager.uploadImagesMany(files, 'uploads')

		expect(images).toHaveLength(3)
		expect(uploadStreamMock).toHaveBeenCalledTimes(3)

		expect(images.map((image) => image.publicId)).toEqual([
			'generated-image-1',
			'generated-image-2',
			'generated-image-3'
		])
	})

	test('preserves the original input order', async () => {
		uploadHandler = (_options, callback, buffer) => {
			const id = buffer[40] ?? 0

			setTimeout(
				() => {
					callback(undefined, createUploadResponse(`image-${id}`))
				},
				id === 1 ? 30 : 5
			)
		}

		const files = [
			createMarkedFile(1),
			createMarkedFile(2),
			createMarkedFile(3)
		]

		const images = await manager.uploadImagesMany(files, 'uploads', {
			concurrency: 3
		})

		expect(images.map((image) => image.publicId)).toEqual([
			'image-1',
			'image-2',
			'image-3'
		])
	})

	test('rejects an empty files array', async () => {
		await expect(
			manager.uploadImagesMany([], 'uploads')
		).rejects.toBeInstanceOf(HttpError)

		expect(uploadStreamMock).not.toHaveBeenCalled()
	})

	test.each([0, -1, 1.5, NaN])(
		'rejects invalid concurrency: %s',
		async (concurrency) => {
			await expect(
				manager.uploadImagesMany([createFile()], 'uploads', {
					concurrency
				})
			).rejects.toBeInstanceOf(HttpError)

			expect(uploadStreamMock).not.toHaveBeenCalled()
		}
	)

	test('accepts concurrency greater than the number of files', async () => {
		const images = await manager.uploadImagesMany(
			[createFile(), createFile()],
			'uploads',
			{ concurrency: 10 }
		)

		expect(images).toHaveLength(2)
	})

	test('limits the number of simultaneous uploads', async () => {
		let activeUploads = 0
		let maximumActiveUploads = 0

		uploadHandler = (_options, callback, buffer) => {
			activeUploads++

			maximumActiveUploads = Math.max(maximumActiveUploads, activeUploads)

			setTimeout(() => {
				activeUploads--

				callback(
					undefined,
					createUploadResponse(`image-${buffer[40] ?? 0}`)
				)
			}, 15)
		}

		const files = Array.from({ length: 6 }, (_, index) =>
			createMarkedFile(index + 1)
		)

		await manager.uploadImagesMany(files, 'uploads', {
			concurrency: 2
		})

		expect(maximumActiveUploads).toBeLessThanOrEqual(2)
		expect(maximumActiveUploads).toBe(2)
	})

	test('continues processing other files after an upload fails', async () => {
		uploadHandler = (_options, callback, buffer) => {
			if (buffer[40] === 2) {
				callback(new Error('Upload failed'))
				return
			}

			callback(undefined, createUploadResponse(`image-${buffer[40]}`))
		}

		const files = [
			createMarkedFile(1),
			createMarkedFile(2),
			createMarkedFile(3)
		]

		await expect(
			manager.uploadImagesMany(files, 'uploads', {
				concurrency: 1
			})
		).rejects.toBeInstanceOf(HttpError)

		expect(uploadStreamMock).toHaveBeenCalledTimes(3)
	})

	test('removes successfully uploaded images if another upload fails', async () => {
		uploadHandler = (_options, callback, buffer) => {
			if (buffer[40] === 2) {
				callback(new Error('Upload failed'))
				return
			}

			callback(undefined, createUploadResponse(`image-${buffer[40]}`))
		}

		const files = [
			createMarkedFile(1),
			createMarkedFile(2),
			createMarkedFile(3)
		]

		await expect(
			manager.uploadImagesMany(files, 'uploads', {
				concurrency: 1
			})
		).rejects.toBeInstanceOf(HttpError)

		expect(destroyMock).toHaveBeenCalledTimes(2)

		expect(destroyMock.mock.calls.map((call) => call[0])).toEqual([
			'image-1',
			'image-3'
		])
	})

	test('throws AggregateError if rollback deletion fails', async () => {
		uploadHandler = (_options, callback, buffer) => {
			if (buffer[40] === 2) {
				callback(new Error('Upload failed'))
				return
			}

			callback(undefined, createUploadResponse(`image-${buffer[40]}`))
		}

		destroyHandler = async () => {
			throw new Error('Deletion failed')
		}

		const files = [createMarkedFile(1), createMarkedFile(2)]

		await expect(
			manager.uploadImagesMany(files, 'uploads', {
				concurrency: 1
			})
		).rejects.toBeInstanceOf(AggregateError)
	})
})

// destroyImage

describe('ImageManager.destroyImage', () => {
	test('deletes an image successfully', async () => {
		await expect(
			manager.destroyImage('uploads/avatar')
		).resolves.toBeUndefined()

		expect(destroyMock).toHaveBeenCalledTimes(1)

		expect(destroyMock).toHaveBeenCalledWith('uploads/avatar', {
			...credentials,
			resource_type: 'image',
			invalidate: true
		})
	})

	test('rejects an empty publicId', async () => {
		await expect(manager.destroyImage('')).rejects.toBeInstanceOf(HttpError)

		expect(destroyMock).not.toHaveBeenCalled()
	})

	test('rejects a whitespace-only publicId', async () => {
		await expect(manager.destroyImage('   ')).rejects.toBeInstanceOf(
			HttpError
		)

		expect(destroyMock).not.toHaveBeenCalled()
	})

	test('throws HttpError when the image does not exist', async () => {
		destroyHandler = async () => ({
			result: 'not found'
		})

		await expect(manager.destroyImage('missing-image')).rejects.toThrow(
			'Image not found'
		)
	})

	test('throws HttpError for an unexpected Cloudinary result', async () => {
		destroyHandler = async () => ({
			result: 'error'
		})

		await expect(
			manager.destroyImage('uploads/avatar')
		).rejects.toBeInstanceOf(HttpError)
	})

	test('wraps Cloudinary deletion errors in HttpError', async () => {
		destroyHandler = async () => {
			throw new Error('Cloudinary unavailable')
		}

		await expect(
			manager.destroyImage('uploads/avatar')
		).rejects.toBeInstanceOf(HttpError)
	})
})

// destroyImagesMany

describe('ImageManager.destroyImagesMany', () => {
	test('deletes multiple images successfully', async () => {
		await expect(
			manager.destroyImagesMany([
				'uploads/one',
				'uploads/two',
				'uploads/three'
			])
		).resolves.toBeUndefined()

		expect(destroyMock).toHaveBeenCalledTimes(3)

		expect(destroyMock.mock.calls.map((call) => call[0])).toEqual([
			'uploads/one',
			'uploads/two',
			'uploads/three'
		])
	})

	test('uses the configured concurrency', async () => {
		let activeDeletes = 0
		let maximumActiveDeletes = 0

		destroyHandler = async (publicId) => {
			activeDeletes++

			maximumActiveDeletes = Math.max(maximumActiveDeletes, activeDeletes)

			await new Promise((resolve) => setTimeout(resolve, 15))

			activeDeletes--

			return { result: 'ok' }
		}

		await manager.destroyImagesMany(
			['one', 'two', 'three', 'four', 'five'],
			{ concurrency: 2 }
		)

		expect(maximumActiveDeletes).toBe(2)
	})

	test('attempts all deletions even when one deletion fails', async () => {
		destroyHandler = async (publicId) => {
			if (publicId === 'missing') {
				return { result: 'not found' }
			}

			return { result: 'ok' }
		}

		await expect(
			manager.destroyImagesMany(['one', 'missing', 'three'])
		).rejects.toBeInstanceOf(HttpError)

		expect(destroyMock).toHaveBeenCalledTimes(3)
	})
})

// url

describe('ImageManager.url', () => {
	test('generates an image URL', () => {
		const url = manager.url('uploads/avatar')

		expect(url).toBe(
			'https://res.cloudinary.com/test-cloud/image/upload/test.png'
		)

		expect(urlMock).toHaveBeenCalledWith('uploads/avatar', {
			cloud_name: credentials.cloud_name,
			secure: true,
			analytics: false,
			resource_type: 'image'
		})
	})

	test('generates a URL with width and height transformations', () => {
		manager.url('uploads/avatar', {
			width: 300,
			height: 200
		})

		expect(urlMock).toHaveBeenCalledWith(
			'uploads/avatar',
			expect.objectContaining({
				transformation: [
					{
						width: 300,
						height: 200,
						crop: 'limit'
					}
				]
			})
		)
	})

	test('uses the requested crop mode', () => {
		manager.url('uploads/avatar', {
			width: 300,
			crop: 'fill'
		})

		expect(urlMock.mock.calls[0]?.[1]).toMatchObject({
			transformation: [
				{
					width: 300,
					crop: 'fill'
				}
			]
		})
	})

	test('supports quality and format transformations', () => {
		manager.url('uploads/avatar', {
			quality: 80,
			format: 'webp'
		})

		expect(urlMock.mock.calls[0]?.[1]).toMatchObject({
			transformation: [
				{
					quality: 80,
					fetch_format: 'webp'
				}
			]
		})
	})

	test('supports automatic quality and format', () => {
		manager.url('uploads/avatar', {
			quality: 'auto',
			format: 'auto'
		})

		expect(urlMock.mock.calls[0]?.[1]).toMatchObject({
			transformation: [
				{
					quality: 'auto',
					fetch_format: 'auto'
				}
			]
		})
	})

	test('rejects an empty publicId', () => {
		expect(() => manager.url('')).toThrow(HttpError)
	})

	test('rejects a whitespace-only publicId', () => {
		expect(() => manager.url('   ')).toThrow(HttpError)
	})

	test.each([0, -1, 1.5, NaN])('rejects invalid width: %s', (width) => {
		expect(() => manager.url('uploads/avatar', { width })).toThrow(
			HttpError
		)
	})

	test.each([0, -1, 1.5, NaN])('rejects invalid height: %s', (height) => {
		expect(() => manager.url('uploads/avatar', { height })).toThrow(
			HttpError
		)
	})

	test.each([0, -1, 101, 1.5, NaN])(
		'rejects invalid quality: %s',
		(quality) => {
			expect(() =>
				manager.url('uploads/avatar', {
					quality
				})
			).toThrow(HttpError)
		}
	)

	test.each(['invalid', 'crop', 'none'])(
		'rejects invalid crop mode: %s',
		(crop) => {
			expect(() =>
				manager.url('uploads/avatar', {
					crop: crop as never
				})
			).toThrow(HttpError)
		}
	)

	test.each(['bmp', 'tiff', 'svg'])(
		'rejects invalid image format: %s',
		(format) => {
			expect(() =>
				manager.url('uploads/avatar', {
					format: format as never
				})
			).toThrow(HttpError)
		}
	)

	test('rejects width when it is not an integer', () => {
		expect(() =>
			manager.url('uploads/avatar', {
				width: 100.5
			})
		).toThrow(HttpError)
	})

	test('does not add a transformation when no options are provided', () => {
		manager.url('uploads/avatar')

		const options = urlMock.mock.calls[0]?.[1]

		expect(options).not.toHaveProperty('transformation')
	})

	test('does not add crop when no dimensions are provided', () => {
		manager.url('uploads/avatar', {
			quality: 80
		})

		const options = urlMock.mock.calls[0]?.[1]

		expect(options).toMatchObject({
			transformation: [
				{
					quality: 80
				}
			]
		})

		expect(options?.transformation?.[0]).not.toHaveProperty('crop')
	})
})
