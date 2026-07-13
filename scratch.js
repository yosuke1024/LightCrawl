const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }).generateContent('hello').then(res => console.log('2.5-flash:', res.response.text())).catch(e => console.error(e.message));
