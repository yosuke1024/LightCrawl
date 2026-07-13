import { buildRequest } from '../index.js';
const req = buildRequest();
console.log(req.body.cursor === 'next_page_token' ? 'PASS' : 'FAIL');