import { Router } from 'express';
import { getFavorites, addFavorite, removeFavorite, checkFavorite } from '../controller/favorite.controller.js';
import { protectRoute } from '../middleware/auth.middleware.js';

const router = Router();

router.use(protectRoute);

router.get('/', getFavorites);
router.get('/:songId/check', checkFavorite);
router.post('/:songId', addFavorite);
router.delete('/:songId', removeFavorite);

export default router;
