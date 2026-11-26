"use strict";
/* eslint-disable no-restricted-imports*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOWED_DRIVER_REQUIRE_PROPERTY_NAME = void 0;
exports.resolveRuntimeAdapters = resolveRuntimeAdapters;
/**
 * @internal
 *
 * Legacy escape hatch for the test sandbox's restricted `require`: the driver no longer sets this
 * property (the os adapter loads via dynamic `import()`), but the vm test harness
 * still checks it. Kept until the sandbox contract is revisited in a follow-up.
 */
exports.ALLOWED_DRIVER_REQUIRE_PROPERTY_NAME = 'allowedDriverRequire';
/**
 * @internal
 *
 * Given a MongoClientOptions, this function resolves the set of runtime options, providing Nodejs
 * implementations if not provided in `options`, and returns a `Runtime`.
 *
 * Resolution is asynchronous because the default `os` adapter is loaded via a dynamic `import()`.
 * Unlike `require`, dynamic import exists in every module system the driver ships into or is
 * bundled into (CJS, ESM, and bundled ESM output), and the literal specifier keeps it
 * statically analyzable for bundlers. The promise is created during synchronous
 * options parsing and awaited later by consumers, so the public constructor stays synchronous.
 */
async function resolveRuntimeAdapters(options) {
    return {
        os: options.runtimeAdapters?.os ?? (await import('os'))
    };
}
//# sourceMappingURL=runtime_adapters.js.map