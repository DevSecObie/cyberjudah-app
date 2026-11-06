import worker from './worker'

// Only these publications have been imported and smoke-tested in CyberJudah's resource databases.
export default {
  fetch(request: Request, bindings: Env, ctx: ExecutionContext) {
    const path = new URL(request.url).pathname
    if (request.method !== 'GET') {
      return new Response(null, { status: 405, headers: { allow: 'GET' } })
    }
    if (path !== '/health' && !path.startsWith('/v1/naves/')) {
      return new Response(null, { status: 404 })
    }
    return worker.fetch(request, bindings, ctx)
  },
}
