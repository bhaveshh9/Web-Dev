const express = require("express");
const c = require("../controllers/studentController");

const router = express.Router();

router.route("/").post(c.createStudent).get(c.getStudents);
router.route("/:id").get(c.getStudentById).put(c.updateStudent).delete(c.deleteStudent);

module.exports = router;
