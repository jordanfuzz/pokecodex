import request from 'supertest'

// Logs in through the dev-login route (dev-only, most recently seen user)
// and returns an agent that carries the session cookie.
export const loginAgent = async app => {
  const agent = request.agent(app)
  await agent.get('/api/auth/dev-login')
  return agent
}
