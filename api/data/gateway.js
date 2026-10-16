import { authenticateGatewayRequest, dispatchUserData, GatewayError, IdentityLinkError } from '../../server/appwriteGateway.js'

function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  return res.status(status).json(body)
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' })
  try {
    const { config, account } = await authenticateGatewayRequest(req)
    const result = await dispatchUserData(config, account, req.body)
    return send(res, 200, result)
  } catch (error) {
    if (error instanceof GatewayError || error instanceof IdentityLinkError) {
      return send(res, error.status, { error: error.message })
    }
    console.error('Appwrite user data gateway failed', error)
    return send(res, 503, { error: 'The user data gateway is temporarily unavailable.' })
  }
}
