import { Router } from 'express';
import { checkAdmin, createAlbum, createSong, deleteAlbum, deleteSong, getUsers, toggleAdmin } from '../controller/admin.controller.js';
import { protectRoute, requireAdmin } from '../middleware/auth.middleware.js';
import { validateCreateSong, validateCreateAlbum } from '../middleware/validate.middleware.js';

const router = Router();

router.use(protectRoute, requireAdmin);

router.get('/check', checkAdmin);

router.post('/songs', validateCreateSong, createSong);
router.delete('/songs/:id', deleteSong);

router.post('/albums', validateCreateAlbum, createAlbum);
router.delete('/albums/:id', deleteAlbum);

router.get('/users', getUsers);
router.patch('/users/:id/toggle-admin', toggleAdmin);

export default router;
