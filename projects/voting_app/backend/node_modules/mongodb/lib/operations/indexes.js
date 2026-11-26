"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListIndexesOperation = exports.DropIndexOperation = exports.CreateIndexesOperation = void 0;
const responses_1 = require("../cmap/wire_protocol/responses");
const utils_1 = require("../utils");
const command_1 = require("./command");
const operation_1 = require("./operation");
const VALID_INDEX_OPTIONS = new Set([
    'background',
    'unique',
    'name',
    'partialFilterExpression',
    'sparse',
    'hidden',
    'expireAfterSeconds',
    'storageEngine',
    'collation',
    'version',
    // text indexes
    'weights',
    'default_language',
    'language_override',
    'textIndexVersion',
    // 2d-sphere indexes
    '2dsphereIndexVersion',
    // 2d indexes
    'bits',
    'min',
    'max',
    // geoHaystack Indexes
    'bucketSize',
    // wildcard indexes
    'wildcardProjection'
]);
function isIndexDirection(x) {
    return (typeof x === 'number' || x === '2d' || x === '2dsphere' || x === 'text' || x === 'geoHaystack');
}
function isSingleIndexTuple(t) {
    return Array.isArray(t) && t.length === 2 && isIndexDirection(t[1]);
}
/**
 * Converts an `IndexSpecification`, which can be specified in multiple formats, into a
 * valid `key` for the createIndexes command.
 */
function constructIndexDescriptionMap(indexSpec) {
    const key = new Map();
    const indexSpecs = !Array.isArray(indexSpec) || isSingleIndexTuple(indexSpec) ? [indexSpec] : indexSpec;
    // Iterate through array and handle different types
    for (const spec of indexSpecs) {
        if (typeof spec === 'string') {
            key.set(spec, 1);
        }
        else if (Array.isArray(spec)) {
            key.set(spec[0], spec[1] ?? 1);
        }
        else if (spec instanceof Map) {
            for (const [property, value] of spec) {
                key.set(property, value);
            }
        }
        else if ((0, utils_1.isObject)(spec)) {
            for (const [property, value] of Object.entries(spec)) {
                key.set(property, value);
            }
        }
    }
    return key;
}
/**
 * Index options whose public name on {@link IndexOptions} differs from the field name the
 * `createIndexes` command expects.
 */
const INDEX_OPTION_RENAMES = new Map([
    ['version', 'v'],
    ['defaultLanguage', 'default_language'],
    ['languageOverride', 'language_override']
]);
/**
 * Receives an index description and returns a modified index description which has mapped the
 * options in {@link INDEX_OPTION_RENAMES} to the field names the `createIndexes` command expects.
 *
 * When `allowUnknownIndexOptions` is `false` (the default), options that are not in the driver's
 * `VALID_INDEX_OPTIONS` allowlist are removed from the description. When `true`, all options are
 * retained and passed through to the server for validation.
 */
