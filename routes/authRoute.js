const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const userController = require("../controllers/userController");

router.get("/captcha", authController.getcaptcha);

router.get("/check", authController.check);
router.get("/checkusername", authController.checkUsername);
router.get("/role/:_id", authController.getRoleByUserId);
router.post("/role/verify", authController.verifyMultiRole);
router.post("/login", authController.login);
router.post("/loginPIN", authController.loginPIN);
router.post("/activate", userController.activateUser);
router.post("/refresh", authController.refreshToken);
router.post("/verifyToken", authController.verifyToken);

module.exports = router;
