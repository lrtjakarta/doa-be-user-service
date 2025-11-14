const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const db = require("./database").mongoURI;
const session = require("express-session");

require("dotenv").config();

const corsConfig = {
  origin: true,
  credentials: true,
};

mongoose.set("strictQuery", false);
mongoose
  .connect(db, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("MongoDB Connected");
  })
  .catch((err) => {
    console.log(err);
  });

app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

app.set("secretKey", process.env.SECRET_KEY);

app.use("/repo", express.static(path.join(__dirname, "repo")));

const authRoute = require("./routes/authRoute");
const userRoute = require("./routes/userRoute");
const roleRoute = require("./routes/roleRoute");
const pageRoute = require("./routes/pageRoute");
const permissionRoute = require("./routes/permissionRoute");

// Konfigurasi sesi
app.use(
  session({
    secret: "s3cur3-lrt-4pp", // Ganti dengan kunci sesi yang kuat dan rahasia
    resave: false,
    saveUninitialized: false,
    // cookie: { sameSite: "none" },
  })
);

app.use("/auth", cors(corsConfig));
app.use("/auth", authRoute);

// set wild card for other routes
app.use(cors());
app.use("/user", userRoute);
app.use("/page", pageRoute);
app.use("/role", roleRoute);
app.use("/permission", permissionRoute);

app.get("/", (req, res) => {
  res.send("LRT OPL Auth Service is Connected");
});

const PORT = process.env.PORT || 2021;
app.listen(PORT, () => {
  console.log(`LRT OPL Auth Service on PORT ${PORT} is connected`);
});
