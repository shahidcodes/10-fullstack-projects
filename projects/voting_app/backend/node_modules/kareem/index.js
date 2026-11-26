'use strict';

/**
 * Create a new instance
 */
function Kareem() {
  this._pres = new Map();
  this._posts = new Map();
}

Kareem.skipWrappedFunction = function skipWrappedFunction() {
  if (!(this instanceof Kareem.skipWrappedFunction)) {
    return new Kareem.skipWrappedFunction(...arguments);
  }

  this.args = [...arguments];
};

Kareem.overwriteResult = function overwriteResult() {
  if (!(this instanceof Kareem.overwriteResult)) {
    return new Kareem.overwriteResult(...arguments);
  }

  this.args = [...arguments];
};

Kareem.overwriteArguments = function overwriteArguments() {
  if (!(this instanceof Kareem.overwriteArguments)) {
    return new Kareem.overwriteArguments(...arguments);
  }

  this.args = [...arguments];
};

/**
 * Execute all "pre" hooks for "name"
 * @param {String} name The hook name to execute
 * @param {*} context Overwrite the "this" for the hook
 * @param {Array} args arguments passed to the pre hooks
 * @param {Object} [options] Optional options
 * @param {Function} [options.filter] Filter function to select which hooks to run
 * @returns {Array} The potentially modified arguments
 */
Kareem.prototype.execPre = async function execPre(name, context, args, options) {
  let pres = this._pres.get(name) || [];
  if (options?.filter) {
    pres = pres.filter(options.filter);
  }
  const numPres = pres.length;
  let $args = args;
  let skipWrappedFunction = null;

  if (!numPres) {
    return $args;
  }

  for (const pre of pres) {
    try {
      const maybePromiseLike = pre.fn.apply(context, $args);
      if (isPromiseLike(maybePromiseLike)) {
        const result = await maybePromiseLike;
        if (result instanceof Kareem.overwriteArguments) {
          $args = result.args;
        }
      } else if (maybePromiseLike instanceof Kareem.overwriteArguments) {
        $args = maybePromiseLike.args;
      }
    } catch (error) {
      if (error instanceof Kareem.skipWrappedFunction) {
        skipWrappedFunction = error;
        continue;
      }
      if (error instanceof Kareem.overwriteArguments) {
        $args = error.args;
        continue;
      }
      throw error;
    }
  }

  if (skipWrappedFunction) {
    throw skipWrappedFunction;
  }

  return $args;
};

/**
 * Execute all "pre" hooks for "name" synchronously
 * @param {String} name The hook name to execute
 * @param {*} context Overwrite the "this" for the hook
 * @param {Array} [args] Apply custom arguments to the hook
 * @param {Object} [options] Optional options
 * @param {Function} [options.filter] Filter function to select which hooks to run
 * @returns {Array} The potentially modified arguments
 */
Kareem.prototype.execPreSync = function(name, context, args, options) {
  let pres = this._pres.get(name) || [];
  if (options?.filter) {
    pres = pres.filter(options.filter);
  }
  const numPres = pres.length;
  let $args = args || [];

  for (let i = 0; i < numPres; ++i) {
    const result = pres[i].fn.apply(context, $args);
    if (result instanceof Kareem.overwriteArguments) {
      $args = result.args;
    }
  }

  return $args;
};

/**
 * Execute all "post" hooks for "name"
 * @param {String} name The hook name to execute
 * @param {*} context Overwrite the "this" for the hook
 * @param {Array} args Apply custom arguments to the hook
 * @param {Object} [options] Optional options
 * @param {Error} [options.error] Error to pass to error-handling middleware
 * @param {Function} [options.filter] Filter function to select which hooks to run
 * @returns {void}
 */
