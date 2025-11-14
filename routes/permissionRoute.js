const express = require("express");
const router = express.Router();
const permissionController = require("../controllers/permissionController");

router.get("/", permissionController.get);
router.get("/user/:userId", permissionController.getByUserId);
router.post("/", permissionController.add);
router.put("/:_id", permissionController.update);
router.delete("/:_id", permissionController.delete);

module.exports = router;
