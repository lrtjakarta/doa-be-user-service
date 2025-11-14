require("dotenv").config();

var databaseURI = process.env.DATABASE_URI;

module.exports = {
  mongoURI: databaseURI,
  secretOrKey: "nahdude",
};