Kareem.prototype.execPost = async function execPost(name, context, args, options) {
  let posts = this._posts.get(name) || [];
  if (options?.filter) {
    posts = posts.filter(options.filter);
  }
  const numPosts = posts.length;

  let firstError = null;
  if (options && options.error) {
    firstError = options.error;
  }

  if (!numPosts) {
    if (firstError != null) {
      throw firstError;
    }
    return args;
  }

  let cbPromise = null;
  let resolve;
  let reject;
  const nextCallback = function nextCallback(err) {
    if (err) {
      reject(err);
    } else {
      resolve();
    }
  };

  let newArgs = args.slice();
  _handleNumCallbackParams(newArgs, options?.numCallbackParams);
  let numArgs = newArgs.length;
  newArgs.push(nextCallback);
  let errorArgs = options?.error ? [firstError, ...newArgs] : null;

  for (const currentPost of posts) {
    const post = currentPost.fn;

    cbPromise = new Promise((_resolve, _reject) => {
      resolve = _resolve;
      reject = _reject;
    });

    if (firstError) {
      if (isErrorHandlingMiddleware(currentPost, numArgs)) {
        try {
          const res = post.apply(context, errorArgs);
          if (isPromiseLike(res)) {
            await res;
          } else if (post.length === numArgs + 2) {
            // `numArgs + 2` because we added the error and the callback
            await cbPromise;
          }
        } catch (error) {
          if (error instanceof Kareem.overwriteResult) {
            args = error.args;
            newArgs = args.slice();
            _handleNumCallbackParams(newArgs, options?.numCallbackParams);
            numArgs = newArgs.length;
            newArgs.push(nextCallback);
            continue;
          }
          firstError = error;
          errorArgs = [firstError, ...newArgs];
        }
      } else {
        continue;
      }
    } else {
      if (isErrorHandlingMiddleware(currentPost, numArgs)) {
        // Skip error handlers if no error
        continue;
      } else {
        let res = null;
        try {
          res = post.apply(context, newArgs);
          if (isPromiseLike(res)) {
            res = await res;
          } else if (post.length === numArgs + 1) {
            // If post function takes a callback, wait for the post function to call the callback
            res = await cbPromise;
          }
        } catch (error) {
          if (error instanceof Kareem.overwriteResult) {
            args = error.args;
            newArgs = args.slice();
            _handleNumCallbackParams(newArgs, options?.numCallbackParams);
            numArgs = newArgs.length;
            newArgs.push(nextCallback);
            errorArgs = [firstError, ...newArgs];
            continue;
          }
          firstError = error;
          errorArgs = [firstError, ...newArgs];
          continue;
        }

        if (res instanceof Kareem.overwriteResult) {
          args = res.args;
          newArgs = args.slice();
          _handleNumCallbackParams(newArgs, options?.numCallbackParams);
          numArgs = newArgs.length;
          newArgs.push(nextCallback);
          continue;
        }
      }
    }
  }

  if (firstError != null) {
    throw firstError;
  }

  return args;
};

/*!
 * Handle the `numCallbackParams` option for `execPostSync`: fill `newArgs` with `null` until
 * length is `numCallbackParams` if `numCallbackParams` is a number.
 *
 * @param {Array} newArgs The arguments to fill
 * @param {number|null|undefined} numCallbackParams The number of callback parameters
 */

function _handleNumCallbackParams(newArgs, numCallbackParams) {
  if (typeof numCallbackParams === 'number' && numCallbackParams > newArgs.length) {
    for (let i = newArgs.length; i < numCallbackParams; ++i) {
      newArgs.push(null);
    }
  }
}

/**
 * Execute all "post" hooks for "name" synchronously
 * @param {String} name The hook name to execute
 * @param {*} context Overwrite the "this" for the hook
 * @param {Array} args Apply custom arguments to the hook
 * @param {Object} [options] Optional options
 * @param {Function} [options.filter] Filter function to select which hooks to run
 * @returns {Array} The used arguments
 */
Kareem.prototype.execPostSync = function(name, context, args, options) {
  let posts = this._posts.get(name) || [];
  if (options?.filter) {
    posts = posts.filter(options.filter);
  }
  const numPosts = posts.length;

  for (let i = 0; i < numPosts; ++i) {
    const res = posts[i].fn.apply(context, args || []);
    if (res instanceof Kareem.overwriteResult) {
      args = res.args;
    }
  }

  return args;
};

/**
 * Create a synchronous wrapper for "fn"
 * @param {String} name The name of the hook
 * @param {Function} fn The function to wrap
 * @param {*} context Overwrite the "this" for the hook. If null/undefined, uses the calling context.
 * @param {Object} [options] Options for the wrapper
 * @param {Function} [options.getOptions] Function that receives the wrapper arguments and returns options for execPreSync/execPostSync. Can return `{ filter }` for both, or `{ pre: { filter }, post: { filter } }` for separate options.
 * @returns {Function} The wrapped function
 */
