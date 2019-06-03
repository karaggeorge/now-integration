import { withUiHook, HandlerOptions } from '@zeit/integration-utils';

const pathMatch = require('path-match');

const match = pathMatch({
  sensitive: false,
  strict: false,
  end: false,
});

export type Context = {[key: string]: any};
export type Params = {[key: string]: any};
export type Store = {[key: string]: any};

export interface Utils {
  context: Context;
  params?: Params;
  renderRoute: (route: string) => Promise<any>;
  store: Store;
  projectStore?: Store;
  saveStore: () => Promise<Store>;
  get: <T>(key: string) => T;
  projectId?: string | null;
  action: string;
}

export type RouteOptions = HandlerOptions & {utils: Utils};

export type MiddlewareCallback = (options: RouteOptions, next: () => void) => Promise<any>;
export type RouteCallback = (options: RouteOptions) => Promise<any>;

export type IntegrationOptions = {
  defaultRoute: RouteCallback;
}

export default class Integration {
  middlewares: {pattern?: string[], callback: MiddlewareCallback}[] = [];
  routes: {pattern: string[], callback: RouteCallback}[] = [];
  defaultRoute: {callback: RouteCallback};

  constructor(options: IntegrationOptions) {
    this.middlewares = [];
    this.routes = [];
    this.defaultRoute = {callback: options.defaultRoute};
  }

  extend = (plugin: (integration: Integration) => void) => plugin(this);

  use(pattern: string | string[], ...callbacks: MiddlewareCallback[]): void;
  use(...callbacks: MiddlewareCallback[]): void;
  use(patternOrCb: string | string[] | MiddlewareCallback, ...callbacks: MiddlewareCallback[]): void {
    if (typeof patternOrCb === 'function') {
      this.middlewares.push(...[patternOrCb, ...callbacks].map(cb => ({callback: cb})));
    } else {
      const pattern = Array.isArray(patternOrCb) ? patternOrCb : [patternOrCb];
      this.middlewares.push(...callbacks.map(cb => ({pattern, callback: cb})));
    }
  };

  render = (pattern: string | string[], callback: RouteCallback) => {
    const routePattern = Array.isArray(pattern) ? pattern : [pattern];
    this.routes.push({pattern: routePattern, callback});
  }

  renderRoute = (path: string, options: RouteOptions): Promise<any> => {
    const route = this.routes.find(({pattern}) => pattern.some(p => match(p)(path)));

    if (route) {
      const p = route.pattern.find(p => match(p)(path));
      const params = match(p)(path);
      return route.callback({...options, utils: {...options.utils, params}});
    } else {
      return this.defaultRoute.callback(options);
    }
  }

  get handler() {
    return withUiHook(async (handlerOptions: HandlerOptions) => {
      const {payload: {action, projectId, clientState}, zeitClient} = handlerOptions;
      const context = {};
      const store = await zeitClient.getMetadata() || {};
      if (projectId && !store[projectId]) {
        store[projectId] = {};
      }
      const projectStore = projectId && store[projectId];
      const saveStore = async () => zeitClient.setMetadata(store);

      const options = {
        ...handlerOptions,
        utils: {
          get: <T>(key: string): T => clientState[key],
          context,
          store,
          projectStore,
          saveStore,
          renderRoute: (path: string): Promise<any> => this.renderRoute(path, options),
          projectId,
          action
        }
      };

      for (const {callback, pattern} of this.middlewares) {
        let params: Params;

        if (pattern) {
          params = pattern.map(p => match(p)(action)).find(p => p !== false);

          if (!params) {
            continue;
          }
        }

        const {next, result} = await new Promise<{next: boolean, result?: any}>(async (resolve, reject) => {
          callback({...options, utils: {...options.utils, params}}, () => {
            resolve({next: true});
          }).then((result: any) => {
            resolve({next: false, result});
          }).catch(reject);
        });

        if (!next) {
          return result;
        }
      }

      return options.utils.renderRoute(action);
    });
  }
}
