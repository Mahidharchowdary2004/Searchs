import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Play, Square, Activity, Users, Clock, Globe, AlertCircle, CheckCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './App.css';

const socket = io('http://localhost:5000');

function App() {
  const [config, setConfig] = useState({
    users: 1,
    searchesPerUser: 30, // Default to 30 as requested
    minDelay: 1000,
    maxDelay: 5000,
    deviceType: 'Desktop'
  });

  const [status, setStatus] = useState('idle'); // idle, running, completed
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [stats, setStats] = useState({
    totalRequests: 0,
    successCount: 0,
    errorCount: 0,
    averageResponseTime: 0,
    minResponseTime: 0,
    maxResponseTime: 0,
    responseTimes: []
  });

  const [chartData, setChartData] = useState([]);
  const stopRef = useRef(false);
  const clientLoopActive = useRef(false);

  useEffect(() => {
    socket.on('test_update', (newStats) => {
      setStats(newStats);
      setStatus('running');

      // Update chart data (keep last 20 points)
      setChartData(prev => {
        const newData = [...prev, {
          time: new Date().toLocaleTimeString(),
          responseTime: newStats.responseTimes[newStats.responseTimes.length - 1]
        }];
        return newData.slice(-20);
      });
    });

    socket.on('test_complete', (finalStats) => {
      setStats(finalStats);
      if (!clientLoopActive.current) {
        setStatus('completed');
      }
    });

    socket.on('test_started', () => {
      setStatus('running');
      setStats({
        totalRequests: 0,
        successCount: 0,
        errorCount: 0,
        averageResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
        responseTimes: []
      });
      setChartData([]);
    });

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('error', (err) => console.error('Socket error:', err));

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('error');
      socket.off('test_update');
      socket.off('test_complete');
      socket.off('test_started');
    };
  }, []);

  const handleStart = async () => {
    setStatus('running');
    stopRef.current = false;
    clientLoopActive.current = true;
    setStats({
      totalRequests: 0,
      successCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      minResponseTime: 0,
      maxResponseTime: 0,
      responseTimes: []
    });
    setChartData([]);

    socket.emit('start_test', config);

    const keywords = [
      "latest tech news", "weather today", "best pizza near me",
      "how to learn react", "javascript async await", "world news headlines",
      "stock market summary", "healthy recipes", "upcoming movies 2024",
      "coding best practices", "travel destinations", "fitness tips",
      "space exploration", "renewable energy", "AI breakthroughs",
      "world history events", "classical music"
    ];

    const total = parseInt(config.searchesPerUser) || 1;
    let currentStats = {
      totalRequests: 0,
      successCount: 0,
      errorCount: 0,
      responseTimes: [],
      averageResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0
    };

    for (let i = 0; i < total; i++) {
      if (stopRef.current) {
        console.log("Stopping test...");
        break;
      }
      const baseKeyword = keywords[Math.floor(Math.random() * keywords.length)];
      // Add random variation to make each search unique
      const variations = ["", " news", " guide", " 2024", " tips", " why", " how"];
      const variation = variations[Math.floor(Math.random() * variations.length)];
      const randomKeyword = baseKeyword + variation;

      // Mimic real browser behavior with extra URL params
      const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(randomKeyword)}&form=QBLH&sp=-1`;

      console.log(`[Human Mode] Searching ${i + 1}/${total}: ${randomKeyword}`);

      const searchTabLabel = "VLoadSearchTab";
      window.open(searchUrl, searchTabLabel);

      const dummyLatency = Math.floor(Math.random() * 800) + 400;

      currentStats.totalRequests++;
      currentStats.successCount++;
      currentStats.responseTimes.push(dummyLatency);
      currentStats.minResponseTime = Math.min(currentStats.minResponseTime, dummyLatency);
      currentStats.maxResponseTime = Math.max(currentStats.maxResponseTime, dummyLatency);
      currentStats.averageResponseTime = currentStats.responseTimes.reduce((a, b) => a + b, 0) / currentStats.responseTimes.length;

      setStats({ ...currentStats });

      setChartData(prev => {
        const newData = [...prev, {
          time: new Date().toLocaleTimeString(),
          responseTime: dummyLatency
        }];
        return newData.slice(-20);
      });

      if (i < total - 1 && !stopRef.current) {
        // Significantly increase delay for reward points (requires 5-10s for stability)
        // Microsoft Rewards often ignores searches faster than 5-6 seconds
        const baseDelay = Math.floor(Math.random() * (config.maxDelay - config.minDelay + 1)) + parseInt(config.minDelay);
        const rewardsSafeDelay = Math.max(baseDelay, 6500);
        console.log(`Waiting ${rewardsSafeDelay}ms for next search...`);
        await new Promise(resolve => {
          const timer = setTimeout(() => {
            clearInterval(checkInterval);
            resolve();
          }, rewardsSafeDelay);

          const checkInterval = setInterval(() => {
            if (stopRef.current) {
              clearTimeout(timer);
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
        });
      }
    }

    clientLoopActive.current = false;
    setStatus(stopRef.current ? 'idle' : 'completed');
    socket.emit(stopRef.current ? 'stop_test' : 'test_complete', currentStats);
  };

  const handleStop = () => {
    stopRef.current = true;
    setStatus('idle');
    socket.emit('stop_test');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: name === 'deviceType' ? value : parseInt(value)
    }));
  };

  return (
    <div className="container">
      <header className="header">
        <h1>V-Load Engine</h1>
        <p>Automated Search Traffic Simulator & Load Tester</p>
      </header>

      <div className="dashboard-grid">
        {/* Configuration Panel */}
        <section className="card config-card">
          <div className="status-badge-container">
            <div className={`status-badge ${status}`}>
              {status === 'running' && <div className="pulse" />}
              {status.toUpperCase()}
            </div>
            <div className={`status-badge ${isConnected ? 'running' : 'idle'}`} style={{ marginLeft: '0.5rem' }}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
          </div>

          <div className="form-group">
            <label><Users size={16} /> No. of Searchers</label>
            <input
              type="number"
              name="users"
              value={config.users}
              onChange={handleInputChange}
              disabled={status === 'running'}
            />
          </div>

          <div className="form-group">
            <label><Activity size={16} /> Searches per Searcher</label>
            <input
              type="number"
              name="searchesPerUser"
              value={config.searchesPerUser}
              onChange={handleInputChange}
              disabled={status === 'running'}
            />
          </div>

          <div className="form-group">
            <label><Clock size={16} /> Min Delay (ms)</label>
            <input
              type="number"
              name="minDelay"
              value={config.minDelay}
              onChange={handleInputChange}
              disabled={status === 'running'}
            />
          </div>

          <div className="form-group">
            <label><Clock size={16} /> Max Delay (ms)</label>
            <input
              type="number"
              name="maxDelay"
              value={config.maxDelay}
              onChange={handleInputChange}
              disabled={status === 'running'}
            />
          </div>

          <div className="form-group">
            <label><Globe size={16} /> Device Type</label>
            <select
              name="deviceType"
              value={config.deviceType}
              onChange={handleInputChange}
              disabled={status === 'running'}
            >
              <option value="Desktop">Desktop</option>
              <option value="Mobile">Mobile</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn-primary"
              onClick={handleStart}
              disabled={status === 'running'}
              style={{ flex: 1 }}
            >
              {status === 'running' ? <Activity className="rotate" /> : <Play size={18} />}
              {status === 'running' ? 'Testing...' : 'Start Test'}
            </button>

            {status === 'running' && (
              <button
                className="btn-primary"
                onClick={handleStop}
                style={{ backgroundColor: 'var(--error)', flex: 1 }}
              >
                <Square size={18} />
                Stop
              </button>
            )}
          </div>
        </section>

        {/* Real-time Stats & Charts */}
        <section className="card stats-card">
          <h2>Live Metrics</h2>
          <div className="stats-container">
            <div className="stat-box">
              <span className="stat-label">Total Requests</span>
              <span className="stat-value">{stats.totalRequests}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Success Rate</span>
              <span className="stat-value" style={{ color: 'var(--success)' }}>
                {stats.totalRequests > 0
                  ? ((stats.successCount / stats.totalRequests) * 100).toFixed(1)
                  : 0}%
              </span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Avg Latency</span>
              <span className="stat-value">{Math.round(stats.averageResponseTime)}ms</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Errors</span>
              <span className="stat-value" style={{ color: 'var(--error)' }}>{stats.errorCount}</span>
            </div>
          </div>

          <div className="results-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                  itemStyle={{ color: '#818cf8' }}
                />
                <Line
                  type="monotone"
                  dataKey="responseTime"
                  stroke="#818cf8"
                  strokeWidth={2}
                  dot={false}
                  animationDuration={300}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="stats-container" style={{ marginTop: '1rem' }}>
            <div className="stat-box">
              <span className="stat-label">Min Latency</span>
              <span className="stat-value">{stats.minResponseTime === Infinity ? 0 : stats.minResponseTime}ms</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Max Latency</span>
              <span className="stat-value">{stats.maxResponseTime}ms</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
