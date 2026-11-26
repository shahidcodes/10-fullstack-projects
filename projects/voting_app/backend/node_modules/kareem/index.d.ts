declare module "kareem" {
  interface FilterOption {
    /** Predicate that receives each registered hook and returns whether to run it. */
    filter?: (hook: any) => boolean;
  }

  interface ExecPostOptions extends FilterOption {
    /** Error to pass to error-handling middleware. */
    error?: Error;
    /** Force a consistent number of arguments passed to each post hook. */
    numCallbackParams?: number;
  }

  /**
   * Result of a `getOptions` callback: either a single `{ filter }` applied to both
   * pre and post hooks, or separate `{ pre, post }` options.
   */
  type GetOptionsResult = FilterOption | { pre?: FilterOption; post?: FilterOption };

  interface CreateWrapperSyncOptions {
    /** Receives the wrapper arguments and returns options for execPreSync/execPostSync. */
    getOptions?: (args: any[]) => GetOptionsResult;
  }

  interface CreateWrapperOptions extends Record<string, any> {
    /** Receives the wrapper arguments and returns options for execPre/execPost. */
    getOptions?: (args: any[]) => GetOptionsResult;
  }

  export default class Kareem {
    static skipWrappedFunction(...args: any[]): SkipWrappedFunction;
    static overwriteResult(...args: any[]): OverwriteResult;
    static overwriteArguments(...args: any[]): OverwriteArguments;

    pre(name: string | RegExp, fn: Function): this;
    pre(name: string | RegExp, options: Record<string, any>, fn: Function, error?: any, unshift?: boolean): this;
    post(name: string | RegExp, fn: Function): this;
    post(name: string | RegExp, options: Record<string, any>, fn: Function, unshift?: boolean): this;
    postError(name: string | RegExp, fn: Function, unshift?: boolean): this;
    postError(name: string | RegExp, options: Record<string, any>, fn: Function, unshift?: boolean): this;

    clone(): Kareem;
    merge(other: Kareem, clone?: boolean): this;

    createWrapper<T extends (...args: any[]) => any>(name: string, fn: T, context?: any, options?: CreateWrapperOptions): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>>;
    createWrapperSync<T extends (...args: any[]) => any>(name: string, fn: T, context?: any, options?: CreateWrapperSyncOptions): (...args: Parameters<T>) => ReturnType<T>;
    hasHooks(name: string): boolean;
    filter(fn: (hook: any) => boolean): Kareem;

    wrap(name: string, fn: Function, context: any, args: any[], options?: CreateWrapperOptions): Promise<any>;

    execPostSync(name: string, context: any, args: any[], options?: FilterOption): any[];
    execPost(name: string, context: any, args: any[], options?: ExecPostOptions): Promise<any[]>;
    execPreSync(name: string, context: any, args: any[], options?: FilterOption): any[];
    execPre(name: string, context: any, args: any[], options?: FilterOption): Promise<any[]>;
  }

  class SkipWrappedFunction {}
  class OverwriteResult {}
  class OverwriteArguments {}
}