function resolveIndexDescription(description, 
// TODO(NODE-7868): Remove allowUnknownIndexOptions with a default behavior of true in a future major version release
allowUnknownIndexOptions) {
    const providedOptions = Object.entries(description).filter(([optionName]) => 
    // Ensure `key` is removed, even when `allowUnknownIndexOptions` is true
    optionName !== 'key' && (allowUnknownIndexOptions || VALID_INDEX_OPTIONS.has(optionName)));
    return Object.fromEntries(providedOptions.map(([name, value]) => [INDEX_OPTION_RENAMES.get(name) ?? name, value]));
}
/** @internal */
class CreateIndexesOperation extends command_1.CommandOperation {
    constructor(parent, collectionName, indexes, 
    // TODO(NODE-7868): Remove allowUnknownIndexOptions with a default behavior of true in a future major version release
    allowUnknownIndexOptions, commandOptions) {
        super(parent, commandOptions);
        this.SERVER_COMMAND_RESPONSE_TYPE = responses_1.MongoDBResponse;
        this.options = { ...commandOptions };
        // collation is set on each index, it should not be defined at the root
        this.options.collation = undefined;
        this.collectionName = collectionName;
        this.indexes = indexes.map((userIndex) => {
            // Ensure the key is a Map to preserve index key ordering
            const key = userIndex.key instanceof Map ? userIndex.key : new Map(Object.entries(userIndex.key));
            const name = userIndex.name ?? Array.from(key).flat().join('_');
            const validIndexOptions = resolveIndexDescription(userIndex, allowUnknownIndexOptions);
            return {
                ...validIndexOptions,
                name,
                key
            };
        });
        this.ns = parent.s.namespace;
    }
    /**
     * Index options are carried by the individual {@link IndexDescription} entries of `indexes`,
     * so the only options bag this factory takes is the command one.
     */
    static fromIndexDescriptionArray(parent, collectionName, indexes, 
    // TODO(NODE-7868): Remove allowUnknownIndexOptions with a default behavior of true in a future major version release
    allowUnknownIndexOptions, commandOptions) {
        return new CreateIndexesOperation(parent, collectionName, indexes, allowUnknownIndexOptions, commandOptions);
    }
    static fromIndexSpecification(parent, collectionName, indexSpec, allowUnknownIndexOptions, indexOptions, commandOptions) {
        const key = constructIndexDescriptionMap(indexSpec);
        // If called with overload using `CreateIndexesOptions`, then indexOptions may contain combined index and command options
        // These are filtered in CreateIndexesOperation using VALID_INDEX_OPTIONS.
        // Otherwise, `IndexOptions` only contains index options (which is the ultimate goal anyway)
        const description = { ...indexOptions, key };
        return new CreateIndexesOperation(parent, collectionName, [description], allowUnknownIndexOptions, 
        // TODO(NODE-7868): Remove the `?? indexOptions` fallback along with the two parameter path.
        // Once `indexOptions` is index options only it must not reach the command root.
        commandOptions ?? indexOptions);
    }
    get commandName() {
        return 'createIndexes';
    }
    buildCommandDocument(_connection) {
        const options = this.options;
        const indexes = this.indexes;
        const cmd = { createIndexes: this.collectionName, indexes };
        if (options.commitQuorum != null) {
            cmd.commitQuorum = options.commitQuorum;
        }
        return cmd;
    }
    handleOk(_response) {
        const indexNames = this.indexes.map(index => index.name || '');
        return indexNames;
    }
}
exports.CreateIndexesOperation = CreateIndexesOperation;
/** @internal */
class DropIndexOperation extends command_1.CommandOperation {
    constructor(collection, indexName, options) {
        super(collection, options);
        this.SERVER_COMMAND_RESPONSE_TYPE = responses_1.MongoDBResponse;
        this.options = options ?? {};
        this.collection = collection;
        this.indexName = indexName;
        this.ns = collection.fullNamespace;
    }
    get commandName() {
        return 'dropIndexes';
    }
    buildCommandDocument(_connection) {
        return { dropIndexes: this.collection.collectionName, index: this.indexName };
    }
}
exports.DropIndexOperation = DropIndexOperation;
/** @internal */
class ListIndexesOperation extends command_1.CommandOperation {
    constructor(collection, options) {
        super(collection, options);
        this.SERVER_COMMAND_RESPONSE_TYPE = responses_1.CursorResponse;
        this.options = { ...options };
        delete this.options.writeConcern;
        this.collectionNamespace = collection.s.namespace;
    }
    get commandName() {
        return 'listIndexes';
    }
    buildCommandDocument(_connection) {
        const cursor = this.options.batchSize ? { batchSize: this.options.batchSize } : {};
        const command = { listIndexes: this.collectionNamespace.collection, cursor };
        // we check for undefined specifically here to allow falsy values
        // eslint-disable-next-line no-restricted-syntax
        if (this.options.comment !== undefined) {
            command.comment = this.options.comment;
        }
        return command;
    }
    handleOk(response) {
        return response;
    }
}
exports.ListIndexesOperation = ListIndexesOperation;
(0, operation_1.defineAspects)(ListIndexesOperation, [
    operation_1.Aspect.READ_OPERATION,
    operation_1.Aspect.RETRYABLE,
    operation_1.Aspect.CURSOR_CREATING,
    operation_1.Aspect.SUPPORTS_RAW_DATA
]);
(0, operation_1.defineAspects)(CreateIndexesOperation, [operation_1.Aspect.WRITE_OPERATION, operation_1.Aspect.SUPPORTS_RAW_DATA]);
(0, operation_1.defineAspects)(DropIndexOperation, [operation_1.Aspect.WRITE_OPERATION, operation_1.Aspect.SUPPORTS_RAW_DATA]);
//# sourceMappingURL=indexes.js.map