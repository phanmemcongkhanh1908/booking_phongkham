import { AsyncLocalStorage } from "async_hooks";

export interface AppContext {
  tenantId?: string | null;
  isFullAdmin?: boolean;
}

export const appContext = new AsyncLocalStorage<AppContext>();
