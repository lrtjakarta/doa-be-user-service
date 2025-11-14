const dotenv = require("dotenv");
const envFile =
  process.env.NODE_ENV === "production" ? ".env.production" : ".env";

dotenv.config({ path: `${envFile}` });

module.exports = {
  apps: [
    {
      name: "user",
      script: "server.js",
      env: {
        NODE_ENV: "development",
        // Load your .env file variables here for development
        ...dotenv.config({ path: ".env" }).parsed,
      },
      env_production: {
        NODE_ENV: "production",
        // Load your .env.production file variables here for production
        ...dotenv.config({ path: ".env.production" }).parsed,
      },
    },
  ],
};
