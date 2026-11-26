"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BASE_BACKOFF_MS = void 0;
exports.executeOperation = executeOperation;
exports.autoConnect = autoConnect;
exports.calculateBaseBackoffMS = calculateBaseBackoffMS;
const promises_1 = require("timers/promises");
const constants_1 = require("../cmap/wire_protocol/constants");
const error_1 = require("../error");
const read_preference_1 = require("../read_preference");
const common_1 = require("../sdam/common");
const server_selection_1 = require("../sdam/server_selection");
const timeout_1 = require("../timeout");
const utils_1 = require("../utils");
const aggregate_1 = require("./aggregate");
const operation_1 = require("./operation");
const run_command_1 = require("./run_command");
const MMAPv1_RETRY_WRITES_ERROR_CODE = error_1.MONGODB_ERROR_CODES.IllegalOperation;
const MMAPv1_RETRY_WRITES_ERROR_MESSAGE = 'This MongoDB deployment does not support retryable writes. Please add retryWrites=false to your connection string.';
/**
 * Executes the given operation with provided arguments.
 * @internal
 *
 * @remarks
 * Allows for a single point of entry to provide features such as implicit sessions, which
 * are required by the Driver Sessions specification in the event that a ClientSession is
 * not provided.
 *
 * The expectation is that this function:
 * - Connects the MongoClient if it has not already been connected, see {@link autoConnect}
 * - Creates a session if none is provided and cleans up the session it creates
 * - Tries an operation and retries under certain conditions, see {@link executeOperationWithRetries}
 *
 * @typeParam T - The operation's type
 * @typeParam TResult - The type of the operation's result, calculated from T
 *
 * @param client - The MongoClient to execute this operation with
 * @param operation - The operation to execute
 */
async function executeOperation(client, operation, timeoutContext) {
    if (!(operation instanceof operation_1.AbstractOperation)) {
        // TODO(NODE-3483): Extend MongoRuntimeError
        throw new error_1.MongoRuntimeError('This method requires a valid operation instance');
    }
    const topology = client.topology == null
        ? await (0, utils_1.abortable)(autoConnect(client), operation.options)
        : client.topology;
    // The driver sessions spec mandates that we implicitly create sessions for operations
    // that are not explicitly provided with a session.
    let session = operation.session;
    let owner;
    if (session == null) {
        owner = Symbol();
        session = client.startSession({ owner, explicit: false });
    }
    else if (session.hasEnded) {
        throw new error_1.MongoExpiredSessionError('Use of expired sessions is not permitted');
    }
    else if (session.snapshotEnabled &&
        (0, utils_1.maxWireVersion)(topology) < constants_1.MIN_SUPPORTED_SNAPSHOT_READS_WIRE_VERSION) {
        throw new error_1.MongoCompatibilityError('Snapshot reads require MongoDB 5.0 or later');
    }
    else if (session.client !== client) {
        throw new error_1.MongoInvalidArgumentError('ClientSession must be from the same MongoClient');
    }
    operation.session ??= session;
    const readPreference = operation.readPreference ?? read_preference_1.ReadPreference.primary;
    const inTransaction = !!session?.inTransaction();
    const hasReadAspect = operation.hasAspect(operation_1.Aspect.READ_OPERATION);
    if (inTransaction &&
        !readPreference.equals(read_preference_1.ReadPreference.primary) &&
        (hasReadAspect || operation.commandName === 'runCommand')) {
        throw new error_1.MongoTransactionError(`Read preference in a transaction must be primary, not: ${readPreference.mode}`);
    }
    if (session?.isPinned && session.transaction.isCommitted && !operation.bypassPinningCheck) {
        session.unpin();
    }
    timeoutContext ??= timeout_1.TimeoutContext.create({
        session,
        serverSelectionTimeoutMS: client.s.options.serverSelectionTimeoutMS,
        waitQueueTimeoutMS: client.s.options.waitQueueTimeoutMS,
        timeoutMS: operation.options.timeoutMS
    });
    try {
        return await executeOperationWithRetries(operation, {
            topology,
            timeoutContext,
            session,
            readPreference
        });
    }
    finally {
        if (session?.owner != null && session.owner === owner) {
            await session.endSession();
        }
    }
}
/**
 * Connects a client if it has not yet been connected
 * @internal
 */
async function autoConnect(client) {
    if (client.topology == null) {
        if (client.s.hasBeenClosed) {
            throw new error_1.MongoNotConnectedError('Client must be connected before running operations');
        }
        client.s.options.__skipPingOnConnect = true;
        try {
            await client.connect();
            if (client.topology == null) {
                throw new error_1.MongoRuntimeError('client.connect did not create a topology but also did not throw');
            }
            return client.topology;
        }
        finally {
            delete client.s.options.__skipPingOnConnect;
        }
    }
    return client.topology;
}
/** @internal The base backoff duration in milliseconds */
exports.BASE_BACKOFF_MS = 100;
/** @internal The maximum backoff duration in milliseconds */
const MAX_BACKOFF_MS = 10_000;
/**
 * @internal
 * The server-supplied base backoff duration in milliseconds, if the error carries a usable one.
 *
 * The server may attach `baseBackoffMS` to an overload error to indicate how long clients should
 * back off in place of the driver's default. Only a positive value is honoured: the server disables
 * the behaviour by reporting `0`, in which case we fall back to `BASE_BACKOFF_MS`.
 */
