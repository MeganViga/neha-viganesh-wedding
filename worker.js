const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function payload(state) {
  const neha = Boolean(state && state.neha);
  const viganesh = Boolean(state && state.viganesh);
  return { neha, viganesh, married: neha && viganesh };
}

export class VowStore {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async getState() {
    return (await this.ctx.storage.get("vows")) || { neha: false, viganesh: false };
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/api/state" && request.method === "GET") {
      return json(payload(await this.getState()));
    }

    if (url.pathname === "/api/yes" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      if (body.who !== "neha" && body.who !== "viganesh") {
        return json({ error: "who must be neha or viganesh" }, 400);
      }
      const state = await this.getState();
      state[body.who] = true;
      await this.ctx.storage.put("vows", state);
      return json(payload(state));
    }

    if (url.pathname === "/api/reset" && request.method === "POST") {
      const state = { neha: false, viganesh: false };
      await this.ctx.storage.put("vows", state);
      return json(payload(state));
    }

    return json({ error: "Not found" }, 404);
  }
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      const id = env.VOW_STORE.idFromName("neha-viganesh");
      return env.VOW_STORE.get(id).fetch(request);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return json({ error: "Not found" }, 404);
  },
};
