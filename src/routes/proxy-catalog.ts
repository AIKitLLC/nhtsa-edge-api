import { getVpicStore } from "../vpic/worker-store";
import { catalogFrom, type CatalogNames } from "../validation/upstream-path";

/** Makes and variable names from the bundled vPIC assets, for proxy value checks. */
export async function loadProxyCatalog(assets: Fetcher): Promise<CatalogNames> {
  const store = getVpicStore(assets);
  const [makes, core] = await Promise.all([store.getMakes(), store.getCore()]);
  return catalogFrom(makes, core.elements);
}
