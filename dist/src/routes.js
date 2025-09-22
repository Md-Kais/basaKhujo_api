"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const property_routes_1 = __importDefault(require("./modules/property/property.routes"));
const image_routes_1 = __importDefault(require("./modules/property/image.routes"));
const location_routes_1 = __importDefault(require("./modules/location/location.routes"));
const booking_routes_1 = __importDefault(require("./modules/booking/booking.routes"));
const review_routes_1 = __importDefault(require("./modules/review/review.routes"));
const favorite_routes_1 = __importDefault(require("./modules/favorite/favorite.routes"));
const message_routes_1 = __importDefault(require("./modules/message/message.routes"));
const router = (0, express_1.Router)();
router.use('/auth', auth_routes_1.default);
// keep property routes on /properties
router.use('/properties', property_routes_1.default);
// move image routes under a subpath to avoid conflicts
router.use('/properties/images', image_routes_1.default);
router.use('/locations', location_routes_1.default);
router.use('/bookings', booking_routes_1.default);
router.use('/reviews', review_routes_1.default);
router.use('/favorites', favorite_routes_1.default);
router.use('/messages', message_routes_1.default);
exports.default = router;
