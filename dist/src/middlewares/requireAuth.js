"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
// requireAuth.ts
const jwt_1 = require("../utils/jwt");
function requireAuth(req, res, next) {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token)
        return res.status(401).json({ message: 'Missing Authorization header' });
    try {
        const payload = (0, jwt_1.verifyAccess)(token); // typed: { id, role, iat, exp }
        req.user = { id: payload.id, role: payload.role };
        return next();
    }
    catch {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
}
