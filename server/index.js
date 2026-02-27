const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
const UserAgent = require('user-agents');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

let testStatus = {
    running: false,
    results: null
};

const searchKeywords = [
    "latest tech news", "weather today", "best pizza near me",
    "how to learn react", "javascript async await", "world news headlines",
    "stock market summary", "healthy recipes", "upcoming movies 2024",
    "coding best practices", "travel destinations", "fitness tips"
];

function getRandomKeyword() {
    return searchKeywords[Math.floor(Math.random() * searchKeywords.length)];
}

async function runLoadTest(config, socket) {
    const { users, searchesPerUser, minDelay, maxDelay, deviceType } = config;
    console.log(`[START] Load Test: ${users} searcher(s), ${searchesPerUser} searches each.`);

    let stats = {
        totalRequests: 0,
        successCount: 0,
        errorCount: 0,
        responseTimes: [],
        averageResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        startTime: Date.now(),
        status: 'running'
    };

    const simulateUser = async (id) => {
        const total = parseInt(searchesPerUser) || 1;
        for (let i = 0; i < total; i++) {
            if (!testStatus.running) {
                console.log(`[STOP] Searcher ${id} interrupted.`);
                break;
            }

            const keyword = getRandomKeyword();
            const userAgent = new UserAgent({ deviceCategory: deviceType === 'Mobile' ? 'mobile' : 'desktop' });
            const url = `https://www.bing.com/search?q=${encodeURIComponent(keyword)}`;

            console.log(`[USER ${id}] Performing search ${i + 1}/${total}: "${keyword}"`);

            const requestStartTime = Date.now();
            try {
                await axios.get(url, {
                    headers: { 'User-Agent': userAgent.toString() },
                    timeout: 10000
                });

                const responseTime = Date.now() - requestStartTime;
                stats.totalRequests++;
                stats.successCount++;
                stats.responseTimes.push(responseTime);

                stats.minResponseTime = Math.min(stats.minResponseTime, responseTime);
                stats.maxResponseTime = Math.max(stats.maxResponseTime, responseTime);
                stats.averageResponseTime = stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length;

                console.log(`[USER ${id}] Success (${responseTime}ms). Total: ${stats.totalRequests}`);

            } catch (error) {
                stats.totalRequests++;
                stats.errorCount++;
                console.error(`[USER ${id}] Failed:`, error.message);
            }

            socket.emit('test_update', stats);

            if (i < total - 1) {
                const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + parseInt(minDelay);
                console.log(`[USER ${id}] Waiting ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    };

    const userPromises = [];
    for (let i = 0; i < users; i++) {
        userPromises.push(simulateUser(i));
    }

    await Promise.all(userPromises);

    stats.status = 'completed';
    if (stats.minResponseTime === Infinity) stats.minResponseTime = 0;
    socket.emit('test_complete', stats);
    testStatus.running = false;
    console.log(`[DONE] Load Test Complete. Total Requests: ${stats.totalRequests}`);
}

io.on('connection', (socket) => {
    socket.on('start_test', async (config) => {
        if (testStatus.running) return;
        testStatus.running = true;
        socket.emit('test_started');
        try {
            await runLoadTest(config, socket);
        } catch (error) {
            testStatus.running = false;
            socket.emit('test_failed', error.message);
        }
    });

    socket.on('stop_test', () => {
        testStatus.running = false;
        console.log('[MANUAL STOP] Received stop signal.');
    });
});

const PORT = 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
