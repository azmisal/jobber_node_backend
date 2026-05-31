import { User, IUser } from './user';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

export const hashPassword = async (password: string) => {
    return await bcrypt.hash(password, 10);
};

export const verifyPassword = async (password: string, hash: string) => {
    return await bcrypt.compare(password, hash);
};

export const createJWT = (user: IUser) => {
    return jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
};

export const verifyJWT = (token: string) => {
    return jwt.verify(token, JWT_SECRET);
};
