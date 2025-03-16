const { GenericContainer } = require('testcontainers');
const fs = require('fs').promises;
const path = require('path');
const { Client } = require('pg');

describe('Database Schema Tests', () => {
  let container;
  let client;
  let schemaSQL;

  // Read the schema.sql file
  beforeAll(async () => {
    schemaSQL = await fs.readFile(path.join(__dirname, '../schema.sql'), 'utf8');
  });

  // Start a PostgreSQL container before each test
  beforeEach(async () => {
    // Start PostgreSQL container
    container = await new GenericContainer('postgres:16')
      .withExposedPorts(5432)
      .withEnvironment({
        POSTGRES_USER: 'postgres',
        POSTGRES_PASSWORD: 'postgres',
        POSTGRES_DB: 'testdb'
      })
      .start();

    // Connect to the database
    const port = container.getMappedPort(5432);
    client = new Client({
      host: container.getHost(),
      port: port,
      user: 'postgres',
      password: 'postgres',
      database: 'testdb'
    });
    await client.connect();
  }, 60000); // Increase timeout for container startup

  // Clean up after each test
  afterEach(async () => {
    if (client) {
      await client.end();
    }
    if (container) {
      await container.stop();
    }
  });

  test('mic table CRUID and audit', async () => {
    await client.query(schemaSQL);

    const userResult = await client.query(`
      INSERT INTO app_user (email, full_name, password_hash)
      VALUES ('test@example.com', 'Test User', 'hash123')
      RETURNING id
    `);
    const userId = userResult.rows[0].id;

    const micResult = await client.query(`
      INSERT INTO mic (start_date, recurrence, data, last_edited_by)
      VALUES ('2023-01-01', 'FREQ=WEEKLY;BYDAY=MO', '{"name": "Test Mic", "location": "Test Location"}', $1)
      RETURNING id
    `, [userId]);
    const micId = micResult.rows[0].id;

    // Try to update with incorrect version
    await expect(client.query(`
      UPDATE mic
      SET data = '{"name": "Updated Mic", "location": "Test Location"}',
          last_edited_by = $1,
          edit_version = 999
      WHERE id = $2
    `, [userId, micId])).rejects.toThrow();
    // now update with the proper version
    await client.query(`
      UPDATE mic
      SET data = '{"name": "Updated Mic", "location": "Test Location"}',
          last_edited_by = $1,
          edit_version = 0
      WHERE id = $2
    `, [userId, micId]);

    const updatedMicResult = await client.query(`
      SELECT edit_version FROM mic WHERE id = $1
    `, [micId]);
    expect(updatedMicResult.rows[0].edit_version).toBe("1");

    // try to delete without setting the app user id local var
    await expect(client.query(`
      DELETE FROM mic WHERE id = $1
    `, [micId])).rejects.toThrow();
    // proper delete
    await client.query(`
      BEGIN;
      SET LOCAL app.user_id = '${userId}';
      DELETE FROM mic WHERE id = '${micId}';
      COMMIT;
    `);
    const deletedMicResult = await client.query(`
      SELECT * FROM mic WHERE id = $1
    `, [micId]);
    expect(deletedMicResult.rows.length).toBe(0);

    // audit table should see INSERT, UPDATE, and DELETE
    const auditResult = await client.query(`
      SELECT * FROM audit_mic WHERE mic_id = $1 ORDER BY changed_at
    `, [micId]);
    expect(auditResult.rows.length).toBe(3);
    expect(auditResult.rows[0].action_type).toBe('INSERT');
    expect(auditResult.rows[1].action_type).toBe('UPDATE');
    expect(auditResult.rows[2].action_type).toBe('DELETE');
    expect(auditResult.rows[0].edit_version).toBe("0");
    expect(auditResult.rows[1].edit_version).toBe("1");
    expect(auditResult.rows[2].edit_version).toBe("2");
  });
});
