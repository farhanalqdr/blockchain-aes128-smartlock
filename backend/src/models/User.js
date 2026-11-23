const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    required: true,
    enum: ['owner', 'admin', 'device'],
    default: 'owner'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  profile: {
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    company: { type: String, trim: true }
  },
  lastLogin: { type: Date }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Generate salt and hash password
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password for login
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to get user profile without sensitive data
userSchema.methods.toProfileJSON = function() {
  return {
    id: this._id,
    email: this.email,
    role: this.role,
    isActive: this.isActive,
    profile: this.profile,
    createdAt: this.createdAt,
    lastLogin: this.lastLogin
  };
};

// Indexes for better query performance
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });

module.exports = mongoose.model('User', userSchema);