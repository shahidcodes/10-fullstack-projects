"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeprioritizedServers = exports.MIN_SECONDARY_WRITE_WIRE_VERSION = void 0;
exports.writableServerSelector = writableServerSelector;
exports.sameServerSelector = sameServerSelector;
exports.secondaryWritableServerSelector = secondaryWritableServerSelector;
exports.readPreferenceServerSelector = readPreferenceServerSelector;
const error_1 = require("../error");
const read_preference_1 = require("../read_preference");
const common_1 = require("./common");
// max staleness constants
const IDLE_WRITE_PERIOD = 10000;
const SMALLEST_MAX_STALENESS_SECONDS = 90;
//  Minimum version to try writes on secondaries.
exports.MIN_SECONDARY_WRITE_WIRE_VERSION = 13;
/** @internal */
class DeprioritizedServers {
    constructor(descriptions) {
        this.deprioritized = new Set();
        for (const description of descriptions ?? []) {
            this.add(description);
        }
    }
    add({ address }) {
        this.deprioritized.add(address);
    }
    has({ address }) {
        return this.deprioritized.has(address);
    }
}
exports.DeprioritizedServers = DeprioritizedServers;
function filterDeprioritized(candidates, deprioritized) {
    const filtered = candidates.filter(candidate => !deprioritized.has(candidate));
    return filtered.length ? filtered : candidates;
}
/**
 * Returns a server selector that selects for writable servers
 */
function writableServerSelector() {
    return function writableServer(topologyDescription, servers, deprioritized) {
        const eligibleServers = filterDeprioritized(servers.filter(({ isWritable }) => isWritable), deprioritized);
        return latencyWindowReducer(topologyDescription, eligibleServers);
    };
}
/**
 * The purpose of this selector is to select the same server, only
 * if it is in a state that it can have commands sent to it.
 */
function sameServerSelector(description) {
    return function sameServerSelector(_topologyDescription, servers, _deprioritized) {
        if (!description)
            return [];
        // Filter the servers to match the provided description only if
        // the type is not unknown.
        return servers.filter(sd => {
            return sd.address === description.address && sd.type !== common_1.ServerType.Unknown;
        });
    };
}
/**
 * Returns a server selector that uses a read preference to select a
 * server potentially for a write on a secondary.
 */
function secondaryWritableServerSelector(wireVersion, readPreference) {
    // If server version < 5.0, read preference always primary.
    // If server version >= 5.0...
    // - If read preference is supplied, use that.
    // - If no read preference is supplied, use primary.
    if (!readPreference ||
        !wireVersion ||
        (wireVersion && wireVersion < exports.MIN_SECONDARY_WRITE_WIRE_VERSION)) {
        return readPreferenceServerSelector(read_preference_1.ReadPreference.primary);
    }
    return readPreferenceServerSelector(readPreference);
}
/**
 * Reduces the passed in array of servers by the rules of the "Max Staleness" specification
 * found here:
 *
 * @see https://github.com/mongodb/specifications/blob/master/source/max-staleness/max-staleness.md
 *
 * @param readPreference - The read preference providing max staleness guidance
 * @param topologyDescription - The topology description
 * @param servers - The list of server descriptions to be reduced
 * @returns The list of servers that satisfy the requirements of max staleness
 */
