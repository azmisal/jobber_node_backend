import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

import { registerRoutes } from './routes';
import { connectDB } from './database/connection';

// Load environment variables
dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

registerRoutes(app);

const PORT = process.env.PORT || 8000;
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});
