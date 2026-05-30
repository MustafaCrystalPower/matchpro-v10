module.exports = {
  apps: [{
    name: 'matchpro-backend',
    script: 'index.js',
    cwd: '/home/user/webapp/server',
    interpreter: 'node',
    watch: false,
    restart_delay: 3000,
    max_restarts: 10,
    env: {
      NODE_ENV: 'production',
      PORT: '3001',
      WA_GATEWAY_URL: 'https://7105.api.greenapi.com',
      // WA_INSTANCE_ID and WA_API_TOKEN set at runtime via PATCH /api/wa/creds
    },
    log_file: '/home/user/webapp/server/pm2.log',
    error_file: '/home/user/webapp/server/pm2-error.log',
    out_file: '/home/user/webapp/server/pm2-out.log',
    merge_logs: true,
  }]
}
