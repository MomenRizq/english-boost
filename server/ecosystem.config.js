// pm2 start server/ecosystem.config.js   (set ADMIN_PASSWORD in the environment or in /etc/english-boost.env)
module.exports = {
  apps: [{
    name: 'english-boost',
    script: __dirname + '/server.js',
    env: { PORT: 3311, HOST: '127.0.0.1' },
    max_memory_restart: '200M'
  }]
};
