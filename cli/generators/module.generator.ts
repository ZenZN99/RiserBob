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

export async function generateModule(name: string, withService = false): Promise<void> {
  if (!isValidModuleName(name)) {
    throw new Error(
      'Invalid module name. Use letters, numbers, "-" or "_", starting with a letter.',
    )
  }

  const moduleName = toKebabCase(name)
  const className = toPascalCase(moduleName)
  const singularName = toSingular(moduleName)
  const singularClassName = toPascalCase(singularName)

  const directory = path.resolve(process.cwd(), 'src', 'modules', moduleName)
  const serviceName = className.charAt(0).toLowerCase() + className.slice(1)
  const controllerName = className.charAt(0).toLowerCase() + className.slice(1)

  const serviceTemplate = `export class ${className}Service {
	constructor() {}
  async create() {
    // TODO: Implement creation logic.
  }

  async findAll() {
    // TODO: Implement fetching all records.
  }

  async findOne() {
    // TODO: Implement fetching a record by ID.
  }

  async update() {
    // TODO: Implement updating a record.
  }

  async delete() {
    // TODO: Implement deleting a record.
  }
}
`

  const files: Record<string, string> = {
    ...(withService
      ? {
          [`${moduleName}.service.ts`]: serviceTemplate,
        }
      : {}),

    [`${moduleName}.controller.ts`]: `import type { SpongHandler } from "riser-bob"
${withService ? `import { ${className}Service } from "./${moduleName}.service"` : ''}

export class ${className}Controller {
  ${
    withService
      ? `constructor(
    private readonly ${serviceName}Service: ${className}Service,
  ) {}`
      : 'constructor() {}'
  }

  readonly create: SpongHandler = async (spongReq, spongRes) => {
    // TODO: Implement creation logic.
    ${withService ? `const result = await this.${serviceName}Service.create()` : ''}
  }

  readonly findAll: SpongHandler = async (spongReq, spongRes) => {
    // TODO: Implement fetching all records.
    ${withService ? `const result = await this.${serviceName}Service.findAll()` : ''}
  }

  readonly findOne: SpongHandler = async (spongReq, spongRes) => {
    // TODO: Implement fetching a record by ID.
    ${withService ? `const result = await this.${serviceName}Service.findOne()` : ''}
  }

  readonly update: SpongHandler = async (spongReq, spongRes) => {
    // TODO: Implement updating a record.
    ${withService ? `const result = await this.${serviceName}Service.update()` : ''}
  }

  readonly delete: SpongHandler = async (spongReq, spongRes) => {
    // TODO: Implement deleting a record.
    ${withService ? `const result = await this.${serviceName}Service.delete()` : ''}
  }

  verifyToken(token: string) {
    // TODO: Implement token verification.
    return null
  }
}
`,

    [`${moduleName}.route.ts`]: `import type { RiserBob } from "riser-bob"
import { AuthMiddleware } from "riser-bob"
import { ${className}Controller } from "./${moduleName}.controller"

export class ${className}Router {
  constructor(
    private readonly bob: RiserBob,
    private readonly controller: ${className}Controller,
    private readonly authMiddleware: AuthMiddleware,
  ) {}

  register(): void {
    this.bob.spongGroup("/api/${moduleName}", (group) => {
      // Public routes
      group.spongGet("/", this.controller.findAll)
      group.spongGet("/:id", this.controller.findOne)

      // Protected routes
      group.spongGroup(
        "/",
        (protectedGroup) => {
          protectedGroup.spongPost("/", this.controller.create)
          protectedGroup.spongPut("/:id", this.controller.update)
          protectedGroup.spongDelete("/:id", this.controller.delete)
        },
        this.authMiddleware.middleware,
      )
    })
  }
}
`,

    [`${moduleName}.module.ts`]: `import type { RiserBob } from "riser-bob"
import { AuthMiddleware } from "riser-bob"
import { ${className}Controller } from "./${moduleName}.controller"
import { ${className}Router } from "./${moduleName}.route"
${withService ? `import { ${className}Service } from "./${moduleName}.service"` : ''}

export class ${className}Module {
  register(bob: RiserBob): void {
    ${
      withService
        ? `const ${serviceName}Service = new ${className}Service()
    const ${controllerName}Controller = new ${className}Controller(${serviceName}Service)`
        : `const ${controllerName}Controller = new ${className}Controller()`
    }

    const authMiddleware = new AuthMiddleware(
      (token) => ${controllerName}Controller.verifyToken(token),
      {
        mode: "bearer",
      },
    )

    const router = new ${className}Router(
      bob,
      ${controllerName}Controller,
      authMiddleware,
    )

    router.register()
  }
}
`,

    [`schemas/${singularName}.schema.ts`]: `export const ${singularClassName}Schema = {}
`,
    ['rules/create.ts']: `
    import { defineSchema, rules } from 'riser-bob'

export const Create${singularClassName}Rule = defineSchema({})
`,

    ['rules/update.ts']: `import { Create${singularClassName}Rule } from "./create"

export const Update${singularClassName}Rule = Create${singularClassName}Rule
`,

    [`tests/${moduleName}.controller.test.ts`]: `import { describe, expect, test } from "bun:test"
import { ${className}Controller } from "../${moduleName}.controller"
${withService ? `import { ${className}Service } from "../${moduleName}.service"` : ''}

describe("${className}Controller", () => {
  const ${controllerName}Controller = new ${className}Controller(${withService ? `new ${className}Service()` : ''})

  test("should be defined", () => {
    expect( ${controllerName}Controller).toBeDefined()
  })

  test("should expose all route handlers", () => {
    expect(typeof  ${controllerName}Controller.create).toBe("function")
    expect(typeof  ${controllerName}Controller.findAll).toBe("function")
    expect(typeof  ${controllerName}Controller.findOne).toBe("function")
    expect(typeof  ${controllerName}Controller.update).toBe("function")
    expect(typeof  ${controllerName}Controller.delete).toBe("function")
  })
})
`,
    ...(withService
      ? {
          [`tests/${moduleName}.service.test.ts`]: `import { describe, expect, test } from "bun:test"
import { ${className}Service } from "../${moduleName}.service"

describe("${className}Service", () => {
  const ${serviceName}Service = new ${className}Service()

  test("should be defined", () => {
    expect(${serviceName}Service).toBeDefined()
  })

  test("should expose all service methods", () => {
    expect(typeof ${serviceName}Service.create).toBe("function")
    expect(typeof ${serviceName}Service.findAll).toBe("function")
    expect(typeof ${serviceName}Service.findOne).toBe("function")
    expect(typeof ${serviceName}Service.update).toBe("function")
    expect(typeof ${serviceName}Service.delete).toBe("function")
  })
})
`,
        }
      : {}),
  }

  await mkdir(directory, { recursive: true })

  // Check every target before creating files.
  for (const relativePath of Object.keys(files)) {
    const filePath = path.join(directory, relativePath)

    if (await Bun.file(filePath).exists()) {
      throw new Error(`File "${path.relative(process.cwd(), filePath)}" already exists.`)
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
    await Promise.all(createdFiles.map((filePath) => unlink(filePath).catch(() => {})))

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
