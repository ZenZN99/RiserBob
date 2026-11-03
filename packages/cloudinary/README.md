# ☁️ @riser-bob/cloudinary

**A secure, type-safe Cloudinary upload manager for images, files, and videos, built for Bun and modern JavaScript runtimes.**

`@riser-bob/cloudinary` wraps the Cloudinary SDK with a small, predictable API for uploading and deleting images, PDF/ZIP files, and videos. Every upload is validated before it leaves your server: size first, then the real content type read from the file's bytes.

Designed with security-conscious defaults, it can be used independently or alongside the RiserBob framework.

[![npm version](https://img.shields.io/npm/v/@riser-bob/cloudinary)](https://www.npmjs.com/package/@riser-bob/cloudinary)
[![npm downloads](https://img.shields.io/npm/dm/@riser-bob/cloudinary)](https://www.npmjs.com/package/@riser-bob/cloudinary)
[![TypeScript](https://img.shields.io/badge/TypeScript-supported-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## ✨ Features

- **Three managers in one** — `images`, `files`, and `videos`, each with its own limits and allowed types.
- **Content-based validation** — The type is detected from the file's first bytes, never from the spoofable `file.type`.
- **Size limits** — Files over the limit are rejected before any upload starts (5 MB images, 10 MB files, 100 MB videos by default).
- **Safe defaults** — SVG is not accepted unless you explicitly allow it.
- **Batch operations** — Upload or delete many resources with bounded concurrency. A failed batch upload removes what was already uploaded.
- **Streaming uploads** — Files and videos are streamed to Cloudinary instead of being loaded fully into memory.
- **No global state** — Credentials are passed per instance, with no module-level `cloudinary.config()` side effect.
- **URL helper** — Build resized and optimized image delivery URLs.
- **Structured errors** — Failures are `HttpError`s with meaningful status codes.
- **TypeScript support** — Fully typed configuration, options, and results.

## 📦 Installation

```bash
bun add @riser-bob/cloudinary
```

Or with npm:

```bash
npm install @riser-bob/cloudinary
```

`riser-bob` is a peer dependency and must be installed in your project.

## 🚀 Quick start

```ts
import { CloudinaryManager } from '@riser-bob/cloudinary'

const cloudinary = new CloudinaryManager({
	cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
	apiKey: process.env.CLOUDINARY_API_KEY!,
	apiSecret: process.env.CLOUDINARY_API_SECRET!
})

// Upload an image
const image = await cloudinary.images.uploadImage(file, 'avatars')
console.log(image.url, image.publicId)

// Delete it
await cloudinary.images.destroyImage(image.publicId)
```

Or read the credentials from `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`:

```ts
const cloudinary = CloudinaryManager.fromEnv()
```

## 📖 API reference

### `CloudinaryManager`

```ts
new CloudinaryManager(config: CloudinaryManagerConfig, options?: CloudinaryManagerOptions)
```

The constructor throws `HttpError(500)` when `cloudName`, `apiKey`, or `apiSecret` is missing. It exposes three managers:

| Property | Manager        | Handles                             |
| -------- | -------------- | ----------------------------------- |
| `images` | `ImageManager` | Images, plus delivery URL building  |
| `files`  | `FileManager`  | PDF and ZIP files (stored as `raw`) |
| `videos` | `VideoManager` | MP4, WebM, and QuickTime videos     |

### `CloudinaryManager.fromEnv()`

```ts
CloudinaryManager.fromEnv(env?: Record<string, string | undefined>): CloudinaryManager
```

Reads the three `CLOUDINARY_*` variables from `process.env` (or from the `env` object you pass) and throws `HttpError(500)` naming the first one that is missing or empty.

### Images — `cloudinary.images`

#### `uploadImage()`

```ts
uploadImage(file: Blob, folder: string, options?: UploadOptions): Promise<UploadedImage>
```

Validates and uploads an image. `File` extends `Blob`, so a `File` from `request.formData()` works directly.

```ts
const image = await cloudinary.images.uploadImage(file, 'products', {
	tags: ['product'],
	maxFileSize: 2 * 1024 * 1024,
	allowedTypes: ['image/jpeg', 'image/png']
})
```

Returns:

```ts
interface UploadedImage {
	url: string // HTTPS delivery URL
	publicId: string // store this, you need it to delete the image
	width: number
	height: number
	format: string
	bytes: number
}
```

`UploadOptions` accepts `publicId`, `tags`, `maxFileSize`, and `allowedTypes`.

#### `uploadImagesMany()`

```ts
uploadImagesMany(files: readonly Blob[], folder: string, options?: UploadManyOptions): Promise<UploadedImage[]>
```

Uploads several images in parallel (`concurrency` defaults to `3`) and returns them in the original order. If any upload fails, the images that already succeeded are deleted and the first error is thrown, so you never end up with orphaned images. `publicId` is not available in batch uploads.

#### `destroyImage()` / `destroyImagesMany()`

```ts
await cloudinary.images.destroyImage('avatars/abc123')
await cloudinary.images.destroyImagesMany(['avatars/a', 'avatars/b'], {
	concurrency: 5
})
```

Deleted images are also invalidated on the CDN. Deleting an image that does not exist throws `HttpError(404)`. `destroyImagesMany` removes duplicate IDs, attempts every deletion, then throws the first error (in input order) if any failed.

#### `url()`

Builds a delivery URL with optional resizing and format options.

```ts
const thumb = cloudinary.images.url(image.publicId, {
	width: 200,
	height: 200,
	crop: 'fill',
	quality: 'auto',
	format: 'auto'
})
```

| Option    | Values                                                            |
| --------- | ----------------------------------------------------------------- |
| `width`   | Positive integer                                                  |
| `height`  | Positive integer                                                  |
| `crop`    | `'fill'`, `'fit'`, `'scale'`, `'limit'`, `'thumb'`                |
| `quality` | Integer from `1` to `100`, or `'auto'`                            |
| `format`  | `'auto'`, `'jpg'`, `'jpeg'`, `'png'`, `'gif'`, `'webp'`, `'avif'` |

`crop` defaults to `'limit'` when a width or height is set. Invalid values throw `HttpError(400)`.

### Files — `cloudinary.files`

```ts
const file = await cloudinary.files.uploadFile(pdf, 'documents', {
	tags: ['invoice']
})
// { url, publicId, bytes, mimeType: 'application/pdf' }

const many = await cloudinary.files.uploadFilesMany([a, b, c], 'documents', {
	concurrency: 3
})

await cloudinary.files.destroyFile(file.publicId)
await cloudinary.files.destroyFilesMany(many.map((item) => item.publicId))
```

Accepts PDF and ZIP files. The ZIP type also covers `.docx`, `.xlsx`, and `.pptx`, which are ZIP containers. Unless you pass a `publicId`, a random one is generated and includes the file extension (for example `3f2a…c1.pdf`). Raw files are stored with their extension as part of the public ID, so always pass the full `publicId` back to `destroyFile()`.

```ts
interface UploadedFile {
	url: string
	publicId: string
	bytes: number
	mimeType: 'application/pdf' | 'application/zip'
}
```

### Videos — `cloudinary.videos`

```ts
const video = await cloudinary.videos.uploadVideo(file, 'lessons', {
	tags: ['intro']
})
// { url, publicId, width, height, format, bytes, duration }

const many = await cloudinary.videos.uploadVideosMany([a, b], 'lessons', {
	concurrency: 2
})

await cloudinary.videos.destroyVideo(video.publicId)
await cloudinary.videos.destroyVideosMany(many.map((item) => item.publicId))
```

Accepts MP4, WebM, and QuickTime (`.mov`). `duration` is in seconds. Image formats that share the MP4 container (AVIF, HEIC) are rejected as videos.

### Batch behavior (files and videos)

`uploadFilesMany()` and `uploadVideosMany()` share the same safe batch flow:

1. Every file is validated **before** any upload starts, so one bad file fails the batch without wasting uploads.
2. Uploads run with bounded concurrency. After the first failure, no new uploads are started.
3. Everything that already uploaded is deleted, and the first error (by input order) is thrown.
4. Results keep the original input order.

If the cleanup itself fails for some resources, an `AggregateError` is thrown containing the original error followed by one error per resource that could not be removed.

### `extractPublicId()`

Gets the public ID from a Cloudinary delivery URL, for when only the URL was stored.

```ts
import { extractPublicId } from '@riser-bob/cloudinary'

const publicId = extractPublicId(user.avatarUrl)
if (publicId) await cloudinary.images.destroyImage(publicId)
```

Returns `null` for non-Cloudinary URLs. It strips the file extension, so it is meant for **images and videos**. Raw files keep their extension in the public ID, so store the `publicId` returned by `uploadFile()` instead. If a URL contains transformations but no version segment (`v123`), they cannot be told apart from folders, so prefer storing the public ID.

## ⚙️ Configuration

```ts
new CloudinaryManager(
	{ cloudName, apiKey, apiSecret },
	{
		images: {
			maxFileSize: 2 * 1024 * 1024,
			allowedTypes: ['image/jpeg', 'image/png']
		},
		files: { maxFileSize: 20 * 1024 * 1024 },
		videos: { maxFileSize: 50 * 1024 * 1024, allowedTypes: ['video/mp4'] }
	}
)
```

### `CloudinaryManagerOptions`

| Option                | Default                                                            | Description                 |
| --------------------- | ------------------------------------------------------------------ | --------------------------- |
| `images.maxFileSize`  | `5242880` (5 MB)                                                   | Maximum image size in bytes |
| `images.allowedTypes` | `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/avif` | Accepted image types        |
| `files.maxFileSize`   | `10485760` (10 MB)                                                 | Maximum file size in bytes  |
| `files.allowedTypes`  | `application/pdf`, `application/zip`                               | Accepted file types         |
| `videos.maxFileSize`  | `104857600` (100 MB)                                               | Maximum video size in bytes |
| `videos.allowedTypes` | `video/mp4`, `video/webm`, `video/quicktime`                       | Accepted video types        |

`maxFileSize` and `allowedTypes` can also be overridden per upload.

### Batch concurrency

| Operation                    | Default |
| ---------------------------- | ------- |
| Image and file batch uploads | `3`     |
| Video batch uploads          | `2`     |
| Batch deletions              | `5`     |

For files, videos, and deletions, `concurrency` must be an integer from `1` to `10`, otherwise `HttpError(400)` is thrown.

## 🚨 Errors

| Status | Cause                                                                    |
| ------ | ------------------------------------------------------------------------ |
| `400`  | Empty file, empty or unsafe folder, invalid public ID, or invalid option |
| `404`  | Deleting a resource that does not exist                                  |
| `413`  | File larger than the size limit                                          |
| `415`  | Content is not an allowed type                                           |
| `500`  | Missing Cloudinary credentials                                           |
| `502`  | Cloudinary rejected or failed the request                                |

Folders are normalized and validated: leading and trailing slashes are removed, and empty segments, `.`, `..`, control characters, and names over 255 characters are rejected.

## 🔐 Security best practices

### 1. Keep the API secret on the server

Never expose `CLOUDINARY_API_SECRET` to the browser or commit it to version control.

### 2. Do not trust `file.type`

It is set by the client. This package checks the real file signature instead, so a script renamed to `.png` or `.pdf` is rejected.

### 3. Keep size limits tight

Set `maxFileSize` to the smallest value your use case allows, for example 1 to 2 MB for avatars.

### 4. Allow only the types you need

Restrict `allowedTypes` per use case. For example, an avatar endpoint should accept only `image/jpeg`, `image/png`, and `image/webp`.

### 5. Be careful with SVG

SVG files can contain scripts, so they are rejected by default. Only add `'image/svg+xml'` to `allowedTypes` if you trust the uploader or sanitize the file yourself.

### 6. Do not let users choose the folder

Build the `folder` argument on the server, for example from the authenticated user's ID, instead of passing user input directly.

## 🧩 Integration with RiserBob

```ts
import { CloudinaryManager } from '@riser-bob/cloudinary'

const cloudinary = CloudinaryManager.fromEnv()

bob.spongPost('/avatar', async (spongReq, spongRes) => {
	const form = await spongReq.request.formData()
	const file = form.get('avatar')

	if (!(file instanceof File)) {
		return spongRes.SpongBadRequest({ message: 'Avatar file is required' })
	}

	const image = await cloudinary.images.uploadImage(file, 'avatars', {
		maxFileSize: 2 * 1024 * 1024,
		allowedTypes: ['image/jpeg', 'image/png', 'image/webp']
	})

	return spongRes.SpongOK({ url: image.url, publicId: image.publicId })
})
```

**Integration note:** The example assumes that `HttpError` thrown by the manager is converted into an HTTP response by your RiserBob error handling, and that `SpongBadRequest` exists in your response helper. Adapt it if your application behaves differently.

## 🧪 Testing

```bash
bun test
```

The tests mock the Cloudinary SDK, so no credentials or network access are needed. The test suite covers:

- Constructor and `fromEnv()` validation.
- Size, folder, and public ID validation.
- Content-based type detection for images, files, and videos.
- Single and batch uploads, including cleanup after a failed batch.
- Single and batch deletion.
- URL building and public ID extraction.

Always run the full test suite before publishing a new release.

## 📚 Dependencies

- [`cloudinary`](https://www.npmjs.com/package/cloudinary) for uploads, deletion, and URL generation.
- `riser-bob` (peer dependency) for `HttpError`.

## 🤝 Contributing

Contributions, bug reports, and suggestions are welcome.

1. Reproduce the issue or describe the proposed improvement.
2. Add or update tests.
3. Run the full test suite.
4. Update documentation when the public API changes.

Please ensure validation-related changes preserve the content-based type checks and size limits.

## 📄 License

See the [`LICENSE`](LICENSE) file in this repository.

## 🧽 Part of the RiserBob ecosystem

`@riser-bob/cloudinary` provides focused media upload management that can be used independently or integrated into RiserBob applications.

**Simple API. Explicit validation. Predictable behavior.**
