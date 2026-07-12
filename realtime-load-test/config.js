export const config = {
  apiBase: process.env.CRM_API_BASE || 'https://api.crm.swagprinthub.com',
  visitorApiBase: process.env.VISITOR_API_BASE || 'https://api.chat.crm.swagprinthub.com',
  visitorOrigin: process.env.VISITOR_ORIGIN || 'https://nst.staging.rev9solutions.com',
  agentEmail: process.env.AGENT_EMAIL || '',
  agentPassword: process.env.AGENT_PASSWORD || '',
  widgetPublicKey:
    process.env.WIDGET_PUBLIC_KEY || '',
  widgetSiteId:
    process.env.WIDGET_SITE_ID || 'cmrd7thsz0000ncqggnafo1ri',

  visitorCount: Number(process.env.VISITOR_COUNT || 10),
  agentCount: Number(process.env.AGENT_COUNT || 10),
  rampUpMs: Number(process.env.RAMP_UP_MS || 30000),
  holdMs: Number(process.env.HOLD_MS || 60000),
  connectTimeoutMs: Number(process.env.CONNECT_TIMEOUT_MS || 20000),
  eventWaitMs: Number(process.env.EVENT_WAIT_MS || 10000),
  loginStaggerMs: Number(process.env.LOGIN_STAGGER_MS || 500),

  agentSocketUrl: process.env.AGENT_SOCKET_URL || null,
  visitorSocketUrl: process.env.VISITOR_SOCKET_URL || null,
  socketPath: '/socket.io',
};

export function agentSocketOrigin(apiBase = config.apiBase) {
  return (config.agentSocketUrl || `${apiBase.replace(/\/$/, '')}/realtime`);
}

export function visitorSocketOrigin(apiBase = config.apiBase) {
  return (config.visitorSocketUrl || `${apiBase.replace(/\/$/, '')}/widget`);
}
