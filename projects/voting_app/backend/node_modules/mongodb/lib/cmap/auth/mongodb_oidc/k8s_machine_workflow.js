"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.k8sCallback = void 0;
const promises_1 = require("fs/promises");
const process = require("process");
/** The fallback file name */
const FALLBACK_FILENAME = '/var/run/secrets/kubernetes.io/serviceaccount/token';
/** The azure environment variable for the file name. */
const AZURE_FILENAME = 'AZURE_FEDERATED_TOKEN_FILE';
/** The AWS environment variable for the file name. */
const AWS_FILENAME = 'AWS_WEB_IDENTITY_TOKEN_FILE';
/**
 * The callback function to be used in the automated callback workflow.
 * @param params - The OIDC callback parameters.
 * @returns The OIDC response.
 */
const k8sCallback = async () => {
    let filename;
    if (process.env[AZURE_FILENAME]) {
        filename = process.env[AZURE_FILENAME];
    }
    else if (process.env[AWS_FILENAME]) {
        filename = process.env[AWS_FILENAME];
    }
    else {
        filename = FALLBACK_FILENAME;
    }
    const token = await (0, promises_1.readFile)(filename, 'utf8');
    return { accessToken: token };
};
exports.k8sCallback = k8sCallback;
//# sourceMappingURL=k8s_machine_workflow.js.map