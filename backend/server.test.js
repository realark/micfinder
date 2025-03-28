const request = require('supertest');
const { GenericContainer } = require('testcontainers');
const fs = require('fs').promises;
const path = require('path');
const { Client } = require('pg');
const bcrypt = require('bcrypt');
const testEmail = 'test@example.com'
const testPassword = 'password'
const crypto = require('crypto');

describe('API Endpoints', () => {
  let container;
  let app, shutdown;

  beforeAll(async () => {
    container = await new GenericContainer('postgres:16')
      .withExposedPorts(5432)
      .withEnvironment({
        POSTGRES_USER: 'openmics',
        POSTGRES_PASSWORD: 'password',
        POSTGRES_DB: 'openmics'
      })
      .start();

    const port = container.getMappedPort(5432);
    const client = new Client({
      host: container.getHost(),
      port: port,
      user: 'openmics',
      password: 'password',
      database: 'openmics'
    });
    await client.connect();

    const schemaSQL = await fs.readFile(path.join(__dirname, '../schema.sql'), 'utf8');
    await client.query(schemaSQL);

    // No user registration endpoint so we'll make one in the database
    const passwordHash = await bcrypt.hash(testPassword, 10);
    const userResult = await client.query(`
      INSERT INTO app_user (email, full_name, password_hash)
      VALUES ($1, 'Test User', $2)
      RETURNING id
    `, [testEmail, passwordHash]);
    await client.end();
    process.env.JWT_SECRET="unittest";
    process.env.PG_HOST = container.getHost();
    process.env.PG_PORT = port;
    process.env.PG_USER = "openmics";
    process.env.PG_DATABASE = "openmics";
    process.env.PG_PASSWORD = "password";
    process.env.PG_SSL = false;
    ({ app, shutdown } = require('./server'));
  }, 60000); // long timeout for container startup

  afterAll(async () => {
    await shutdown();
    if (container) {
      await container.stop();
    }
  });

  it('healthcheck', async () => {
    const res = await request(app)
      .get('/health')
      .expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  describe('login', () => {
    it('rejects invalid credentials', async () => {
      await request(app)
        .post('/auth/login')
        .send({ email: testEmail, password: 'wrongpassword' })
        .expect(401);
      await request(app)
        .post('/auth/login')
        .send({ email: 'bogus@wrong.com', password: testPassword })
        .expect(401);
    });

    it('accepts valid credentials', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: testEmail, password: testPassword })
        .expect(200);

      expect(res.body).toHaveProperty('token');
    });

    it('password requirements', async () => {
      const authToken = (await request(app)
        .post('/auth/login')
        .send({ email: testEmail, password: testPassword })
        .expect(200))
        .body.token;

      await request(app)
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ newPassword: 'short' })
        .expect(400);
    });

    it('changes password successfully', async () => {
      const newPassword = 'newpassword123';
      // Login with original password
      const authToken = (await request(app)
        .post('/auth/login')
        .send({ email: testEmail, password: testPassword })
        .expect(200))
        .body.token;
      // Change password
      await request(app)
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ newPassword: newPassword })
        .expect(200);
      // Old password should no longer work
      await request(app)
        .post('/auth/login')
        .send({ email: testEmail, password: testPassword })
        .expect(401);
      // New password should work
      const newToken = (await request(app)
        .post('/auth/login')
        .send({ email: testEmail, password: newPassword })
        .expect(200))
        .body.token;
      // change it back to the original password
      const resp = await request(app)
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${newToken}`)
        .send({ newPassword: testPassword })
        .expect(200);
    });
  });

  // Doing all CRUD inside a single test for convenience.
  // TODO: factor out if this grows more complex
  it('mic CRUD', async () => {
    let micData = {
      name: 'Test Open Mic',
      location: 'Test Venue',
      startDate: '20250101',
      contactInfo: 'test@venue.com',
      recurrence: 'RRULE:FREQ=WEEKLY;BYDAY=MO',
      showTime: '19:00',
    };
    const authToken = (await request(app)
      .post('/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(200))
      .body.token;
    let createdMicId
    { // C
      await request(app)
          .post('/mics')
          .set('Authorization', `Bearer badtoken`)
          .send(micData)
          .expect(401);
      const createRes = await request(app)
        .post('/mics')
        .set('Authorization', `Bearer ${authToken}`)
        .send(micData)
        .expect(200);
      expect(createRes.body.mic).toMatchObject(micData);
      micData = createRes.body.mic
      createdMicId = createRes.body.mic.id;
    }
    { // R
      const allMicsRes = await request(app)
        .get('/mics')
        .expect(200);
      expect(allMicsRes.body).toHaveProperty('mics');
      expect(Array.isArray(allMicsRes.body.mics)).toBe(true);
      expect(allMicsRes.body.mics.length).toBeGreaterThan(0);
      const specificMicRes = await request(app)
        .get(`/mics/${createdMicId}`)
        .expect(200);
      expect(specificMicRes.body.mic.name).toBe('Test Open Mic');
      // non-existant mic should 404
      await request(app)
        .get('/mics/' + crypto.randomUUID())
        .expect(404);
    }
    { // U
      const updatedData = {
        ...micData,
        name: 'Updated Open Mic',
        location: 'Updated Venue',
        startDate: '20240301',
        showTime: '19:30',
        contactInfo: 'updated@venue.com'
      };
      await request(app)
        .put(`/mics/${createdMicId}`)
        .set('Authorization', `Bearer badtoken`)
        .send(updatedData)
        .expect(401);
      const res = await request(app)
        .put(`/mics/${createdMicId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updatedData)
        .expect(200);
      expect(res.body.mic.name).toBe('Updated Open Mic');
      expect(res.body.mic.location).toBe('Updated Venue');
      micData = res.body.mic;
      // missing required field
      await request(app)
        .put(`/mics/${createdMicId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...updatedData, location: undefined })
        .expect(400);
      // Add extra field
      await request(app)
        .put(`/mics/${createdMicId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...updatedData, anextrafield: "not allowed" })
        .expect(400);
    }
    { // D
      await request(app)
        .delete(`/mics/${createdMicId}`)
        .set('Authorization', `Bearer badtoken`)
        .send({ edit_version: micData.edit_version })
        .expect(401);
      await request(app)
        .delete(`/mics/${createdMicId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ edit_version: micData.edit_version })
        .expect(200);
      // Verify it's deleted
      await request(app)
        .get(`/mics/${createdMicId}`)
        .expect(404);
    }
  });

  it('prevents HTML injection in mic data', async () => {
    const authToken = (await request(app)
      .post('/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(200))
      .body.token;
    const maliciousMicData = {
      name: '<script>alert("XSS")</script>Malicious Mic',
      location: 'Venue <img src="x" onerror="alert(\'XSS\')">',
      startDate: '20250101',
      contactInfo: '<a href="javascript:alert(\'XSS\')">contact@example.com</a>',
      recurrence: 'RRULE:FREQ=WEEKLY;BYDAY=MO',
      showTime: '19:00',
    };
    const createRes = await request(app)
      .post('/mics')
      .set('Authorization', `Bearer ${authToken}`)
      .send(maliciousMicData)
      .expect(200);
    const createdMicId = createRes.body.mic.id;

    // Retrieve the mic to check if HTML was sanitized
    const getRes = await request(app)
      .get(`/mics/${createdMicId}`)
      .expect(200);
    const retrievedMic = getRes.body.mic;
    // Check that the HTML tags are either escaped or removed
    // This test assumes the server is sanitizing the input in some way
    expect(retrievedMic.name).not.toContain('<script>');
    expect(retrievedMic.location).not.toContain('onerror=');
    expect(retrievedMic.contactInfo).not.toContain('javascript:');

    // Clean up
    await request(app)
      .delete(`/mics/${createdMicId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ edit_version: retrievedMic.edit_version })
      .expect(200);
  });
});
