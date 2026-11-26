const mongoose = require("mongoose");
const { mongoUri } = require("./env");

const connectDatabase = async () => {
  try {
    if (!mongoUri) {
      throw new Error("MONGO_URI is missing. Check your .env file.");
    }

    await mongoose.connect(mongoUri);

    console.log("MongoDB Atlas connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    throw error;
  }
};

module.exports = connectDatabase;