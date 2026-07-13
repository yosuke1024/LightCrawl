const fs = require('fs');
const path = require('path');

const tasksDir = path.join(__dirname, '../benchmarks/agent/tasks');

const tasks = [
  {
    id: 'config-addition',
    docs: `<!DOCTYPE html><html><body><h1>API Client Setup</h1><p>You can enable automatic retries by setting <code>enableRetries: true</code> in your client configuration object.</p></body></html>`,
    starter: `export function createClient(config) { return { ...config, base: 'api' }; }`,
    tests: `import { createClient } from '../index.js';
console.log(createClient({}).enableRetries === true ? 'PASS' : 'FAIL');`,
    prompt: `Modify index.js to default to enableRetries: true according to the documentation.`
  },
  {
    id: 'api-migration',
    docs: `<!DOCTYPE html><html><body><h1>Migration Guide</h1><p>The <code>getUser()</code> function is deprecated. Use <code>fetchUserById()</code> instead. It takes an ID as the first argument.</p></body></html>`,
    starter: `export function getUser() { return { id: 1, name: 'John' }; }`,
    tests: `import { fetchUserById } from '../index.js';
console.log(typeof fetchUserById === 'function' ? 'PASS' : 'FAIL');`,
    prompt: `Migrate the deprecated function to the new one as per the docs.`
  },
  {
    id: 'pagination-impl',
    docs: `<!DOCTYPE html><html><body><h1>Pagination API</h1><p>Our API uses cursor-based pagination. You must pass <code>cursor: "next_page_token"</code> in the request body.</p></body></html>`,
    starter: `export function buildRequest() { return { body: {} }; }`,
    tests: `import { buildRequest } from '../index.js';
const req = buildRequest();
console.log(req.body.cursor === 'next_page_token' ? 'PASS' : 'FAIL');`,
    prompt: `Implement pagination in the request body as per the documentation.`
  },
  {
    id: 'retry-logic',
    docs: `<!DOCTYPE html><html><body><h1>Network Resilience</h1><p>If the API returns a 429 status code, wait for 100ms before retrying the request.</p></body></html>`,
    starter: `export function getDelay(status) { return 0; }`,
    tests: `import { getDelay } from '../index.js';
console.log(getDelay(429) === 100 ? 'PASS' : 'FAIL');`,
    prompt: `Add retry delay logic based on the status code according to the docs.`
  }
];

if (!fs.existsSync(tasksDir)) fs.mkdirSync(tasksDir, { recursive: true });

for (const t of tasks) {
  const taskPath = path.join(tasksDir, t.id);
  if (!fs.existsSync(taskPath)) fs.mkdirSync(taskPath, { recursive: true });
  
  // Create task.json
  fs.writeFileSync(path.join(taskPath, 'task.json'), JSON.stringify({
    id: t.id,
    prompt: t.prompt
  }, null, 2));

  // Create docs
  fs.writeFileSync(path.join(taskPath, 'documentation.html'), t.docs);

  // Create starter
  const starterPath = path.join(taskPath, 'starter');
  if (!fs.existsSync(starterPath)) fs.mkdirSync(starterPath);
  fs.writeFileSync(path.join(starterPath, 'index.js'), t.starter);

  // Create tests
  const testsPath = path.join(taskPath, 'tests');
  if (!fs.existsSync(testsPath)) fs.mkdirSync(testsPath);
  fs.writeFileSync(path.join(testsPath, 'test.js'), t.tests);
}

console.log('Agent tasks generated.');
