import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import type { UploadApiOptions, UploadApiResponse } from 'cloudinary'
import type { CloudinaryCredentials } from '../../src/types/config'
import type { VideoMimeType } from '../../src/videos/types'

const uploadBlobStreamMock = mock(
	async (
		_file: Blob,
		_credentials: CloudinaryCredentials,
		_options: UploadApiOptions
	) =>
		({
			secure_url:
				'https://res.cloudinary.com/test/video/upload/video.mp4',
			public_id: 'videos/video.mp4',
			width: 1920,
			height: 1080,
			format: 'mp4',
			bytes: 2048,
			duration: 15
		}) as unknown as UploadApiResponse
)

const validateBlobMock = mock(
	async (
		_file: Blob,
		_options: {
			maxFileSize: number
			allowedTypes: readonly VideoMimeType[]
			detect: (bytes: Uint8Array) => VideoMimeType | null
			label: string
		}
	): Promise<VideoMimeType> => 'video/mp4' as VideoMimeType
)

const destroyMock = mock(async () => ({
	result: 'ok'
}))

// Capture the real validator before it is mocked, so it can be restored in afterAll.
const realValidateBlob = (await import('../../src/shared/validate-blob'))
	.validateBlob

mock.module('../../src/shared/upload-stream', () => ({
	uploadBlobStream: uploadBlobStreamMock
}))

mock.module('../../src/shared/validate-blob', () => ({
	validateBlob: validateBlobMock
}))

mock.module('cloudinary', () => ({
	v2: {
		uploader: {
			destroy: destroyMock
		}
	}
}))

// Import after registering mocks.
const { VideoManager } = await import('../../src/videos/video-manager')

// Fixtures

const credentials: CloudinaryCredentials = {
	cloud_name: 'test-cloud',
	api_key: 'test-api-key',
	api_secret: 'test-api-secret'
}

const createFile = (name = 'video.mp4', type = 'video/mp4'): File => {
	return new File(['test video content'], name, { type })
}

const createManager = (options = {}) => new VideoManager(credentials, options)

// Tests

