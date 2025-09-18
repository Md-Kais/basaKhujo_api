"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.signAccess = signAccess;
exports.signRefresh = signRefresh;
exports.verifyAccess = verifyAccess;
exports.verifyRefresh = verifyRefresh;
const jwt = __importStar(require("jsonwebtoken"));
const config_1 = require("../config");
// ---- Secrets & expirations (as you had) ----
const ACCESS_SECRET = config_1.config.jwt.accessSecret;
const REFRESH_SECRET = config_1.config.jwt.refreshSecret;
const ACCESS_EXPIRES = config_1.config.jwt.accessExpiresIn;
const REFRESH_EXPIRES = config_1.config.jwt.refreshExpiresIn;
// ---- User-defined type guard to narrow jsonwebtoken's union return ----
function isAccessPayload(p) {
    return typeof p !== 'string'
        && typeof p.id === 'string'
        && typeof p.role === 'string';
}
// ---- Sign helpers (compatible with your current call sites) ----
// Tip: only sign the fields you actually need in the token.
function signAccess(payload) {
    const { id, role } = payload;
    const options = { expiresIn: ACCESS_EXPIRES };
    return jwt.sign({ id, role }, ACCESS_SECRET, options);
}
function signRefresh(payload) {
    const { id, role } = payload;
    const options = { expiresIn: REFRESH_EXPIRES };
    return jwt.sign({ id, role }, REFRESH_SECRET, options);
}
// ---- Verify helpers now return a strongly-typed payload ----
function verifyAccess(token) {
    const decoded = jwt.verify(token, ACCESS_SECRET); // string | JwtPayload
    if (!isAccessPayload(decoded))
        throw new Error('Invalid access token payload');
    return decoded;
}
function verifyRefresh(token) {
    const decoded = jwt.verify(token, REFRESH_SECRET); // string | JwtPayload
    if (!isAccessPayload(decoded))
        throw new Error('Invalid refresh token payload');
    return decoded;
}
