module.exports = {
  apps: [{
    name: 'mcrm',
    script: 'dist/index.js',
    cwd: '/var/www/mcrm',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/mcrm/error.log',
    out_file: '/var/log/mcrm/out.log',
    log_file: '/var/log/mcrm/combined.log',
    time: true
  }]
};
