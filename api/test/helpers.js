import request from 'supertest'

// Logs in through the dev-login route (dev-only, most recently seen user)
// and returns an agent that carries the session cookie.
export const loginAgent = async app => {
  const agent = request.agent(app)
  const res = await agent.get('/api/auth/dev-login')
  const setCookie = res.headers['set-cookie'] || []
  const gotSessionCookie = setCookie.some(c => c.startsWith('session='))
  if (res.status !== 302 || !gotSessionCookie) {
    throw new Error('dev-login failed — is the dev stack up?')
  }
  return agent
}
