import { Router, Request, Response } from 'express';
import { Resume } from '../models/resume';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'changeme';
const authMiddleware = (req: Request, res: Response, next: Function) => {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'No token' });
    try {
        const token = auth.split(' ')[1];
        const payload = jwt.verify(token, JWT_SECRET) as any;
        (req as any).user = payload;
        next();
    } catch {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Create resume
router.post('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { content } = req.body;
        const resume = await Resume.create({ user: userId, content });
        res.json(resume);
    } catch (err) {
        res.status(500).json({ error: 'Create failed' });
    }
});

// Get all resumes for user
router.get('/', authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const resumes = await Resume.find({ user: userId });
    res.json(resumes);
});

// Get single resume
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const resume = await Resume.findOne({ _id: req.params.id, user: userId });
    if (!resume) return res.status(404).json({ error: 'Not found' });
    res.json(resume);
});

// Update resume
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { content } = req.body;
    const resume = await Resume.findOneAndUpdate(
        { _id: req.params.id, user: userId },
        { content },
        { new: true }
    );
    if (!resume) return res.status(404).json({ error: 'Not found' });
    res.json(resume);
});

// Delete resume
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const result = await Resume.findOneAndDelete({ _id: req.params.id, user: userId });
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
});

export default router;
