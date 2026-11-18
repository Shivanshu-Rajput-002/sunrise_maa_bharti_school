module.exports = {
  apps: [
    {
      name: 'school-erp-api',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '500M',
      env: { NODE_ENV: 'production' },
    },
  ],
};
