const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { authorization } = require("../utils");

router.get(
  "/",
  // authorization("users:all"),
  userController.get_data
);
router.get("/:_id", userController.getUserbyID);
router.get("/menu/:_id", userController.getMenuByUserId);
router.get("/as/filter", userController.getUserasFilter);
router.post(
  "/register",
  // authorization("users:register"),
  userController.register
);
router.post(
  "/createUser",
  // authorization("users:register"),
  userController.createUser
);
router.put(
  "/:_id",
  // authorization("users:edit"),
  userController.updateUser
);

router.put(
  "/:_id/profile",
  // authorization("users:edit"),
  userController.updateProfileId
);
router.put("/fcm/:_id", userController.updateUser);
router.post(
  "/changePassword",
  // authorization("users:changePassword"),
  userController.changePassword
);
router.post(
  "/password/reset",

  // authorization("users:resetPassword"),
  userController.resetPassword
);
router.delete(
  "/:_id",
  // authorization("users:delete"),
  userController.deleteUser
);

router.post(
  "/fcm",
  // authorization("users:all"),
  userController.getFCMs
);

router.post(
  "/ams",
  // authorization("users:all"),
  userController.syncDataFromAMS
);

module.exports = router;
