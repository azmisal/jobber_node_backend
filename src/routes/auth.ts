import { Router, Request, Response } from 'express';
import { User, IUser } from '../models/user';
import { hashPassword, verifyPassword, createJWT } from '../models/auth';

const router = Router();

// Signup
router.post('/signup', async (req: Request, res: Response) => {
    try {
        const { email, password, name } = req.body;
        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ error: 'Email already exists' });
        const hashed = await hashPassword(password);
        const user = await User.create({ email, password: hashed, name });
        const token = createJWT(user);
        res.json({ token, user: { id: user._id, email: user.email, name: user.name } });
    } catch (err) {
        res.status(500).json({ error: 'Signup failed' });
    }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        const valid = await verifyPassword(password, user.password);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
        const token = createJWT(user);
        res.json({ token, user: { id: user._id, email: user.email, name: user.name } });
    } catch (err) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// Auth middleware
import jwt from 'jsonwebtoken';
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

// Get profile
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const user = await User.findById(userId).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
});

export default router;
