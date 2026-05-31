import { Schema, model, Document, Types } from 'mongoose';

export interface IHistory extends Document {
    user: Types.ObjectId;
    action: string;
    details: string;
    createdAt: Date;
}

const HistorySchema = new Schema<IHistory>({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    details: { type: String },
}, { timestamps: { createdAt: true, updatedAt: false } });

export const History = model<IHistory>('History', HistorySchema);
