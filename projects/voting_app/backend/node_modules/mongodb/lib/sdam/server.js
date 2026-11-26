"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Server = void 0;
const connection_1 = require("../cmap/connection");
const connection_pool_1 = require("../cmap/connection_pool");
const errors_1 = require("../cmap/errors");
const constants_1 = require("../constants");
const error_1 = require("../error");
const mongo_types_1 = require("../mongo_types");
const aggregate_1 = require("../operations/aggregate");
const transactions_1 = require("../transactions");
const utils_1 = require("../utils");
const write_concern_1 = require("../write_concern");
const common_1 = require("./common");
const monitor_1 = require("./monitor");
const server_description_1 = require("./server_description");
const server_selection_1 = require("./server_selection");
const stateTransition = (0, utils_1.makeStateMachine)({
    [common_1.STATE_CLOSED]: [common_1.STATE_CLOSED, common_1.STATE_CONNECTING],
    [common_1.STATE_CONNECTING]: [common_1.STATE_CONNECTING, common_1.STATE_CLOSING, common_1.STATE_CONNECTED, common_1.STATE_CLOSED],
    [common_1.STATE_CONNECTED]: [common_1.STATE_CONNECTED, common_1.STATE_CLOSING, common_1.STATE_CLOSED],
    [common_1.STATE_CLOSING]: [common_1.STATE_CLOSING, common_1.STATE_CLOSED]
});
/** @internal */
class Server extends mongo_types_1.TypedEventEmitter {
    /** @event */
    static { this.SERVER_HEARTBEAT_STARTED = constants_1.SERVER_HEARTBEAT_STARTED; }
    /** @event */
    static { this.SERVER_HEARTBEAT_SUCCEEDED = constants_1.SERVER_HEARTBEAT_SUCCEEDED; }
    /** @event */
    static { this.SERVER_HEARTBEAT_FAILED = constants_1.SERVER_HEARTBEAT_FAILED; }
    /** @event */
    static { this.CONNECT = constants_1.CONNECT; }
    /** @event */
    static { this.DESCRIPTION_RECEIVED = constants_1.DESCRIPTION_RECEIVED; }
    /** @event */
    static { this.CLOSED = constants_1.CLOSED; }
    /** @event */
    static { this.ENDED = constants_1.ENDED; }
    /**
     * Create a server
     */
    constructor(topology, description, options) {
        super();
        this.on('error', utils_1.noop);
        this.serverApi = options.serverApi;
        const poolOptions = { hostAddress: description.hostAddress, ...options };
        this.topology = topology;
        this.pool = new connection_pool_1.ConnectionPool(this, poolOptions);
        this.s = {
            description,
            options,
            state: common_1.STATE_CLOSED,
            operationCount: 0
        };
        for (const event of [...constants_1.CMAP_EVENTS, ...constants_1.APM_EVENTS]) {
            this.pool.on(event, (e) => this.emit(event, e));
        }
        this.pool.on(connection_1.Connection.CLUSTER_TIME_RECEIVED, (clusterTime) => {
            this.clusterTime = clusterTime;
        });
        if (this.loadBalanced) {
            this.monitor = null;
            // monitoring is disabled in load balancing mode
            return;
        }
        // create the monitor
        this.monitor = new monitor_1.Monitor(this, this.s.options);
        for (const event of constants_1.HEARTBEAT_EVENTS) {
            this.monitor.on(event, (e) => this.emit(event, e));
        }
        this.monitor.on('resetServer', (error) => markServerUnknown(this, error));
        this.monitor.on(Server.SERVER_HEARTBEAT_SUCCEEDED, (event) => {
            this.emit(Server.DESCRIPTION_RECEIVED, new server_description_1.ServerDescription(this.description.hostAddress, event.reply, {
                roundTripTime: this.monitor?.roundTripTime,
                minRoundTripTime: this.monitor?.minRoundTripTime
            }));
            if (this.s.state === common_1.STATE_CONNECTING) {
                stateTransition(this, common_1.STATE_CONNECTED);
                this.emit(Server.CONNECT, this);
            }
        });
    }
    get clusterTime() {
        return this.topology.clusterTime;
    }
    set clusterTime(clusterTime) {
        this.topology.clusterTime = clusterTime;
    }
    get description() {
        return this.s.description;
    }
    get name() {
        return this.s.description.address;
    }
    get autoEncrypter() {
        if (this.s.options && this.s.options.autoEncrypter) {
            return this.s.options.autoEncrypter;
        }
        return;
    }
    get loadBalanced() {
        return this.topology.description.type === common_1.TopologyType.LoadBalanced;
    }
    /**
     * Initiate server connect
     */
    connect() {
        if (this.s.state !== common_1.STATE_CLOSED) {
            return;
        }
        stateTransition(this, common_1.STATE_CONNECTING);
        // If in load balancer mode we automatically set the server to
        // a load balancer. It never transitions out of this state and
        // has no monitor.
        if (!this.loadBalanced) {
            this.monitor?.connect();
        }
        else {
            stateTransition(this, common_1.STATE_CONNECTED);
            this.emit(Server.CONNECT, this);
        }
    }
    closeCheckedOutConnections() {
        return this.pool.closeCheckedOutConnections();
    }
    /** Destroy the server connection */
    close() {
        if (this.s.state === common_1.STATE_CLOSED) {
            return;
        }
        stateTransition(this, common_1.STATE_CLOSING);
        if (!this.loadBalanced) {
            this.monitor?.close();
        }
        this.pool.close();
        stateTransition(this, common_1.STATE_CLOSED);
        this.emit('closed');
    }
    /**
     * Immediately schedule monitoring of this server. If there already an attempt being made
     * this will be a no-op.
     */
    requestCheck() {
        if (!this.loadBalanced) {
            this.monitor?.requestCheck();
        }
    }
    async command(operation, timeoutContext) {
        if (this.s.state === common_1.STATE_CLOSING || this.s.state === common_1.STATE_CLOSED) {
            throw new error_1.MongoServerClosedError();
        }
        const session = operation.session;
        let conn = session?.pinnedConnection;
        this.incrementOperationCount();
        if (conn == null) {
            try {
                conn = await this.pool.checkOut({ timeoutContext, signal: operation.options.signal });
            }
            catch (checkoutError) {
                this.decrementOperationCount();
                if (!(checkoutError instanceof errors_1.PoolClearedError))
                    this.handleError(checkoutError);
                throw checkoutError;
            }
        }
        let reauthPromise = null;
        const cleanup = () => {
            this.decrementOperationCount();
            if (session?.pinnedConnection !== conn) {
                if (reauthPromise != null) {
                    // The reauth promise only exists if it hasn't thrown.
                    const checkBackIn = () => {
                        this.pool.checkIn(conn);
                    };
                    void reauthPromise.then(checkBackIn, checkBackIn);
                }
                else {
                    this.pool.checkIn(conn);
                }
            }
        };
        let cmd;
        try {
            cmd = operation.buildCommand(conn, session);
        }
        catch (e) {
            cleanup();
            throw e;
        }
        const options = operation.buildOptions(timeoutContext);
        const ns = operation.ns;
        if (this.loadBalanced && isPinnableCommand(cmd, session) && !session?.pinnedConnection) {
            session?.pin(conn);
        }
        options.directConnection = this.topology.s.options.directConnection;
        const omitReadPreference = operation instanceof aggregate_1.AggregateOperation &&
            operation.hasWriteStage &&
            (0, utils_1.maxWireVersion)(conn) < server_selection_1.MIN_SECONDARY_WRITE_WIRE_VERSION;
        if (omitReadPreference) {
            delete options.readPreference;
        }
        if (this.description.iscryptd) {
            options.omitMaxTimeMS = true;
        }
        try {
            try {
                const res = await conn.command(ns, cmd, options, operation.SERVER_COMMAND_RESPONSE_TYPE);
                (0, write_concern_1.throwIfWriteConcernError)(res);
                return res;
            }
            catch (commandError) {
                throw this.decorateCommandError(conn, cmd, options, commandError);
            }
        }
        catch (operationError) {
            if (operationError instanceof error_1.MongoError &&
                operationError.code?.valueOf() === error_1.MONGODB_ERROR_CODES.Reauthenticate) {
                reauthPromise = this.pool.reauthenticate(conn);
                reauthPromise.then(undefined, error => {
                    reauthPromise = null;
                    (0, utils_1.squashError)(error);
                });
                await (0, utils_1.abortable)(reauthPromise, options);
                reauthPromise = null; // only reachable if reauth succeeds
                try {
                    const res = await conn.command(ns, cmd, options, operation.SERVER_COMMAND_RESPONSE_TYPE);
                    (0, write_concern_1.throwIfWriteConcernError)(res);
                    return res;
                }
                catch (commandError) {
                    throw this.decorateCommandError(conn, cmd, options, commandError);
                }
            }
            else {
                throw operationError;
            }
        }
        finally {
            cleanup();
        }
    }
    /**
     * Handle SDAM error
     * @internal
     */
    handleError(error, connection) {
        if (!(error instanceof error_1.MongoError)) {
            return;
        }
        if (isStaleError(this, error)) {
            return;
        }
        const isNetworkNonTimeoutError = error instanceof error_1.MongoNetworkError && !(error instanceof error_1.MongoNetworkTimeoutError);
        const isNetworkTimeoutBeforeHandshakeError = error instanceof error_1.MongoNetworkError && error.beforeHandshake;
        const isAuthOrEstablishmentHandshakeError = error.hasErrorLabel(error_1.MongoErrorLabel.HandshakeError);
        const isSystemOverloadError = error.hasErrorLabel(error_1.MongoErrorLabel.SystemOverloadedError);
        // Perhaps questionable and divergent from the spec, but considering MongoParseErrors like state change errors was legacy behavior.
        if ((0, error_1.isStateChangeError)(error) || error instanceof error_1.MongoParseError) {
            const shouldClearPool = (0, error_1.isNodeShuttingDownError)(error);
            // from the SDAM spec: The driver MUST synchronize clearing the pool with updating the topology.
            // In load balanced mode: there is no monitoring, so there is no topology to update.  We simply clear the pool.
            // For other topologies: the `ResetPool` label instructs the topology to clear the server's pool in `updateServer()`.
            if (!this.loadBalanced) {
                if (shouldClearPool) {
                    error.addErrorLabel(error_1.MongoErrorLabel.ResetPool);
                }
                markServerUnknown(this, error);
                queueMicrotask(() => this.requestCheck());
                return;
            }
            if (connection && shouldClearPool) {
                this.pool.clear({ serviceId: connection.serviceId });
            }
        }
        else if (isNetworkNonTimeoutError ||
            isNetworkTimeoutBeforeHandshakeError ||
            isAuthOrEstablishmentHandshakeError) {
            // Do NOT clear the pool if we encounter a system overloaded error.
            if (isSystemOverloadError) {
                return;
            }
            // from the SDAM spec: The driver MUST synchronize clearing the pool with updating the topology.
            // In load balanced mode: there is no monitoring, so there is no topology to update.  We simply clear the pool.
            // For other topologies: the `ResetPool` label instructs the topology to clear the server's pool in `updateServer()`.
            if (!this.loadBalanced) {
                error.addErrorLabel(error_1.MongoErrorLabel.ResetPool);
                markServerUnknown(this, error);
            }
            else if (connection) {
                this.pool.clear({ serviceId: connection.serviceId });
            }
        }
    }
    /**
     * Ensure that error is properly decorated and internal state is updated before throwing
     * @internal
     */
    decorateCommandError(connection, cmd, options, error) {
        if (typeof error !== 'object' || error == null || !('name' in error)) {
            throw new error_1.MongoRuntimeError('An unexpected error type: ' + typeof error);
        }
        if (error.name === 'AbortError' && 'cause' in error && error.cause instanceof error_1.MongoError) {
            error = error.cause;
        }
        if (!(error instanceof error_1.MongoError)) {
            // Node.js or some other error we have not special handling for
            return error;
        }
        if (connectionIsStale(this.pool, connection)) {
            return error;
        }
        const session = options?.session;
        if (error instanceof error_1.MongoNetworkError) {
            if (session && !session.hasEnded && session.serverSession) {
                session.serverSession.isDirty = true;
            }
            // inActiveTransaction check handles commit and abort.
            if (inActiveTransaction(session, cmd) &&
                !error.hasErrorLabel(error_1.MongoErrorLabel.TransientTransactionError)) {
                error.addErrorLabel(error_1.MongoErrorLabel.TransientTransactionError);
            }
            if ((isRetryableWritesEnabled(this.topology) || (0, transactions_1.isTransactionCommand)(cmd)) &&
                (0, utils_1.supportsRetryableWrites)(this) &&
                !inActiveTransaction(session, cmd)) {
                error.addErrorLabel(error_1.MongoErrorLabel.RetryableWriteError);
            }
        }
        else {
            if ((isRetryableWritesEnabled(this.topology) || (0, transactions_1.isTransactionCommand)(cmd)) &&
                (0, error_1.needsRetryableWriteLabel)(error) &&
                !inActiveTransaction(session, cmd)) {
                error.addErrorLabel(error_1.MongoErrorLabel.RetryableWriteError);
            }
        }
        if (session &&
            session.isPinned &&
            error.hasErrorLabel(error_1.MongoErrorLabel.TransientTransactionError)) {
            session.unpin({ force: true });
        }
        this.handleError(error, connection);
        return error;
    }
    /**
     * Decrement the operation count, returning the new count.
     */
    decrementOperationCount() {
        return (this.s.operationCount -= 1);
    }
    /**
     * Increment the operation count, returning the new count.
     */
    incrementOperationCount() {
        return (this.s.operationCount += 1);
    }
}
exports.Server = Server;
function markServerUnknown(server, error) {
    // Load balancer servers can never be marked unknown.
    if (server.loadBalanced) {
        return;
    }
    if (error instanceof error_1.MongoNetworkError && !(error instanceof error_1.MongoNetworkTimeoutError)) {
        server.monitor?.reset();
    }
    server.emit(Server.DESCRIPTION_RECEIVED, new server_description_1.ServerDescription(server.description.hostAddress, undefined, { error }));
}
function isPinnableCommand(cmd, session) {
    if (session) {
        return (session.inTransaction() ||
            (session.transaction.isCommitted && 'commitTransaction' in cmd) ||
            'aggregate' in cmd ||
            'find' in cmd ||
            'getMore' in cmd ||
            'listCollections' in cmd ||
            'listIndexes' in cmd ||
            'bulkWrite' in cmd);
    }
    return false;
}
function connectionIsStale(pool, connection) {
    if (connection.serviceId) {
        return (connection.generation !== pool.serviceGenerations.get(connection.serviceId.toHexString()));
    }
    return connection.generation !== pool.generation;
}
function inActiveTransaction(session, cmd) {
    return session && session.inTransaction() && !(0, transactions_1.isTransactionCommand)(cmd);
}
/** this checks the retryWrites option passed down from the client options, it
 * does not check if the server supports retryable writes */
function isRetryableWritesEnabled(topology) {
    return topology.s.options.retryWrites !== false;
}
function isStaleError(server, error) {
    const currentGeneration = server.pool.generation;
    const generation = error.connectionGeneration;
    if (generation && generation < currentGeneration) {
        return true;
    }
    const currentTopologyVersion = server.description.topologyVersion;
    return (0, server_description_1.compareTopologyVersion)(currentTopologyVersion, error.topologyVersion) >= 0;
}
//# sourceMappingURL=server.js.map