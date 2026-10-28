import { mkdir, writeFile, unlink } from 'node:fs/promises'
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

function toSingular(value: string): string {
	if (value.endsWith('ies') && value.length > 3) {
		return `${value.slice(0, -3)}y`
	}

	if (value.endsWith('s') && !value.endsWith('ss')) {
		return value.slice(0, -1)
	}

	return value
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
	const singularName = toSingular(moduleName)
	const singularClassName = toPascalCase(singularName)

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
    this.bob.spongGet("/api/${moduleName}", this.controller.findAll);
    this.bob.spongGet("/api/${moduleName}/:id", this.controller.findOne);

    // Protected routes
	this.bob.spongPost("/api/${moduleName}", 
	this.controller.create, 
	this.authMiddleware.middleware,
	);

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
`,

		[`schemas/${singularName}.schema.ts`]: `export class ${singularClassName}Schema {}
`,
		['rules/create.ts']: `import type { ValidationSchema } from "riser-bob";

export const Create${singularClassName}Rule = {} satisfies ValidationSchema;
`,

		['rules/update.ts']: `import { Create${singularClassName}Rule } from "./create";

export const Update${singularClassName}Rule = Create${singularClassName}Rule;
`,
		[`tests/${moduleName}.controller.test.ts`]: `import { describe, expect, test } from "bun:test";
import { ${className}Controller } from "../${moduleName}.controller";

describe("${className}Controller", () => {
  const controller = new ${className}Controller();

  test("should be defined", () => {
    expect(controller).toBeDefined();
  });

  test("should expose all route handlers", () => {
    expect(typeof controller.create).toBe("function");
    expect(typeof controller.findAll).toBe("function");
    expect(typeof controller.findOne).toBe("function");
    expect(typeof controller.update).toBe("function");
    expect(typeof controller.delete).toBe("function");
  });
});
`
	}

	await mkdir(directory, { recursive: true })

	// Check every target before creating files.
	for (const relativePath of Object.keys(files)) {
		const filePath = path.join(directory, relativePath)

		if (await Bun.file(filePath).exists()) {
			throw new Error(
				`File "${path.relative(process.cwd(), filePath)}" already exists.`
			)
		}
	}

	const createdFiles: string[] = []

	try {
		for (const [relativePath, content] of Object.entries(files)) {
			const filePath = path.join(directory, relativePath)

			await mkdir(path.dirname(filePath), { recursive: true })
			await writeFile(filePath, content, { flag: 'wx' })

			createdFiles.push(filePath)
		}
	} catch (error) {
		await Promise.all(
			createdFiles.map((filePath) => unlink(filePath).catch(() => {}))
		)

		throw error
	}

	console.log('')
	console.log(`🧽 Module "${moduleName}" generated successfully!`)
	console.log('')
	console.log(`📁 ${path.relative(process.cwd(), directory)}`)
	console.log('')

	for (const relativePath of Object.keys(files)) {
		console.log(`   └── ${relativePath}`)
	}
}
