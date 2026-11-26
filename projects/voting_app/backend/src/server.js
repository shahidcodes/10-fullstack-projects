
const app = require("./app");
const connectDatabase = require("./config/database");
const { port } = require("./config/env");

const startServer = async () => {
  try {
    await connectDatabase();

    const server = app.listen(port, () => {
      console.log(`VoteSphere API running on port ${port}`);
    });

    const shutdown = async (signal) => {
      console.log(`${signal} received. Shutting down...`);

      server.close(async () => {
        const mongoose = require("mongoose");

        await mongoose.disconnect();

        console.log("Server shut down successfully");
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
};

startServer();
