module.exports = {
  apps: [
    {
      name: "monitoring",
      script: "npx",
      args: "next dev --hostname 0.0.0.0",
      cwd: "/Users/janhilgard/monitoring",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: "development",
        PORT: 3000,
      },
    },
  ],
};
