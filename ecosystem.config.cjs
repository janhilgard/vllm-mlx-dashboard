module.exports = {
  apps: [
    {
      name: "monitoring",
      script: "npx",
      // Production server since 29 Sept 2026 (was `next dev`, exposed via lm.hilgard.cz).
      // Deploy: npm run build, then pm2 restart monitoring.
      args: "next start --hostname 0.0.0.0",
      cwd: "/Users/janhilgard/monitoring",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
