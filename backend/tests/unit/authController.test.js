const request = require('supertest');
const app = require('../../server');
const User = require('../../src/models/User');

describe('Auth Controller', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'password123',
        role: 'owner'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.role).toBe(userData.role);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.password).toBeUndefined(); // Password should not be returned
    });

    it('should return error for duplicate email', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        role: 'owner'
      };

      // Create user first
      await global.testUtils.createTestUser({ email: userData.email });

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body.error).toBe('User with this email already exists');
      expect(response.body.code).toBe('USER_EXISTS');
    });

    it('should return error for invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'password123',
        role: 'owner'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'email',
            message: expect.stringContaining('valid email')
          })
        ])
      );
    });

    it('should return error for short password', async () => {
      const userData = {
        email: 'test@example.com',
        password: '123',
        role: 'owner'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'password',
            message: expect.stringContaining('at least 6 characters')
          })
        ])
      );
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await global.testUtils.createTestUser({
        email: 'login@example.com',
        password: 'password123'
      });
    });

    it('should login user successfully', async () => {
      const loginData = {
        email: 'login@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe(loginData.email);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.password).toBeUndefined();
    });

    it('should return error for invalid credentials', async () => {
      const loginData = {
        email: 'login@example.com',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.error).toBe('Invalid credentials');
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should return error for non-existent user', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.error).toBe('Invalid credentials');
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('GET /api/auth/profile', () => {
    let token;
    let user;

    beforeEach(async () => {
      user = await global.testUtils.createTestUser({
        email: 'profile@example.com',
        password: 'password123'
      });
      token = global.testUtils.generateTestToken(user._id, user.email, user.role);
    });

    it('should get user profile successfully', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe(user.email);
      expect(response.body.user.role).toBe(user.role);
      expect(response.body.user.password).toBeUndefined();
    });

    it('should return error without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body.code).toBe('TOKEN_MISSING');
    });

    it('should return error with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.code).toBe('TOKEN_INVALID');
    });
  });

  describe('PUT /api/auth/profile', () => {
    let token;
    let user;

    beforeEach(async () => {
      user = await global.testUtils.createTestUser({
        email: 'update@example.com',
        password: 'password123'
      });
      token = global.testUtils.generateTestToken(user._id, user.email, user.role);
    });

    it('should update user profile successfully', async () => {
      const updateData = {
        profile: {
          firstName: 'John',
          lastName: 'Doe',
          company: 'Test Company'
        }
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.profile.firstName).toBe('John');
      expect(response.body.user.profile.lastName).toBe('Doe');
      expect(response.body.user.profile.company).toBe('Test Company');
    });

    it('should update wallet address successfully', async () => {
      const updateData = {
        walletAddress: '0x9876543210987654321098765432109876543210'
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.walletAddress).toBe(updateData.walletAddress);
    });

    it('should return error for invalid wallet address', async () => {
      const updateData = {
        walletAddress: 'invalid-address'
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'walletAddress',
            message: expect.stringContaining('valid Ethereum address')
          })
        ])
      );
    });
  });

  describe('GET /api/auth/public-key', () => {
    it('should return public key successfully', async () => {
      const response = await request(app)
        .get('/api/auth/public-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.publicKey).toBeDefined();
      expect(response.body.keyInfo).toBeDefined();
      expect(typeof response.body.publicKey).toBe('string');
    });
  });
});