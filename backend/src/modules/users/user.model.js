
import mongoose from 'mongoose'
import bcrypt from 'bcrypt'
import { publicUrl } from '../../services/storage.service.js'

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 60,
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },

    // Saudi mobile in +9665XXXXXXXX form
    phone: {
      type: String,
      trim: true,
      default: null,
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 8,
      select: false,
    },

    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },

    // Buyers can browse, save and chat; sellers can also post ads once an admin approves them
    accountType: {
      type: String,
      enum: ['buyer', 'seller'],
      default: 'buyer',
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: ['pending', 'active', 'suspended', 'deleted'],
      default: 'active',
    },

    city: {
      type: String,
      trim: true,
      default: null,
    },

    // Storage key of the profile photo; the public URL is added in toJSON
    avatarKey: {
      type: String,
      default: null,
    },

    deletionRequestedAt: {
      type: Date,
      default: null,
    },

    deletionReason: {
      type: String,
      default: null,
      maxlength: 500,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

userSchema.index({ deletionRequestedAt: 1 }, { partialFilterExpression: { deletionRequestedAt: { $type: 'date' } } })

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return

  this.password = await bcrypt.hash(this.password, 12)
})

// Compare entered password with hashed password
userSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password)
}

// Remove sensitive fields from JSON responses
userSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    returnedObject.avatarUrl = publicUrl(returnedObject.avatarKey)
    delete returnedObject.password
    delete returnedObject.avatarKey
    delete returnedObject.__v
    return returnedObject
  },
})

const User = mongoose.model('User', userSchema)

export default User
