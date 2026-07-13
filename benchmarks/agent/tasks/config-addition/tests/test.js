import { createClient } from '../index.js';
console.log(createClient({}).enableRetries === true ? 'PASS' : 'FAIL');