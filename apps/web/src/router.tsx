import { createSavourRouter } from "./savour-router";
import { cookieSession } from "./server/session-functions";
import { apiTransport } from "./transport";

export const getRouter = () =>
  createSavourRouter(apiTransport(), cookieSession);