describe('VideoManager', () => {
	beforeEach(() => {
		uploadBlobStreamMock.mockClear()
		validateBlobMock.mockClear()
		destroyMock.mockClear()

		uploadBlobStreamMock.mockImplementation(
			async () =>
				({
					secure_url:
						'https://res.cloudinary.com/test/video/upload/video.mp4',
					public_id: 'videos/video.mp4',
					width: 1920,
					height: 1080,
					format: 'mp4',
					bytes: 2048,
					duration: 15
				}) as unknown as UploadApiResponse
		)

		validateBlobMock.mockImplementation(async () => {
			return 'video/mp4' as VideoMimeType
		})

		destroyMock.mockImplementation(async () => ({
			result: 'ok'
		}))
	})

	// Constructor

	describe('constructor', () => {
		test('should create a VideoManager instance', () => {
			const manager = createManager()

			expect(manager).toBeInstanceOf(VideoManager)
		})

		test('should accept custom video options', () => {
			const manager = new VideoManager(credentials, {
				maxFileSize: 20 * 1024 * 1024,
				allowedTypes: ['video/mp4']
			})

			expect(manager).toBeInstanceOf(VideoManager)
		})
	})

	// uploadVideo

	describe('uploadVideo', () => {
		test('should upload a video successfully', async () => {
			const manager = createManager()

			const result = await manager.uploadVideo(createFile(), 'videos')

			expect(validateBlobMock).toHaveBeenCalledTimes(1)
			expect(uploadBlobStreamMock).toHaveBeenCalledTimes(1)

			expect(result).toEqual({
				url: 'https://res.cloudinary.com/test/video/upload/video.mp4',
				publicId: 'videos/video.mp4',
				width: 1920,
				height: 1080,
				format: 'mp4',
				bytes: 2048,
				duration: 15
			})
		})

		test('should normalize the target folder', async () => {
			const manager = createManager()

			await manager.uploadVideo(createFile(), '/videos/')

			const options = uploadBlobStreamMock.mock.calls[0]?.[2]

			expect(options?.folder).toBe('videos')
		})

		test('should use the provided public ID', async () => {
			const manager = createManager()

			await manager.uploadVideo(createFile(), 'videos', {
				publicId: 'videos/my-video'
			})

			const options = uploadBlobStreamMock.mock.calls[0]?.[2]

			expect(options?.public_id).toBe('videos/my-video')
		})

		test('should omit public ID when one is not provided', async () => {
			const manager = createManager()

			await manager.uploadVideo(createFile(), 'videos')

			const options = uploadBlobStreamMock.mock.calls[0]?.[2]

			expect(options?.public_id).toBeUndefined()
		})

		test('should use video resource type', async () => {
			const manager = createManager()

			await manager.uploadVideo(createFile(), 'videos')

			const options = uploadBlobStreamMock.mock.calls[0]?.[2]

			expect(options?.resource_type).toBe('video')
		})

		test('should include tags when provided', async () => {
			const manager = createManager()

			await manager.uploadVideo(createFile(), 'videos', {
				tags: ['video', 'tutorial']
			})

			const options = uploadBlobStreamMock.mock.calls[0]?.[2]

			expect(options?.tags).toEqual(['video', 'tutorial'])
		})

		test('should omit tags when an empty array is provided', async () => {
			const manager = createManager()

			await manager.uploadVideo(createFile(), 'videos', {
				tags: []
			})

			const options = uploadBlobStreamMock.mock.calls[0]?.[2]

			expect(options?.tags).toBeUndefined()
		})

		test('should pass credentials to the upload helper', async () => {
			const manager = createManager()

			await manager.uploadVideo(createFile(), 'videos')

			expect(uploadBlobStreamMock.mock.calls[0]?.[1]).toEqual(credentials)
		})

		test('should reject an invalid public ID', async () => {
			const manager = createManager()

			await expect(
				manager.uploadVideo(createFile(), 'videos', {
					publicId: 'videos/../video.mp4'
				})
			).rejects.toThrow('Invalid public ID')

			expect(uploadBlobStreamMock).not.toHaveBeenCalled()
		})

		test('should propagate validation errors', async () => {
			const manager = createManager()

			validateBlobMock.mockRejectedValueOnce(
				new Error('Invalid video type')
			)

			await expect(
				manager.uploadVideo(createFile(), 'videos')
			).rejects.toThrow('Invalid video type')

			expect(uploadBlobStreamMock).not.toHaveBeenCalled()
		})

		test('should use per-upload validation options', async () => {
			const manager = createManager()

			await manager.uploadVideo(createFile(), 'videos', {
				maxFileSize: 2048,
				allowedTypes: ['video/mp4']
			})

			const options = validateBlobMock.mock.calls[0]?.[1]

			expect(options?.maxFileSize).toBe(2048)
			expect(options?.allowedTypes).toEqual(['video/mp4'])
			expect(options?.label).toBe('video')
		})

		test('should use default duration when Cloudinary omits it', async () => {
			const manager = createManager()

			uploadBlobStreamMock.mockImplementationOnce(
				async () =>
					({
						secure_url: 'https://res.cloudinary.com/test/video.mp4',
						public_id: 'videos/video.mp4',
						width: 1920,
						height: 1080,
						format: 'mp4',
						bytes: 2048
					}) as UploadApiResponse
			)

			const result = await manager.uploadVideo(createFile(), 'videos')

			expect(result.duration).toBe(0)
		})
	})

	// uploadVideosMany

	describe('uploadVideosMany', () => {
		test('should upload multiple videos successfully', async () => {
			const manager = createManager()

			const videos = await manager.uploadVideosMany(
				[
					createFile('first.mp4'),
					createFile('second.mp4'),
					createFile('third.mp4')
				],
				'videos'
			)

			expect(videos).toHaveLength(3)
			expect(uploadBlobStreamMock).toHaveBeenCalledTimes(3)
		})

		test('should reject empty input', async () => {
			const manager = createManager()

			await expect(
				manager.uploadVideosMany([], 'videos')
			).rejects.toThrow('At least one file is required')

			expect(uploadBlobStreamMock).not.toHaveBeenCalled()
		})

		test('should use the provided concurrency', async () => {
			const manager = createManager()

			await manager.uploadVideosMany(
				[createFile('first.mp4'), createFile('second.mp4')],
				'videos',
				{ concurrency: 2 }
			)

			expect(uploadBlobStreamMock).toHaveBeenCalledTimes(2)
		})

		test('should reject invalid concurrency', async () => {
			const manager = createManager()

			await expect(
				manager.uploadVideosMany([createFile()], 'videos', {
					concurrency: 0
				})
			).rejects.toThrow()

			expect(uploadBlobStreamMock).not.toHaveBeenCalled()
		})

		test('should validate each video before uploading', async () => {
			const manager = createManager()

			await manager.uploadVideosMany(
				[createFile('first.mp4'), createFile('second.mp4')],
				'videos'
			)

			// Each file is validated once in uploadBatch
			// and once again in uploadVideo.
			expect(validateBlobMock).toHaveBeenCalledTimes(4)
		})
	})

	// destroyVideo

	describe('destroyVideo', () => {
		test('should destroy a video successfully', async () => {
			const manager = createManager()

			await expect(
				manager.destroyVideo('videos/video.mp4')
			).resolves.toBeUndefined()

			expect(destroyMock).toHaveBeenCalledTimes(1)

			expect(destroyMock).toHaveBeenCalledWith('videos/video.mp4', {
				...credentials,
				resource_type: 'video',
				invalidate: true
			})
		})

		test('should reject an empty public ID', async () => {
			const manager = createManager()

			await expect(manager.destroyVideo('')).rejects.toThrow(
				'Public ID is required'
			)

			expect(destroyMock).not.toHaveBeenCalled()
		})

		test('should reject a whitespace public ID', async () => {
			const manager = createManager()

			await expect(manager.destroyVideo('   ')).rejects.toThrow(
				'Public ID is required'
			)

			expect(destroyMock).not.toHaveBeenCalled()
		})

		test('should reject a non-string public ID', async () => {
			const manager = createManager()

			await expect(
				manager.destroyVideo(null as unknown as string)
			).rejects.toThrow('Public ID is required')

			expect(destroyMock).not.toHaveBeenCalled()
		})

		test('should throw 404 when the video does not exist', async () => {
			const manager = createManager()

			destroyMock.mockImplementationOnce(async () => ({
				result: 'not found'
			}))

			await expect(
				manager.destroyVideo('videos/missing.mp4')
			).rejects.toThrow('Video not found')
		})

		test('should throw 502 when Cloudinary returns an unexpected result', async () => {
			const manager = createManager()

			destroyMock.mockImplementationOnce(async () => ({
				result: 'error'
			}))

			await expect(
				manager.destroyVideo('videos/video.mp4')
			).rejects.toThrow('Failed to destroy video')
		})

		test('should propagate Cloudinary errors', async () => {
			const manager = createManager()

			destroyMock.mockRejectedValueOnce(
				new Error('Cloudinary connection failed')
			)

			await expect(
				manager.destroyVideo('videos/video.mp4')
			).rejects.toThrow('Cloudinary connection failed')
		})
	})

	// destroyVideosMany

	describe('destroyVideosMany', () => {
		test('should destroy multiple videos successfully', async () => {
			const manager = createManager()

			await manager.destroyVideosMany([
				'videos/first.mp4',
				'videos/second.mp4',
				'videos/third.mp4'
			])

			expect(destroyMock).toHaveBeenCalledTimes(3)
		})

		test('should resolve for an empty public IDs array', async () => {
			const manager = createManager()

			await expect(manager.destroyVideosMany([])).resolves.toBeUndefined()

			expect(destroyMock).not.toHaveBeenCalled()
		})

		test('should use the provided concurrency', async () => {
			const manager = createManager()

			await manager.destroyVideosMany(
				['videos/first.mp4', 'videos/second.mp4'],
				{ concurrency: 2 }
			)

			expect(destroyMock).toHaveBeenCalledTimes(2)
		})

		test('should propagate destroy errors', async () => {
			const manager = createManager()

			destroyMock.mockRejectedValueOnce(new Error('Destroy failed'))

			await expect(
				manager.destroyVideosMany(['videos/first.mp4'])
			).rejects.toThrow('Destroy failed')
		})
	})
})

afterAll(() => {
	validateBlobMock.mockImplementation((file, rules) =>
		realValidateBlob(file, rules)
	)
})
