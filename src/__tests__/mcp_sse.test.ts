import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../index';

describe('MCP SSE Transport Endpoints', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('GET /sse', () => {
    it('should return 401 if API_KEY is configured but missing', async () => {
      vi.stubEnv('API_KEY', 'test-secret-key');
      const response = await request(app).get('/sse');
      expect(response.status).toBe(401);
    });

    it('should connect and return event-stream headers if authorized', async () => {
      vi.stubEnv('API_KEY', 'test-secret-key');
      
      const response = await request(app)
        .get('/sse')
        .set('Authorization', 'Bearer test-secret-key');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/event-stream');
    });

    it('should connect without authentication if API_KEY is not configured', async () => {
      const response = await request(app).get('/sse');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/event-stream');
    });
  });

  describe('POST /messages', () => {
    it('should return 400 if sessionId query parameter is missing', async () => {
      vi.stubEnv('API_KEY', 'test-secret-key');
      const response = await request(app)
        .post('/messages')
        .send({ jsonrpc: '2.0', method: 'ping', id: 1 });
      
      expect(response.status).toBe(400);
      expect(response.text).toContain('sessionId');
    });

    it('should return 400 if no active transport is found for sessionId', async () => {
      vi.stubEnv('API_KEY', 'test-secret-key');
      const response = await request(app)
        .post('/messages')
        .query({ sessionId: 'non-existent-session-id' })
        .send({ jsonrpc: '2.0', method: 'ping', id: 1 });
      
      expect(response.status).toBe(400);
      expect(response.text).toContain('No transport found');
    });
  });
});
