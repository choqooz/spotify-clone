import { Router } from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getAllUsers, getMessages } from "../controller/user.controller.js";
const router = Router();

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users (for the friends / activity sidebar)
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of all users except the current user
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/", protectRoute, getAllUsers);

/**
 * @swagger
 * /api/users/messages/{userId}:
 *   get:
 *     summary: Get the message history between the current user and another user
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Clerk ID of the other user
 *         example: user_2xyz789ghi012
 *     responses:
 *       200:
 *         description: Message history sorted by date ascending
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Message'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/messages/:userId", protectRoute, getMessages);

export default router;
