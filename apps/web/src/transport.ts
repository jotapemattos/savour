import { createIsomorphicFn } from "@tanstack/react-start";

import { browserTransport } from "#/client/browser-transport";
import { bindingTransport } from "#/server/binding-transport";

export const apiTransport = createIsomorphicFn()
  .server(bindingTransport)
  .client(browserTransport);
