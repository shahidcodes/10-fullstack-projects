
const app = require("./app");
const connectDatabase = require("./config/database");

const startServer = async () => {
  try {
    await connectDatabase();

    const server = app.listen(5000, () => {
      console.log(`VoteSphere API running on port ${5000}`);
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
