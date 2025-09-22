"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const error_1 = require("./middlewares/error");
const property_routes_1 = __importDefault(require("./modules/property/property.routes"));
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const location_routes_1 = __importDefault(require("./modules/location/location.routes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: ['http://localhost:3000'],
    credentials: true, // allow cookies
}));
app.use(express_1.default.json());
app.get('/', (_req, res) => res.status(200).send('BasaKhujo API is running'));
app.get('/health', (_req, res) => res.status(200).json({
    ok: true,
    env: process.env.NODE_ENV || 'dev',
    time: new Date().toISOString(),
}));
// your real APIs
app.use('/api/auth', auth_routes_1.default);
app.use('/api/properties', property_routes_1.default); // etc.
app.use('api/locations', location_routes_1.default);
// 404 and error handlers go LAST
app.use(error_1.notFound);
app.use(error_1.errorHandler);
const port = Number(process.env.PORT) || 10000;
app.listen(port, () => console.log(`API listening on :${port}`));
