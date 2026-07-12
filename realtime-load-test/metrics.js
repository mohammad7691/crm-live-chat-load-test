export class Metrics {
  constructor() {
    this.startedAt = Date.now();
    this.samples = [];
    this.counters = {};
    this.errors = [];
  }

  inc(name, by = 1) {
    this.counters[name] = (this.counters[name] || 0) + by;
  }

  record(name, value, tags = {}) {
    this.samples.push({ name, value, tags, at: Date.now() });
  }

  error(scope, message, detail = null) {
    this.errors.push({ scope, message, detail, at: new Date().toISOString() });
    this.inc(`error.${scope}`);
  }

  percentile(values, p) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  summaryFor(name) {
    const values = this.samples.filter((s) => s.name === name).map((s) => s.value);
    if (!values.length) {
      return { count: 0, min: 0, avg: 0, p95: 0, max: 0 };
    }
    const sum = values.reduce((a, b) => a + b, 0);
    return {
      count: values.length,
      min: Math.min(...values),
      avg: Math.round(sum / values.length),
      p95: this.percentile(values, 95),
      max: Math.max(...values),
    };
  }

  toReport(config) {
    const durationMs = Date.now() - this.startedAt;
    const agentConnectOk = this.counters['agent.socket.connect.ok'] || 0;
    const agentConnectFail = this.counters['agent.socket.connect.fail'] || 0;
    const visitorConnectOk = this.counters['visitor.socket.connect.ok'] || 0;
    const visitorConnectFail = this.counters['visitor.socket.connect.fail'] || 0;
    const agentLoginOk = this.counters['agent.login.ok'] || 0;
    const agentLoginFail = this.counters['agent.login.fail'] || 0;
    const visitorSessionOk = this.counters['visitor.session.ok'] || 0;
    const visitorSessionFail = this.counters['visitor.session.fail'] || 0;
    const visitorMsgRestOk = this.counters['visitor.message.rest.ok'] || 0;
    const visitorMsgRestFail = this.counters['visitor.message.rest.fail'] || 0;
    const agentPushReceived = this.counters['agent.event.visitorMessage'] || 0;
    const visitorPushReceived = this.counters['visitor.event.chat.message'] || 0;
    const sessionCreatedEvents = this.counters['agent.event.sessionCreated'] || 0;
    const agentAcceptOk = this.counters['agent.accept.ok'] || 0;
    const agentReplyOk = this.counters['agent.reply.ok'] || 0;

    const totalConnectAttempts = agentConnectOk + agentConnectFail + visitorConnectOk + visitorConnectFail;
    const totalConnectFails = agentConnectFail + visitorConnectFail;

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        durationMs,
        durationHuman: `${Math.round(durationMs / 1000)}s`,
      },
      config: {
        apiBase: config.apiBase,
        agentSocketUrl: config.agentSocketUrl || `${config.apiBase}/realtime`,
        visitorSocketUrl: config.visitorSocketUrl || `${config.apiBase}/widget`,
        visitorCount: config.visitorCount,
        agentCount: config.agentCount,
        rampUpMs: config.rampUpMs,
        holdMs: config.holdMs,
      },
      summary: {
        agentLogin: { ok: agentLoginOk, fail: agentLoginFail },
        agentSocketConnect: { ok: agentConnectOk, fail: agentConnectFail },
        visitorSessionCreate: { ok: visitorSessionOk, fail: visitorSessionFail },
        visitorSocketConnect: { ok: visitorConnectOk, fail: visitorConnectFail },
        visitorMessageRest: { ok: visitorMsgRestOk, fail: visitorMsgRestFail },
        agentActions: {
          acceptOk: agentAcceptOk,
          replyOk: agentReplyOk,
        },
        realtimePush: {
          agentReceivedVisitorMessage: agentPushReceived,
          agentReceivedSessionCreated: sessionCreatedEvents,
          visitorReceivedAgentReply: visitorPushReceived,
        },
        socketConnectErrorRate:
          totalConnectAttempts > 0
            ? Number(((totalConnectFails / totalConnectAttempts) * 100).toFixed(2))
            : 0,
      },
      latenciesMs: {
        agentLogin: this.summaryFor('agent.login.ms'),
        agentSocketConnect: this.summaryFor('agent.socket.connect.ms'),
        visitorSessionCreate: this.summaryFor('visitor.session.ms'),
        visitorSocketConnect: this.summaryFor('visitor.socket.connect.ms'),
        visitorMessageRest: this.summaryFor('visitor.message.rest.ms'),
        agentPushLatency: this.summaryFor('agent.push.visitorMessage.ms'),
        visitorPushLatency: this.summaryFor('visitor.push.chat.message.ms'),
      },
      counters: this.counters,
      errors: this.errors.slice(0, 100),
    };
  }
}
