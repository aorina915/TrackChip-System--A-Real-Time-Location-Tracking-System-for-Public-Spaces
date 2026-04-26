const http = require('http');
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjIsInVzZXJuYW1lIjoib3BlcmF0b3IiLCJyb2xlIjoib3BlcmF0b3IiLCJvcmdhbml6YXRpb24iOm51bGwsImlhdCI6MTc3NTcyOTE1MCwiZXhwIjoxNzc1NzU3OTUwfQ.ySMxOjobSavSNo5aH2l5golvQBSYXyRDy7B8ykUMbdE';
const options = {
  hostname: '127.0.0.1',
  port: 4000,
  path: '/devices/register',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Content-Length': 0
  }
};
const req = http.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('STATUS', res.statusCode);
    console.log('BODY', body);
  });
});
req.on('error', (err) => console.error('ERROR', err));
req.end();
