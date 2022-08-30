import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

// npx nodemon index.js
// sudo killall -9 node