Kareem.prototype.createWrapperSync = function(name, fn, context, options) {
  const _this = this;
  const getOptions = options?.getOptions;
  return function syncWrapper(...args) {
    const _context = context ?? this;
    const execOptions = typeof getOptions === 'function' ? getOptions(args) : {};
    const preOptions = execOptions.pre ?? execOptions;
    const postOptions = execOptions.post ?? execOptions;

    const modifiedArgs = _this.execPreSync(name, _context, args, preOptions);

    const toReturn = fn.apply(_context, modifiedArgs);

    const result = _this.execPostSync(name, _context, [toReturn], postOptions);

    return result[0];
  };
};

/**
 * Executes pre hooks, followed by the wrapped function, followed by post hooks.
 * @param {String} name The name of the hook
 * @param {Function} fn The function for the hook
 * @param {*} context Overwrite the "this" for the hook
 * @param {Array} args Apply custom arguments to the hook
 * @param {Object} [options] Additional options for the hook
 * @param {Function} [options.getOptions] Function that receives `args` and returns options for execPre/execPost. Can return `{ filter }` for both, or `{ pre: { filter }, post: { filter } }` for separate options.
 * @returns {Promise<any>} The wrapped function's result, potentially modified by post hooks
 */
Kareem.prototype.wrap = async function wrap(name, fn, context, args, options) {
  const getOptions = options?.getOptions;
  const execOptions = typeof getOptions === 'function' ? getOptions(args) : {};
  const preOptions = execOptions.pre ?? execOptions;
  const postOptions = execOptions.post ?? execOptions;

  let ret;
  let skipWrappedFunction = false;
  let modifiedArgs = args;
  try {
    modifiedArgs = await this.execPre(name, context, args, preOptions);
  } catch (error) {
    if (error instanceof Kareem.skipWrappedFunction) {
      ret = error.args;
      skipWrappedFunction = true;
    } else {
      await this.execPost(name, context, args, { ...options, ...postOptions, error });
    }
  }

  if (!skipWrappedFunction) {
    ret = await fn.apply(context, modifiedArgs);
  }

  ret = await this.execPost(name, context, [ret], { ...options, ...postOptions });

  return ret[0];
};

/**
 * Filter current instance for something specific and return the filtered clone
 * @param {Function} fn The filter function
 * @returns {Kareem} The cloned and filtered instance
 */
Kareem.prototype.filter = function(fn) {
  const clone = this.clone();

  const pres = Array.from(clone._pres.keys());
  for (const name of pres) {
    const hooks = this._pres.get(name).
      map(h => Object.assign({}, h, { name: name })).
      filter(fn);

    if (hooks.length === 0) {
      clone._pres.delete(name);
      continue;
    }

    clone._pres.set(name, hooks);
  }

  const posts = Array.from(clone._posts.keys());
  for (const name of posts) {
    const hooks = this._posts.get(name).
      map(h => Object.assign({}, h, { name: name })).
      filter(fn);

    if (hooks.length === 0) {
      clone._posts.delete(name);
      continue;
    }

    clone._posts.set(name, hooks);
  }

  return clone;
};

/**
 * Check for a "name" to exist either in pre or post hooks
 * @param {String} name The name of the hook
 * @returns {Boolean} "true" if found, "false" otherwise
 */
Kareem.prototype.hasHooks = function(name) {
  return this._pres.has(name) || this._posts.has(name);
};

/**
 * Create a Wrapper for "fn" on "name" and return the wrapped function
 * @param {String} name The name of the hook
 * @param {Function} fn The function to wrap
 * @param {*} context Overwrite the "this" for the hook. If null/undefined, uses the calling context.
 * @param {Object} [options]
 * @param {Function} [options.getOptions] Function that receives the wrapper arguments and returns options for execPre/execPost. Can return `{ filter }` for both, or `{ pre: { filter }, post: { filter } }` for separate options.
 * @returns {Function} The wrapped function
 */
Kareem.prototype.createWrapper = function(name, fn, context, options) {
  const _this = this;
  if (!this.hasHooks(name)) {
    // Fast path: if there's no hooks for this function, just return the function
    return fn;
  }
  return function kareemWrappedFunction(...args) {
    const _context = context ?? this;
    return _this.wrap(name, fn, _context, args, options);
  };
};

