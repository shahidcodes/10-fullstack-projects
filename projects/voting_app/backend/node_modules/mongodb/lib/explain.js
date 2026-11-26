"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Explain = exports.ExplainVerbosity = void 0;
exports.decorateWithExplain = decorateWithExplain;
/** @public */
exports.ExplainVerbosity = Object.freeze({
    queryPlanner: 'queryPlanner',
    queryPlannerExtended: 'queryPlannerExtended',
    executionStats: 'executionStats',
    allPlansExecution: 'allPlansExecution'
});
/** @internal */
class Explain {
    constructor(verbosity, maxTimeMS) {
        if (typeof verbosity === 'boolean') {
            this.verbosity = verbosity
                ? exports.ExplainVerbosity.allPlansExecution
                : exports.ExplainVerbosity.queryPlanner;
        }
        else {
            this.verbosity = verbosity;
        }
        this.maxTimeMS = maxTimeMS;
    }
    static fromOptions({ explain } = {}) {
        if (explain == null)
            return;
        if (typeof explain === 'boolean' || typeof explain === 'string') {
            return new Explain(explain);
        }
        const { verbosity, maxTimeMS } = explain;
        return new Explain(verbosity, maxTimeMS);
    }
}
exports.Explain = Explain;
/**
 * Applies an explain to a given command.
 * @internal
 *
 * @param command - the command on which to apply the explain
 * @param options - the options containing the explain verbosity
 */
function decorateWithExplain(command, explain) {
    const { verbosity, maxTimeMS } = explain;
    const baseCommand = { explain: command, verbosity };
    if (typeof maxTimeMS === 'number') {
        baseCommand.maxTimeMS = maxTimeMS;
    }
    return baseCommand;
}
//# sourceMappingURL=explain.js.map