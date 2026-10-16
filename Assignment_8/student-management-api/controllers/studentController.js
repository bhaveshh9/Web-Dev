const mongoose = require("mongoose");
const Student = require("../models/Student");

const FIELDS = ["name", "rollNo", "email", "course", "age"];

// Keep only the allowed fields from the request body
const pickFields = (body = {}) => {
  const data = {};
  FIELDS.forEach((f) => {
    if (body[f] !== undefined) data[f] = body[f];
  });
  return data;
};

const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const checkId = (id) => {
  if (!mongoose.isValidObjectId(id)) throw httpError(400, "Invalid student ID format");
};

// POST /api/students
exports.createStudent = async (req, res, next) => {
  try {
    const student = await Student.create(pickFields(req.body));
    res.status(201).json({ success: true, message: "Student created", data: student });
  } catch (err) {
    next(err);
  }
};

// GET /api/students
exports.getStudents = async (req, res, next) => {
  try {
    const students = await Student.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: students.length, data: students });
  } catch (err) {
    next(err);
  }
};

// GET /api/students/:id
exports.getStudentById = async (req, res, next) => {
  try {
    checkId(req.params.id);
    const student = await Student.findById(req.params.id);
    if (!student) throw httpError(404, "Student not found");
    res.status(200).json({ success: true, data: student });
  } catch (err) {
    next(err);
  }
};

// PUT /api/students/:id
exports.updateStudent = async (req, res, next) => {
  try {
    checkId(req.params.id);
    const student = await Student.findByIdAndUpdate(req.params.id, pickFields(req.body), {
      new: true,
      runValidators: true,
    });
    if (!student) throw httpError(404, "Student not found");
    res.status(200).json({ success: true, message: "Student updated", data: student });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/students/:id
exports.deleteStudent = async (req, res, next) => {
  try {
    checkId(req.params.id);
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) throw httpError(404, "Student not found");
    res.status(200).json({ success: true, message: "Student deleted", data: student });
  } catch (err) {
    next(err);
  }
};
