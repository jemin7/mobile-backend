module.exports = {
    apps: [
      {
        name: 'enTimeHRapp-receiver',
        cwd: '/home/serveradmin/var/www/enTimeHRapp/attlogreceiver',
        script: 'dist/main.js',
        interpreter: 'node',
        exec_mode: 'fork',
        instances: 1,
        autorestart: true,
        max_memory_restart: '500M',
        env: {
          NODE_ENV: 'production',
        },
      },
    ],
  };