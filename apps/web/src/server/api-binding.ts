import { env } from "cloudflare:workers";

export const apiFetch: typeof globalThis.fetch = env.API.fetch.bind(env.API);
