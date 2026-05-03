module.exports = {
  apps: [
    {
      name:        'sambot',
      script:      'dist/index.js',
      instances:   1,
      autorestart: true,
      watch:       false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'development',
        PORT:     4242,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT:     4242,
        HOST:     '0.0.0.0',
        LOG_LEVEL: 'warn',
      },
    },
  ],
};
