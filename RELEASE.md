# RiserBob — Release Notes

## What's New RiserBob V1.1.0

This release expands RiserBob's validation system, authentication configuration, CLI workflow, and real-time communication support while keeping the framework's Sponge Zone personality.

## Validation Improvements

### Type-aware validation rules

- Expanded the validation rule types to support `array`, `minItems`, and `maxItems`.
- Added `url` validation for web URLs using `http:` and `https:`.
- Added `enum:value1,value2,...` to restrict a field to an explicit list of allowed values.
- Improved TypeScript schema typing so rules can be constrained by the selected field type and their order.
- Added stricter rule-ordering expectations, including terminal rules such as `email`, `url`, `enum`, and `boolean`.
- Prevented incompatible rule combinations, such as text-length rules on numbers or array-item rules on strings.
- Required an array field to declare at least one of `minItems` or `maxItems`.
- Tightened duplicate-rule checks for bounds where supported by the schema types.

### Runtime validation

- Added runtime checks for arrays and their item counts.
- Added runtime URL validation and enum membership checks.
- Preserved the existing validation approach and result shape, including `ValidationResult<T>` and field-based errors.
- Continued supporting existing rules such as `required`, `nullable`, `string`, `number`, `boolean`, `email`, `confirmed`, `min`, `max`, `minLength`, and `maxLength`.

> TypeScript schema checks help catch invalid rule combinations while editing, while runtime validation still checks incoming data. Runtime validation remains necessary.

## Authentication Middleware

- Improved `AuthMiddleware` configuration for cookie-based authentication.
- When using `mode: 'cookie'`, `cookieName` is required so the middleware knows which cookie to read.
- Kept authentication configuration explicit instead of silently guessing which cookie should contain the token.
- Preserve the existing authentication flow and token-verification behavior when upgrading; check your current middleware options before changing configuration.

## CLI Improvements

### Project creation

- Added the `create-riser-bob` project generator.
- Generates a starter project from the bundled template.
- Updates the generated `package.json` with the RiserBob dependency.
- Prints next steps after creating a project.

Create a project with:

```bash
bun create riser-bob my-app
```

### Module generation

- Improved the CLI's module scaffolding workflow.
- Generated modules include a controller, route, module, schema, validation-rule files, and a basic controller test.
- Added starter `Create` and `Update` validation-rule files.
- Organized generated files into a predictable module structure to make it easier to extend a feature.

Use the module generator command supported by your installed CLI version. For the previously used command format:

```bash
bun run riser-bob g module posts
```

If your project exposes `riser-bob` as a package script or binary, use the invocation documented by that project.

## Socket.IO Integration

- Added Socket.IO integration using `@socket.io/bun-engine`.
- HTTP routes and Socket.IO can run on the same port.
- Added support for configuring the Socket.IO server through `spongSocketIO()`.
- Tested the local flow with an HTTP endpoint and a Socket.IO client connecting to the same server and exchanging a message.

## Funny Mode and Developer Experience

- Continued the Sponge Zone personality in framework responses and developer-facing messages through the `funnyMode` work.
- Improved the overall developer experience around configuration and generated-project setup.
- Added a Prettier configuration to the starter template.

Check the configuration in your installed version to confirm the exact `funnyMode` option name, default, and scope before relying on a particular message style.

## Getting Started

Install RiserBob in a Bun project:

```bash
bun add riser-bob
```

Create a project:

```bash
bun create riser-bob my-app
cd my-app
bun install
bun run dev
```

## Upgrade Notes

- If you enable cookie authentication with `mode: 'cookie'`, provide the required `cookieName`.
- Review schemas that use `array`, `url`, or `enum` and ensure they follow the current rule ordering and bounds requirements.
- Confirm that the `riser-bob` version declared by the project generator matches a version actually published on npm.
- CLI commands can vary by how the CLI is installed or exposed in `package.json`; use the command supported by your installed version.

## Verification Notes

- Socket.IO was tested locally with HTTP and a Socket.IO client running together.
- Do not treat this document as confirmation that every package has been published or that every TypeScript edge case has been tested. Verify the final package contents and run the project's tests before tagging a formal release.

---

**Build APIs. Stay in the Sponge Zone!** 🧽🍍
