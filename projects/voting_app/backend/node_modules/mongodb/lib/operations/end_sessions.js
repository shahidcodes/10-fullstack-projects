"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EndSessionsOperation = void 0;
const responses_1 = require("../cmap/wire_protocol/responses");
const command_1 = require("../operations/command");
const read_preference_1 = require("../read_preference");
const utils_1 = require("../utils");
const operation_1 = require("./operation");
class EndSessionsOperation extends command_1.CommandOperation {
    constructor(sessions) {
        super();
        this.writeConcern = { w: 0 };
        this.ns = utils_1.MongoDBNamespace.fromString('admin.$cmd');
        this.SERVER_COMMAND_RESPONSE_TYPE = responses_1.MongoDBResponse;
        this.sessions = sessions;
    }
    buildCommandDocument(_connection, _session) {
        return {
            endSessions: this.sessions
        };
    }
    buildOptions(timeoutContext) {
        return {
            timeoutContext,
            readPreference: read_preference_1.ReadPreference.primaryPreferred
        };
    }
    get commandName() {
        return 'endSessions';
    }
}
exports.EndSessionsOperation = EndSessionsOperation;
(0, operation_1.defineAspects)(EndSessionsOperation, operation_1.Aspect.WRITE_OPERATION);
//# sourceMappingURL=end_sessions.js.map