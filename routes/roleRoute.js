const express = require("express");
const router = express.Router();
const roleController = require("../controllers/roleController");
const { authorization } = require("../utils");

router.get(
  "/",
  // authorization("roles:all"),
  roleController.getRole
);
router.post(
  "/add",
  // authorization("roles:add"),
  roleController.addRole
);
router.put(
  "/profile/:_id",
  // authorization("roles:edit"),
  roleController.updateRole
);
router.get(
  "/home/:_id",
  // authorization("roles:edit"),
  roleController.getHomeMenu
);
router.put(
  "/home/:_id",
  // authorization("roles:edit"),
  roleController.updateHomeMenu
);
router.put(
  "/changePermission/:_id",
  // authorization("roles:permission"),
  roleController.changeMenu
);
router.delete(
  "/:_id",
  // authorization("roles:delete"),
  roleController.deleteRole
);

module.exports = router;
