declare module "cloudflare:workers" {
  export const env: {
    readonly API: {
      readonly fetch: typeof globalThis.fetch;
    };
  };
}
