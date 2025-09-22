import { Router } from 'express';

import authRoutes from './modules/auth/auth.routes';
import propertyRoutes from './modules/property/property.routes';
import imageRoutes from './modules/property/image.routes';
import locationRoutes from './modules/location/location.routes';
import bookingRoutes from './modules/booking/booking.routes';
import reviewRoutes from './modules/review/review.routes';
import favoriteRoutes from './modules/favorite/favorite.routes';
import messageRoutes from './modules/message/message.routes';

const router = Router();

router.use('/auth', authRoutes);

// keep property routes on /properties
router.use('/properties', propertyRoutes);

// move image routes under a subpath to avoid conflicts
router.use('/properties/images', imageRoutes);

router.use('/locations', locationRoutes);
router.use('/bookings', bookingRoutes);
router.use('/reviews', reviewRoutes);
router.use('/favorites', favoriteRoutes);
router.use('/messages', messageRoutes);

export default router;