function calculateBaseBackoffMS(error) {
    if (!(error instanceof error_1.MongoServerError))
        return exports.BASE_BACKOFF_MS;
    // The server sends baseBackoffMS as an int64, so its runtime type depends on the client's BSON
    // options: a number by default, a Long under `promoteLongs: false`, a bigint under
    // `useBigInt64: true`. `Number()` handles all three, so coerce rather than check for `number`.
    // `errorResponse` is indexed as `any`; narrow to `unknown` so the checks below are real.
    const raw = error.errorResponse.baseBackoffMS;
    const isNumeric = typeof raw === 'number' || typeof raw === 'bigint' || typeof raw === 'object';
    const baseBackoffMS = isNumeric ? Number(raw) : NaN;
    const useServerValue = Number.isFinite(baseBackoffMS) && baseBackoffMS > 0;
    const result = useServerValue ? baseBackoffMS : exports.BASE_BACKOFF_MS;
    return result;
}
/**
 * Executes an operation and retries as appropriate
 * @internal
 *
 * @remarks
 * Implements behaviour described in [Retryable Reads](https://github.com/mongodb/specifications/blob/master/source/retryable-reads/retryable-reads.md) and [Retryable
 * Writes](https://github.com/mongodb/specifications/blob/master/source/retryable-writes/retryable-writes.md) specification
 *
 * This function:
 * - performs initial server selection
 * - attempts to execute an operation
 * - retries the operation if it meets the criteria for a retryable read or a retryable write
 *
 * @typeParam T - The operation's type
 * @typeParam TResult - The type of the operation's result, calculated from T
 *
 * @param operation - The operation to execute
 */