function maxStalenessReducer(readPreference, topologyDescription, servers) {
    if (readPreference.maxStalenessSeconds == null || readPreference.maxStalenessSeconds < 0) {
        return servers;
    }
    const maxStaleness = readPreference.maxStalenessSeconds;
    const maxStalenessVariance = (topologyDescription.heartbeatFrequencyMS + IDLE_WRITE_PERIOD) / 1000;
    if (maxStaleness < maxStalenessVariance) {
        throw new error_1.MongoInvalidArgumentError(`Option "maxStalenessSeconds" must be at least ${maxStalenessVariance} seconds`);
    }
    if (maxStaleness < SMALLEST_MAX_STALENESS_SECONDS) {
        throw new error_1.MongoInvalidArgumentError(`Option "maxStalenessSeconds" must be at least ${SMALLEST_MAX_STALENESS_SECONDS} seconds`);
    }
    if (topologyDescription.type === common_1.TopologyType.ReplicaSetWithPrimary) {
        const primary = Array.from(topologyDescription.servers.values()).filter(primaryFilter)[0];
        return servers.filter((server) => {
            const stalenessMS = server.lastUpdateTime -
                server.lastWriteDate -
                (primary.lastUpdateTime - primary.lastWriteDate) +
                topologyDescription.heartbeatFrequencyMS;
            const staleness = stalenessMS / 1000;
            const maxStalenessSeconds = readPreference.maxStalenessSeconds ?? 0;
            return staleness <= maxStalenessSeconds;
        });
    }
    if (topologyDescription.type === common_1.TopologyType.ReplicaSetNoPrimary) {
        if (servers.length === 0) {
            return servers;
        }
        const sMax = servers.reduce((max, s) => s.lastWriteDate > max.lastWriteDate ? s : max);
        return servers.filter((server) => {
            const stalenessMS = sMax.lastWriteDate - server.lastWriteDate + topologyDescription.heartbeatFrequencyMS;
            const staleness = stalenessMS / 1000;
            const maxStalenessSeconds = readPreference.maxStalenessSeconds ?? 0;
            return staleness <= maxStalenessSeconds;
        });
    }
    return servers;
}
/**
 * Determines whether a server's tags match a given set of tags.
 *
 * A tagset matches the server's tags if every k-v pair in the tagset
 * is also in the server's tagset.
 *
 * Note that this does not requires that every k-v pair in the server's tagset is also
 * in the client's tagset.  The server's tagset is required only to be a superset of the
 * client's tags.
 *
 * @see https://github.com/mongodb/specifications/blob/master/source/server-selection/server-selection.md#tag_sets
 *
 * @param tagSet - The requested tag set to match
 * @param serverTags - The server's tags
 */
function tagSetMatch(tagSet, serverTags) {
    return Object.entries(tagSet).every(([key, value]) => serverTags[key] != null && serverTags[key] === value);
}
/**
 * Reduces a set of server descriptions based on tags requested by the read preference
 *
 * @param readPreference - The read preference providing the requested tags
 * @param servers - The list of server descriptions to reduce
 * @returns The list of servers matching the requested tags
 */
function tagSetReducer({ tags }, servers) {
    if (tags == null || tags.length === 0) {
        // empty tag sets match all servers
        return servers;
    }
    for (const tagSet of tags) {
        const serversMatchingTagset = servers.filter((s) => tagSetMatch(tagSet, s.tags));
        if (serversMatchingTagset.length) {
            return serversMatchingTagset;
        }
    }
    return [];
}
/**
 * Reduces a list of servers to ensure they fall within an acceptable latency window. This is
 * further specified in the "Server Selection" specification, found here:
 *
 * @see https://github.com/mongodb/specifications/blob/master/source/server-selection/server-selection.md
 *
 * @param topologyDescription - The topology description
 * @param servers - The list of servers to reduce
 * @returns The servers which fall within an acceptable latency window
 */
