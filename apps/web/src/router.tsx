import { createSavourRouter } from "./savour-router";
import { apiTransport } from "./transport";

export const getRouter = () => createSavourRouter(apiTransport());
