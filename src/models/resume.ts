import { Schema, model, Document, Types } from 'mongoose';

export interface IResume extends Document {
    user: Types.ObjectId;
    content: string;
    createdAt: Date;
    updatedAt: Date;
}

const ResumeSchema = new Schema<IResume>({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
}, { timestamps: true });

export const Resume = model<IResume>('Resume', ResumeSchema);
