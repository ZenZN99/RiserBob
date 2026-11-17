import { describe, expect, test } from 'bun:test'
import { Validator as OpenAPISchemaValidator } from '@seriousme/openapi-schema-validator'
import { passwordRules, defineSchema, rules } from 'riser-bob'
import { OpenAPI, type OpenAPIRoute } from '../../src/index'
import { createApp, options } from '../helpers/app'

// Validates the generated document against the official OpenAPI 3.1 JSON Schema.
describe('generated documents are valid OpenAPI 3.1', () => {
  test('a document exercising every feature', async () => {
    const ok = { 200: { description: 'ok' } }
    const routes: Record<string, OpenAPIRoute> = {
      list: {
        method: 'GET',
        path: '/users',
        summary: 'List',
        tags: ['Users'],
        security: ['BearerAuth'],
        request: {
          query: defineSchema({
            page: rules(['nullable', 'number', 'min:1']),
            q: rules(['nullable', 'string']),
          }),
          headers: defineSchema({ 'x-tenant': rules(['required', 'string']) }),
        },
        response: { ...ok, 401: { description: 'no' } },
      },
      create: {
        method: 'POST',
        path: '/users',
        request: {
          body: defineSchema({
            name: rules(['required', 'string', 'minLength:2', 'maxLength:20']),
            email: rules(['required', 'email']),
            role: rules(['nullable', 'enum:admin,user']),
            tags: rules(['nullable', 'array', 'maxItems:5']),
            site: rules(['nullable', 'url']),
            active: rules(['nullable', 'boolean']),
            password: passwordRules(['required', 'string', 'minLength:8', 'confirmed']),
          }),
        },
        response: {
          201: {
            description: 'created',
            schema: defineSchema({ id: rules(['required', 'string']) }),
          },
        },
      },
      get: {
        method: 'GET',
        path: '/users/:id',
        request: { params: defineSchema({ id: rules(['required', 'number']) }) },
        response: { ...ok, 404: { description: 'nf' } },
      },
      remove: {
        method: 'DELETE',
        path: '/users/{id}',
        deprecated: true,
        response: { 204: { description: 'gone' } },
      },
      upload: {
        method: 'PUT',
        path: '/users/:id/avatar',
        request: {
          body: defineSchema({ caption: rules(['nullable', 'string']) }),
          contentType: 'multipart/form-data',
        },
        response: ok,
      },
      head: { method: 'HEAD', path: '/users', response: ok },
    }

    const app = createApp(
      Object.values(routes)
        .map((r) => [r.method, r.path] as const)
        .filter((_, i, all) => all.indexOf(_) === i),
    )
    const openapi = new OpenAPI(
      options({
        info: {
          title: 'Spec',
          version: '1.0.0',
          description: 'd',
          termsOfService: 'https://example.com/tos',
          contact: { name: 'n', email: 'a@b.co', url: 'https://example.com' },
          license: { name: 'MIT', url: 'https://example.com/l' },
        },
        servers: [{ url: 'https://api.example.com' }],
        securitySchemes: {
          BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          Key: { type: 'apiKey', in: 'header', name: 'X-Key' },
          Cookie: { type: 'apiKey', in: 'cookie', name: 'sid' },
        },
        routes,
      }),
    )
    const document = openapi.generate(app)

    const validator = new OpenAPISchemaValidator()
    const result = await validator.validate(JSON.parse(JSON.stringify(document)))
    expect(result.errors ?? null).toBeNull()
    expect(result.valid).toBe(true)
    expect(validator.version).toBe('3.1')
  })

  test('the validator would catch an invalid document (sanity check of the check)', async () => {
    const result = await new OpenAPISchemaValidator().validate({
      openapi: '3.1.0',
      info: { title: 'x' },
      paths: {},
    })
    expect(result.valid).toBe(false)
  })
})