/**
 * Register a new hook for "pre"
 * @param {String} name The name of the hook
 * @param {Object} [options]
 * @param {Function} fn The function to register for "name"
 * @param {never} error Unused
 * @param {Boolean} [unshift] Wheter to "push" or to "unshift" the new hook
 * @returns {Kareem}
 */
Kareem.prototype.pre = function(name, options, fn, error, unshift) {
  if (typeof options === 'function') {
    fn = options;
    options = {};
  } else if (options == null) {
    options = {};
  }

  const pres = this._pres.get(name) || [];
  this._pres.set(name, pres);

  if (typeof fn !== 'function') {
    throw new Error('pre() requires a function, got "' + typeof fn + '"');
  }

  if (unshift) {
    pres.unshift(Object.assign({}, options, { fn: fn }));
  } else {
    pres.push(Object.assign({}, options, { fn: fn }));
  }

  return this;
};

/**
 * Register a new hook for "post"
 * @param {String} name The name of the hook
 * @param {Object} [options]
 * @param {Boolean} [options.errorHandler] Whether this is an error handler
 * @param {Function} fn The function to register for "name"
 * @param {Boolean} [unshift] Wheter to "push" or to "unshift" the new hook
 * @returns {Kareem}
 */
Kareem.prototype.post = function(name, options, fn, unshift) {
  const posts = this._posts.get(name) || [];

  if (typeof options === 'function') {
    unshift = !!fn;
    fn = options;
    options = {};
  }

  if (typeof fn !== 'function') {
    throw new Error('post() requires a function, got "' + typeof fn + '"');
  }

  if (unshift) {
    posts.unshift(Object.assign({}, options, { fn: fn }));
  } else {
    posts.push(Object.assign({}, options, { fn: fn }));
  }
  this._posts.set(name, posts);
  return this;
};

/**
 * Register a new error handler for "name"
 * @param {String} name The name of the hook
 * @param {Object} [options]
 * @param {Function} fn The function to register for "name"
 * @param {Boolean} [unshift] Wheter to "push" or to "unshift" the new hook
 * @returns {Kareem}
 */

Kareem.prototype.postError = function postError(name, options, fn, unshift) {
  if (typeof options === 'function') {
    unshift = !!fn;
    fn = options;
    options = {};
  }
  return this.post(name, { ...options, errorHandler: true }, fn, unshift);
};

/**
 * Clone the current instance
 * @returns {Kareem} The cloned instance
 */
Kareem.prototype.clone = function() {
  const n = new Kareem();

  for (const key of this._pres.keys()) {
    const clone = this._pres.get(key).slice();
    n._pres.set(key, clone);
  }
  for (const key of this._posts.keys()) {
    n._posts.set(key, this._posts.get(key).slice());
  }

  return n;
};

/**
 * Merge "other" into self or "clone"
 * @param {Kareem} other The instance to merge with
 * @param {Kareem} [clone] The instance to merge onto (if not defined, using "this")
 * @returns {Kareem} The merged instance
 */
Kareem.prototype.merge = function(other, clone) {
  clone = arguments.length === 1 ? true : clone;
  const ret = clone ? this.clone() : this;

  for (const key of other._pres.keys()) {
    const sourcePres = ret._pres.get(key) || [];
    const deduplicated = other._pres.get(key).
      // Deduplicate based on `fn`
      filter(p => sourcePres.map(_p => _p.fn).indexOf(p.fn) === -1);
    const combined = sourcePres.concat(deduplicated);
    ret._pres.set(key, combined);
  }
  for (const key of other._posts.keys()) {
    const sourcePosts = ret._posts.get(key) || [];
    const deduplicated = other._posts.get(key).
      filter(p => sourcePosts.indexOf(p) === -1);
    ret._posts.set(key, sourcePosts.concat(deduplicated));
  }

  return ret;
};

function isPromiseLike(v) {
  return (typeof v === 'object' && v !== null && typeof v.then === 'function');
}

function isErrorHandlingMiddleware(post, numArgs) {
  if (post.errorHandler) {
    return true;
  }
  return post.fn.length === numArgs + 2;
}

module.exports = Kareem;
