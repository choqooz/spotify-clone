import { Router } from "express";
import { authCallback } from "../controller/auth.controller.js";

const router = Router();

/**
 * @swagger
 * /api/auth/callback:
 *   post:
 *     summary: Clerk authentication callback — upserts user in database
 *     description: Called after a user signs in via Clerk. Creates the user if they don't exist, or returns the existing record.
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User already exists — returned as-is
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       201:
 *         description: New user created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized — invalid or missing Clerk token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/callback", authCallback);

export default router;
