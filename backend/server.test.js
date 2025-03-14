const request = require('supertest');
const app = require('./server');

describe('API Endpoints', () => {
  describe('GET /health', () => {
    it('returns status ok', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });

  describe('POST /auth/login', () => {
    it('accepts valid credentials', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ username: 'test', password: 'test' })
        .expect(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('GET /mics', () => {
    it('returns mics within date range', async () => {
      const res = await request(app)
        .get('/mics')
        .query({ start: '2025-01-01', end: '2025-02-01' })
        .expect(200);
      expect(res.body).toHaveProperty('mics');
      expect(Array.isArray(res.body.mics)).toBe(true);
    });
  });

  describe('CRUD /mics', () => {
    it('creates a new mic', async () => {
      const micData = { name: 'Test Mic', date: '2025-01-01' };
      const res = await request(app)
        .post('/mics')
        .send(micData)
        .expect(200);
      expect(res.body.mic).toMatchObject(micData);
    });

    // it('returns 404 for non-existent mic', async () => {
    //   await request(app)
    //     .get('/mics/999999')
    //     .expect(404);
    // });
  });
});
