export { PreviewStage } from "@savour/api/database-resources";

const previewResourceTypes = new Map([
  ["Api", "Cloudflare.Worker"],
  ["BetterAuthSecret", "Alchemy.Random"],
  ["Database", "Neon.Branch"],
  ["Hyperdrive", "Cloudflare.Hyperdrive"],
]);

export const previewResourcesAllowed = (
  resources: Readonly<Record<string, { readonly Type: string }>>
): boolean =>
  Object.keys(resources).length === previewResourceTypes.size &&
  Object.entries(resources).every(
    ([id, resource]) => previewResourceTypes.get(id) === resource.Type
  );
