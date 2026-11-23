require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const logger = require('../utils/logger');
const connectDB = require('../config/database');

/**
 * Seed script to add admin user
 */
const seedAdminUser = async () => {
  try {
    // Require explicit administrator credentials for initial account creation.
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be configured before seeding an administrator');
    }

    // Connect to database
    await connectDB();
    logger.info('Database connected successfully');

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: process.env.ADMIN_EMAIL });
    
    if (existingAdmin) {
      logger.info('Admin user already exists');
      console.log('Admin user already exists:', existingAdmin.email);
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
    console.log('Admin user created successfully:');
    console.log('Email:', adminUser.email);
    console.log('Role:', adminUser.role);
    
    // Close database connection
    await mongoose.connection.close();
    logger.info('Database connection closed');
    
    return adminUser;
  } catch (error) {
    logger.error('Failed to seed admin user:', error);
    console.error('Error seeding admin user:', error.message);
    process.exit(1);
  }
};

// Run seed function if called directly
if (require.main === module) {
  seedAdminUser();
}

module.exports = { seedAdminUser };