function latencyWindowReducer(topologyDescription, servers) {
    const low = servers.reduce((min, server) => Math.min(server.roundTripTime, min), Infinity);
    const high = low + topologyDescription.localThresholdMS;
    return servers.filter(server => server.roundTripTime <= high && server.roundTripTime >= low);
}
// filters
function primaryFilter(server) {
    return server.type === common_1.ServerType.RSPrimary;
}
function secondaryFilter(server) {
    return server.type === common_1.ServerType.RSSecondary;
}
function nearestFilter(server) {
    return server.type === common_1.ServerType.RSSecondary || server.type === common_1.ServerType.RSPrimary;
}
function knownFilter(server) {
    return server.type !== common_1.ServerType.Unknown;
}
function loadBalancerFilter(server) {
    return server.type === common_1.ServerType.LoadBalancer;
}
function isDeprioritizedFactory(deprioritized) {
    return server => 
    // if any deprioritized servers equal the server, here we are.
    !deprioritized.has(server);
}
function secondarySelector(readPreference, topologyDescription, servers, deprioritized) {
    const mode = readPreference.mode;
    switch (mode) {
        case 'primary':
            // Note: no need to filter for deprioritized servers.  A replica set has only one primary; that means that
            // we are in one of two scenarios:
            // 1. deprioritized servers is empty - return the primary.
            // 2. deprioritized servers contains the primary - return the primary.
            return servers.filter(primaryFilter);
        case 'primaryPreferred': {
            const primary = servers.filter(primaryFilter);
            // If there is a primary and it is not deprioritized, use the primary.  Otherwise,
            // check for secondaries.
            const eligiblePrimary = primary.filter(isDeprioritizedFactory(deprioritized));
            if (eligiblePrimary.length) {
                return eligiblePrimary;
            }
            // If we make it here, we either have:
            // 1. a deprioritized primary
            // 2. no eligible primary
            // secondaries take precedence of deprioritized primaries.
            const secondaries = tagSetReducer(readPreference, maxStalenessReducer(readPreference, topologyDescription, servers.filter(secondaryFilter)));
            const eligibleSecondaries = secondaries.filter(isDeprioritizedFactory(deprioritized));
            if (eligibleSecondaries.length) {
                return latencyWindowReducer(topologyDescription, eligibleSecondaries);
            }
            // if we make it here, we have no primaries or secondaries that not deprioritized.
            // prefer the primary (which may not exist, if the topology has no primary).
            // otherwise, return the secondaries (which also may not exist, but there is nothing else to check here).
            return primary.length ? primary : latencyWindowReducer(topologyDescription, secondaries);
        }
        case 'nearest': {
            const eligible = filterDeprioritized(tagSetReducer(readPreference, maxStalenessReducer(readPreference, topologyDescription, servers.filter(nearestFilter))), deprioritized);
            return latencyWindowReducer(topologyDescription, eligible);
        }
        case 'secondary':
        case 'secondaryPreferred': {
            const secondaries = tagSetReducer(readPreference, maxStalenessReducer(readPreference, topologyDescription, servers.filter(secondaryFilter)));
            const eligibleSecondaries = secondaries.filter(isDeprioritizedFactory(deprioritized));
            if (eligibleSecondaries.length) {
                return latencyWindowReducer(topologyDescription, eligibleSecondaries);
            }
            // we have no eligible secondaries, try for a primary if we can.
            if (mode === read_preference_1.ReadPreference.SECONDARY_PREFERRED) {
                const primary = servers.filter(primaryFilter);
                // unlike readPreference=primary, here we do filter for deprioritized servers.
                // if the primary is deprioritized, deprioritized secondaries take precedence.
                const eligiblePrimary = primary.filter(isDeprioritizedFactory(deprioritized));
                if (eligiblePrimary.length)
                    return eligiblePrimary;
                // we have no eligible primary nor secondaries that have not been deprioritized
                return secondaries.length
                    ? latencyWindowReducer(topologyDescription, secondaries)
                    : primary;
            }
            // return all secondaries in the latency window.
            return latencyWindowReducer(topologyDescription, secondaries);
        }
        default: {
            const _exhaustiveCheck = mode;
            throw new error_1.MongoRuntimeError(`unexpected readPreference=${mode} (should never happen).  Please report a bug in the Node driver Jira project.`);
        }
    }
}
/**
 * Returns a function which selects servers based on a provided read preference
 *
 * @param readPreference - The read preference to select with
 */
function readPreferenceServerSelector(readPreference) {
    if (!readPreference.isValid()) {
        throw new error_1.MongoInvalidArgumentError('Invalid read preference specified');
    }
    return function readPreferenceServers(topologyDescription, servers, deprioritized) {
        switch (topologyDescription.type) {
            case 'Single':
                return latencyWindowReducer(topologyDescription, servers.filter(knownFilter));
            case 'ReplicaSetNoPrimary':
            case 'ReplicaSetWithPrimary':
                return secondarySelector(readPreference, topologyDescription, servers, deprioritized);
            case 'Sharded': {
                const selectable = filterDeprioritized(servers, deprioritized);
                return latencyWindowReducer(topologyDescription, selectable.filter(knownFilter));
            }
            case 'Unknown':
                return [];
            case 'LoadBalanced':
                return servers.filter(loadBalancerFilter);
            default: {
                const _exhaustiveCheck = topologyDescription.type;
                throw new error_1.MongoRuntimeError(`unexpected topology type: ${topologyDescription.type} (this should never happen).  Please file a bug in the Node driver Jira project.`);
            }
        }
    };
}
//# sourceMappingURL=server_selection.js.map