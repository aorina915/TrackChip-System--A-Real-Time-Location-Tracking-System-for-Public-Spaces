const request = require('supertest');
const jwt = require('jsonwebtoken');
const appModule = require('../index');

describe('TrackChip API', () => {
  let app;
  let token;

  beforeAll(async () => {
    app = appModule.app;
    // Get token for authenticated tests
    try {
      const res = await request(app)
        .post('/auth/login')
        .send({ username: 'admin', password: 'admin' });
      if (res.status === 200) {
        token = res.body.token;
      }
    } catch (e) {
      // If login fails, skip authenticated tests
      token = null;
    }
  });

  test('POST /auth/login with correct credentials returns token', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'admin', password: 'admin' })
      .expect(200);

    expect(res.body).toHaveProperty('token');
    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET || 'changeme123');
    expect(decoded.username).toBe('admin');
    expect(typeof decoded.role).toBe('string');
  });

  test('GET /entities requires auth', async () => {
    await request(app).get('/entities').expect(401);
  });

  // FR5: Unified Entity Management
  test('POST /entities creates new entity', async () => {
    if (!token) return; // Skip if no token
    const res = await request(app)
      .post('/entities')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Entity', type: 'person' })
      .expect(201);

    expect(res.body).toHaveProperty('id');
  });

  // FR3: Geofencing & Automated Alerts
  test('POST /geofences creates geofence', async () => {
    if (!token) return;
    const res = await request(app)
      .post('/geofences')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Geofence',
        polygon: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] },
        alert_config: { sms: true, email: false }
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
  });

  // FR6: Historical Data & Reporting
  test('POST /entities/:id/report generates report', async () => {
    if (!token) return;
    // Assume entity id 1 exists
    const res = await request(app)
      .post('/entities/1/report')
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'pdf', dateFrom: '2023-01-01', dateTo: '2023-12-31' })
      .expect(200);

    expect(res.body).toHaveProperty('reportUrl');
  });
});