async function executeOperationWithRetries(operation, { topology, timeoutContext, session, readPreference }) {
    let selector;
    if (operation.hasAspect(operation_1.Aspect.MUST_SELECT_SAME_SERVER)) {
        // GetMore and KillCursor operations must always select the same server, but run through
        // server selection to potentially force monitor checks if the server is
        // in an unknown state.
        selector = (0, server_selection_1.sameServerSelector)(operation.server?.description);
    }
    else if (operation instanceof aggregate_1.AggregateOperation && operation.hasWriteStage) {
        // If operation should try to write to secondary use the custom server selector
        // otherwise provide the read preference.
        selector = (0, server_selection_1.secondaryWritableServerSelector)(topology.commonWireVersion, readPreference);
    }
    else {
        selector = readPreference;
    }
    let server = await topology.selectServer(selector, {
        session,
        operationName: operation.commandName,
        timeoutContext,
        signal: operation.options.signal,
        deprioritizedServers: new server_selection_1.DeprioritizedServers()
    });
    const hasReadAspect = operation.hasAspect(operation_1.Aspect.READ_OPERATION);
    const hasWriteAspect = operation.hasAspect(operation_1.Aspect.WRITE_OPERATION);
    const inTransaction = session?.inTransaction() ?? false;
    const willRetryRead = topology.s.options.retryReads && !inTransaction && operation.canRetryRead;
    const willRetryWrite = topology.s.options.retryWrites &&
        !inTransaction &&
        (0, utils_1.supportsRetryableWrites)(server) &&
        operation.canRetryWrite;
    const willRetry = operation.hasAspect(operation_1.Aspect.RETRYABLE) &&
        session != null &&
        ((hasReadAspect && willRetryRead) || (hasWriteAspect && willRetryWrite));
    if (hasWriteAspect && willRetryWrite && session != null) {
        operation.options.willRetryWrite = true;
        session.incrementTransactionNumber();
    }
    const deprioritizedServers = new server_selection_1.DeprioritizedServers();
    let maxAttempts = typeof operation.maxAttempts === 'number'
        ? operation.maxAttempts
        : willRetry
            ? timeoutContext.csotEnabled()
                ? Infinity
                : 2
            : 1;
    let error = null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        operation.attemptsMade = attempt + 1;
        operation.server = server;
        try {
            try {
                const result = await server.command(operation, timeoutContext);
                return operation.handleOk(result);
            }
            catch (error) {
                return operation.handleError(error);
            }
        }
        catch (operationError) {
            // Should never happen but if it does - propagate the error.
            if (!(operationError instanceof error_1.MongoError))
                throw operationError;
            // Preserve the original error once a write has been performed.
            // Only update to the latest error if no writes were performed.
            if (error == null) {
                error = operationError;
            }
            else {
                if (!operationError.hasErrorLabel(error_1.MongoErrorLabel.NoWritesPerformed)) {
                    error = operationError;
                }
            }
            // Reset timeouts
            timeoutContext.clear();
            if (hasWriteAspect && operationError.code === MMAPv1_RETRY_WRITES_ERROR_CODE) {
                throw new error_1.MongoServerError({
                    message: MMAPv1_RETRY_WRITES_ERROR_MESSAGE,
                    errmsg: MMAPv1_RETRY_WRITES_ERROR_MESSAGE,
                    originalError: operationError
                });
            }
            if (!canRetry(operation, operationError)) {
                throw error;
            }
            if (operationError.hasErrorLabel(error_1.MongoErrorLabel.SystemOverloadedError)) {
                const maxOverloadAttempts = topology.s.options.maxAdaptiveRetries + 1;
                maxAttempts = Math.min(maxOverloadAttempts, operation.maxAttempts ?? maxOverloadAttempts);
            }
            if (attempt + 1 >= maxAttempts) {
                throw error;
            }
            if (operationError instanceof error_1.MongoNetworkError &&
                operation.hasAspect(operation_1.Aspect.CURSOR_CREATING) &&
                session != null &&
                session.isPinned &&
                !session.inTransaction()) {
                session.unpin({ force: true, forceClear: true });
            }
            if (operationError.hasErrorLabel(error_1.MongoErrorLabel.SystemOverloadedError) &&
                operation.hasAspect(operation_1.Aspect.CURSOR_CREATING) &&
                session != null &&
                session.isPinned &&
                !session.inTransaction()) {
                session.unpin({ force: true });
            }
            if (operationError.hasErrorLabel(error_1.MongoErrorLabel.SystemOverloadedError)) {
                const baseBackoffMS = calculateBaseBackoffMS(operationError);
                // The spec numbers the first retry as attempt 1, while `attempt` here is the zero-based
                // index of the attempt that just failed -- hence the `+ 1`.
                const backoffMS = Math.random() * Math.min(MAX_BACKOFF_MS, baseBackoffMS * 2 ** (attempt + 1));
                // if the backoff would exhaust the CSOT timeout, short-circuit.
                if (timeoutContext.csotEnabled() && backoffMS > timeoutContext.remainingTimeMS) {
                    throw error;
                }
                await (0, promises_1.setTimeout)(backoffMS);
            }
            if (topology.description.type === common_1.TopologyType.Sharded ||
                (operationError.hasErrorLabel(error_1.MongoErrorLabel.SystemOverloadedError) &&
                    topology.s.options.enableOverloadRetargeting)) {
                deprioritizedServers.add(server.description);
            }
            server = await topology.selectServer(selector, {
                session,
                operationName: operation.commandName,
                deprioritizedServers,
                signal: operation.options.signal
            });
            if (hasWriteAspect &&
                !(0, utils_1.supportsRetryableWrites)(server) &&
                !operationError.hasErrorLabel(error_1.MongoErrorLabel.SystemOverloadedError)) {
                throw new error_1.MongoUnexpectedServerResponseError('Selected server does not support retryable writes');
            }
            // Batched operations must reset the batch before retry,
            // otherwise building a command will build the _next_ batch, not the current batch.
            if (operation.hasAspect(operation_1.Aspect.COMMAND_BATCHING)) {
                operation.resetBatch();
            }
        }
    }
    throw (error ??
        new error_1.MongoRuntimeError('Should never happen: operation execution loop terminated but no error was recorded.'));
    function canRetry(operation, error) {
        // SystemOverloadedError is retryable, but must respect retryReads/retryWrites settings
        // Check topology options directly (not operation.canRetryRead/Write) because backpressure
        // expands retry support beyond traditional retryable reads/writes
        // NOTE: Unlike traditional retries, backpressure retries ARE allowed inside transactions
        if (error.hasErrorLabel(error_1.MongoErrorLabel.SystemOverloadedError) &&
            error.hasErrorLabel(error_1.MongoErrorLabel.RetryableError)) {
            // runCommand requires BOTH retryReads and retryWrites to be enabled (per spec step 2.4)
            if (operation instanceof run_command_1.RunCommandOperation) {
                return topology.s.options.retryReads && topology.s.options.retryWrites;
            }
            // Write-stage aggregates ($out/$merge) require retryWrites
            if (operation instanceof aggregate_1.AggregateOperation && operation.hasWriteStage) {
                return topology.s.options.retryWrites;
            }
            // For other operations, check if retries are enabled based on operation type
            const canRetryAsRead = hasReadAspect && topology.s.options.retryReads;
            const canRetryAsWrite = hasWriteAspect && topology.s.options.retryWrites;
            return canRetryAsRead || canRetryAsWrite;
        }
        // run command is only retryable if we get retryable overload errors
        if (operation instanceof run_command_1.RunCommandOperation) {
            return false;
        }
        // batch operations are only retryable if the batch is retryable
        if (operation.hasAspect(operation_1.Aspect.COMMAND_BATCHING)) {
            return operation.canRetryWrite && (0, error_1.isRetryableWriteError)(error);
        }
        return ((hasWriteAspect && willRetryWrite && (0, error_1.isRetryableWriteError)(error)) ||
            (hasReadAspect && willRetryRead && (0, error_1.isRetryableReadError)(error)));
    }
}
//# sourceMappingURL=execute_operation.js.map