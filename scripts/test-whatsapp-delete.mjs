import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

// Executa a rota real com dependências isoladas: nunca conecta ao banco ou à Meta.
function loadRoute({ authenticated = true, limited = false } = {}) {
  const calls = { database: 0, meta: 0 }
  const database = new Proxy({}, {
    get() {
      return async () => {
        calls.database++
        return [{ id: 'message', wa_message_id: 'wamid.test', timestamp: new Date() }]
      }
    },
  })
  const dependencies = {
    'next/server': { NextResponse: { json: (body, init = {}) => Response.json(body, init) } },
    '@/lib/supabase/server': {
      createClient: async () => ({ auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'user' } : null } }) } }),
    },
    '@/lib/rate-limit': { rateLimit: async () => ({ success: !limited, message: 'Limite atingido' }) },
    '@/lib/prisma': { prisma: { waMessage: database, log: database } },
    '@/lib/whatsapp/meta-client': { deleteMessage: async () => { calls.meta++; throw new Error('Unsupported delete request') } },
  }
  const source = readFileSync(new URL('../src/app/api/whatsapp/messages/delete/route.ts', import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } })
  const context = {
    exports: {}, console: { error() {} },
    require: (name) => {
      assert.ok(name in dependencies, `Dependência não isolada: ${name}`)
      return dependencies[name]
    },
  }
  vm.runInNewContext(outputText, context)
  return { DELETE: context.exports.DELETE, calls }
}

test('exclusão indisponível é erro explícito sem consultar/alterar banco ou chamar Meta', async () => {
  const { DELETE, calls } = loadRoute()
  const response = await DELETE({ json: async () => ({ messageIds: ['message'], conversationId: 'conversation' }) })
  assert.equal(response.status, 501)
  const body = await response.json()
  assert.equal(body.code, 'WHATSAPP_DELETE_UNSUPPORTED')
  assert.equal(body.deleted, 0)
  assert.match(body.error, /não permite apagar/)
  assert.deepEqual(calls, { database: 0, meta: 0 })
})

test('rota continua exigindo autenticação', async () => {
  const { DELETE, calls } = loadRoute({ authenticated: false })
  assert.equal((await DELETE()).status, 401)
  assert.deepEqual(calls, { database: 0, meta: 0 })
})

test('rota preserva limite de requisições', async () => {
  const { DELETE, calls } = loadRoute({ limited: true })
  assert.equal((await DELETE()).status, 429)
  assert.deepEqual(calls, { database: 0, meta: 0 })
})
