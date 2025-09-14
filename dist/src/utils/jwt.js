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
// Normalize secrets so they’re never undefined
const ACCESS_SECRET = config_1.config.jwt.accessSecret;
const REFRESH_SECRET = config_1.config.jwt.refreshSecret;
// Normalize expires to the exact type accepted by jsonwebtoken@9
const ACCESS_EXPIRES = config_1.config.jwt.accessExpiresIn;
const REFRESH_EXPIRES = config_1.config.jwt.refreshExpiresIn;
function signAccess(payload) {
    const options = { expiresIn: ACCESS_EXPIRES };
    return jwt.sign(payload, ACCESS_SECRET, options);
}
function signRefresh(payload) {
    const options = { expiresIn: REFRESH_EXPIRES };
    return jwt.sign(payload, REFRESH_SECRET, options);
}
function verifyAccess(token) {
    return jwt.verify(token, ACCESS_SECRET);
}
function verifyRefresh(token) {
    return jwt.verify(token, REFRESH_SECRET);
}
