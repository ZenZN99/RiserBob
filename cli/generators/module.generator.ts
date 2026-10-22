import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

function toPascalCase(value: string): string {
	return value
		.split(/[-_\s]+/)
		.filter(Boolean)
		.map((part) => part[0]!.toUpperCase() + part.slice(1).toLowerCase())
		.join('')
}

function toKebabCase(value: string): string {
	return value
		.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
		.toLowerCase()
		.replace(/[_\s]+/g, '-')
}

function isValidModuleName(name: string): boolean {
	return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)
}

export async function generateModule(name: string): Promise<void> {
	if (!isValidModuleName(name)) {
		throw new Error(
			'Invalid module name. Use letters, numbers, "-" or "_", starting with a letter.'
		)
	}

	const moduleName = toKebabCase(name)
	const className = toPascalCase(moduleName)

	const directory = path.resolve(process.cwd(), 'src', 'modules', moduleName)

	const files: Record<string, string> = {
		[`${moduleName}.controller.ts`]: `import type { SpongHandler } from "riser-bob";

export class ${className}Controller {
  readonly create: SpongHandler = async (spongReq, spongRes) => {
    // TODO: Implement creation logic.
  };

  readonly findAll: SpongHandler = async (spongReq, spongRes) => {
    // TODO: Implement fetching all records.
  };

  readonly findOne: SpongHandler = async (spongReq, spongRes) => {
    // TODO: Implement fetching a record by ID.
  };

  readonly update: SpongHandler = async (spongReq, spongRes) => {
    // TODO: Implement updating a record.
  };

  readonly delete: SpongHandler = async (spongReq, spongRes) => {
    // TODO: Implement deleting a record.
  };

  verifyToken(token: string) {
    // TODO: Implement token verification.
    return null;
  }
}
`,

		[`${moduleName}.route.ts`]: `import type { RiserBob } from "riser-bob";
import { AuthMiddleware } from "riser-bob";
import { ${className}Controller } from "./${moduleName}.controller";

export class ${className}Router {
  constructor(
    private readonly bob: RiserBob,
    private readonly controller: ${className}Controller,
    private readonly authMiddleware: AuthMiddleware,
  ) {}

  register(): void {
    // Public routes
    this.bob.spongPost("/api/${moduleName}", this.controller.create);
    this.bob.spongGet("/api/${moduleName}", this.controller.findAll);
    this.bob.spongGet("/api/${moduleName}/:id", this.controller.findOne);

    // Protected routes
    this.bob.spongPut(
      "/api/${moduleName}/:id",
      this.controller.update,
      this.authMiddleware.middleware,
    );

    this.bob.spongDelete(
      "/api/${moduleName}/:id",
      this.controller.delete,
      this.authMiddleware.middleware,
    );
  }
}
`,

		[`${moduleName}.module.ts`]: `import type { RiserBob } from "riser-bob";
import { AuthMiddleware } from "riser-bob";
import { ${className}Controller } from "./${moduleName}.controller";
import { ${className}Router } from "./${moduleName}.route";

export class ${className}Module {
  register(bob: RiserBob): void {
    const controller = new ${className}Controller();

    const authMiddleware = new AuthMiddleware((token) =>
      controller.verifyToken(token),
    );

    const router = new ${className}Router(
      bob,
      controller,
      authMiddleware,
    );

    router.register();
  }
}
`
	}

	// Create the directory if needed.
	await mkdir(directory, { recursive: true })

	// Check all files before writing any of them.
	for (const fileName of Object.keys(files)) {
		const filePath = path.join(directory, fileName)

		if (await Bun.file(filePath).exists()) {
			throw new Error(
				`File "${path.relative(process.cwd(), filePath)}" already exists.`
			)
		}
	}

	// "wx" prevents overwriting a file created between the check and write.
	const createdFiles: string[] = []

	try {
		for (const [fileName, content] of Object.entries(files)) {
			const filePath = path.join(directory, fileName)

			await writeFile(filePath, content, { flag: 'wx' })
			createdFiles.push(filePath)
		}
	} catch (error) {
		// Roll back files created by this run if generation fails.
		const { unlink } = await import('node:fs/promises')

		await Promise.all(
			createdFiles.map((filePath) => unlink(filePath).catch(() => {}))
		)

		throw error
	}

	console.log(`🧽 Module "${moduleName}" generated successfully!`)
	console.log(`📁 ${path.relative(process.cwd(), directory)}`)

	for (const fileName of Object.keys(files)) {
		console.log(`   └── ${fileName}`)
	}
}
