const express = require("express");
const router = express.Router();
const pageController = require("../controllers/pageController");

router.get("", pageController.getPage);
router.get("/unstructured", pageController.getUnstructured);
router.post("", pageController.addPage);
router.put("/:_id", pageController.updatePage);
router.delete("/:_id", pageController.deletePage);

module.exports = router;
