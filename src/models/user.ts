// src/models/user.model.ts

import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  username: string;
  email: string;
  password_hash: string;
}

export interface UserSignup {
  username: string;
  email: string;
  password: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface UserResponse {
  id: string;
  username: string;
  email: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: UserResponse;
}

const UserSchema = new Schema<IUser>({
  username: {
    type: String,
    required: true,
    minlength: 2,
    maxlength: 50,
  },

  email: {
    type: String,
    required: true,
    unique: true,
  },

  password_hash: {
    type: String,
    required: true,
  },
});

export default mongoose.model<IUser>("User", UserSchema);