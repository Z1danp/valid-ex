import { Hono } from 'hono';
import { cors } from 'hono/cors';

// initialize base path '/api/v1'
export const app = new Hono().basePath('/api/v1');
// use cors middleware
app.use('*', cors());
// get health endpoint
app.get('/health', (c) => c.json({status: 'ok'}));
// not found endpoint
app.notFound((c) => c.json({code: 'NOT_FOUND', message: 'Endpoint not found'}, 404));
// internal error endpoint
app.onError((err, c) => c.json({code: 'INTERNAL_ERROR', message: err.message}, 500));