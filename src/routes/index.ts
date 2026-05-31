import { Express } from 'express';
import authRouter from './auth';
import optimizeRouter from './optimize';
import resumeRouter from './resume';

export function registerRoutes(app: Express) {
    app.use('/auth', authRouter);
    app.use('/optimize', optimizeRouter);
    app.use('/resume', resumeRouter);
}
