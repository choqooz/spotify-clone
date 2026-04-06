import mongoose from "mongoose";
import { logger } from "./logger.js";

export const connectDB = async () => {
	try {
		const conn = await mongoose.connect(process.env.MONGODB_URI);
		logger.info({ host: conn.connection.host }, 'Connected to MongoDB');
	} catch (error) {
		logger.error({ err: error }, 'Failed to connect to MongoDB');
		process.exit(1);
	}
};
