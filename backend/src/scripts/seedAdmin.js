const mongoose = require('mongoose');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Seed admin user if it doesn't exist
 */
const seedAdmin = async () => {
  try {
    // Never silently create an administrator with shared, hard-coded credentials.
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be configured before seeding an administrator');
    }

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: process.env.ADMIN_EMAIL });
    
    if (existingAdmin) {
      logger.info('Admin user already exists');
      return existingAdmin;
    }

    // Create admin user
    const adminUser = new User({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      role: 'admin',
      isActive: true,
      profile: {
        firstName: 'System',
        lastName: 'Administrator',
        company: 'GYD Platform'
      }
    });

    await adminUser.save();
    logger.info(`Admin user created: ${adminUser.email}`);
    
    return adminUser;
  } catch (error) {
    logger.error('Failed to seed admin user:', error);
    throw error;
  }
};

module.exports = { seedAdmin };