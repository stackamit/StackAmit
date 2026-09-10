import Student from '../models/Student.js';
import Trainer from '../models/Trainer.js';
import Internship from '../models/Internship.js';
import Certificate from '../models/Certificate.js';
import Task from '../models/Task.js';
import Application from '../models/Application.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// ─── Admin Dashboard Stats ───────────────────────────────────────────────────
export const getAdminDashboardStats = asyncHandler(async (req, res) => {
  const [
    totalStudents, totalTrainers, totalInternships,
    activeInternships, totalCertificates, totalApplications,
    pendingApplications, totalTasks, completedTasks,
  ] = await Promise.all([
    Student.countDocuments({ role: 'student', deletedAt: null }),
    Trainer.countDocuments({ role: 'trainer', deletedAt: null }),
    Internship.countDocuments({ isDeleted: false }),
    Internship.countDocuments({ status: 'published', isDeleted: false }),
    Certificate.countDocuments({ isRevoked: false }),
    Application.countDocuments(),
    Application.countDocuments({ status: 'pending' }),
    Task.countDocuments(),
    Task.countDocuments({ status: 'completed' }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalStudents,
      totalTrainers,
      totalInternships,
      activeInternships,
      totalCertificates,
      totalApplications,
      pendingApplications,
      totalTasks,
      completedTasks,
      taskCompletionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    },
  });
});

// ─── Trainer Dashboard Stats ─────────────────────────────────────────────────
export const getTrainerDashboardStats = asyncHandler(async (req, res) => {
  const trainerId = req.user._id;

  const [assignedStudents, totalTasks, pendingTasks, completedTasks, lateTasks] = await Promise.all([
    Trainer.findById(trainerId).select('assignedStudents'),
    Task.countDocuments({ assignedBy: trainerId }),
    Task.countDocuments({ assignedBy: trainerId, status: 'pending' }),
    Task.countDocuments({ assignedBy: trainerId, status: 'completed' }),
    Task.countDocuments({ assignedBy: trainerId, status: 'late' }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      assignedStudents: assignedStudents?.assignedStudents?.length || 0,
      totalTasks,
      pendingTasks,
      completedTasks,
      lateTasks,
      taskCompletionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    },
  });
});

// ─── Student Dashboard Stats ─────────────────────────────────────────────────
export const getStudentDashboardStats = asyncHandler(async (req, res) => {
  const studentId = req.user._id;

  const [assignedTasks, completedTasks, pendingTasks, applications, certificates] = await Promise.all([
    Task.countDocuments({ assignedTo: studentId }),
    Task.countDocuments({ assignedTo: studentId, status: 'completed' }),
    Task.countDocuments({ assignedTo: studentId, status: { $in: ['pending', 'in-progress'] } }),
    Application.countDocuments({ studentId }),
    Certificate.countDocuments({ studentId, isRevoked: false }),
  ]);

  const student = await Student.findById(studentId)
    .select('profileCompletion currentInternship assignedTrainer')
    .populate('currentInternship', 'title category status startDate endDate')
    .populate('assignedTrainer', 'name email');

  const internship = student?.currentInternship;
  res.status(200).json({
    success: true,
    data: {
      profileCompletion: student?.profileCompletion || 0,
      currentInternship: internship ? {
        _id: internship._id,
        title: internship.title,
        category: internship.category,
        status: internship.status,
        startDate: internship.startDate,
        endDate: internship.endDate,
      } : null,
      assignedTrainer: student?.assignedTrainer ? {
        _id: student.assignedTrainer._id,
        name: student.assignedTrainer.name,
        email: student.assignedTrainer.email,
      } : null,
      assignedTasks,
      completedTasks,
      pendingTasks,
      applications,
      certificates,
      taskCompletionRate: assignedTasks > 0 ? Math.round((completedTasks / assignedTasks) * 100) : 0,
    },
  });
});

// ─── Monthly Report ──────────────────────────────────────────────────────────
export const getMonthlyReport = asyncHandler(async (req, res) => {
  const { year = new Date().getFullYear() } = req.query;
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59);

  const monthlyData = await Student.aggregate([
    {
      $match: {
        createdAt: { $gte: startOfYear, $lte: endOfYear },
      },
    },
    {
      $group: {
        _id: { $month: '$createdAt' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const report = Array.from({ length: 12 }, (_, i) => {
    const month = monthlyData.find((m) => m._id === i + 1);
    return {
      month: new Date(year, i).toLocaleString('default', { month: 'short' }),
      students: month?.count || 0,
    };
  });

  res.status(200).json({ success: true, data: { report, year } });
});

// ─── Export Data ─────────────────────────────────────────────────────────────
export const exportData = asyncHandler(async (req, res) => {
  const { type, format = 'json' } = req.query;

  let data;
  switch (type) {
    case 'students':
      data = await Student.find({ deletedAt: null }).select('-password');
      break;
    case 'trainers':
      data = await Trainer.find({ deletedAt: null }).select('-password');
      break;
    case 'internships':
      data = await Internship.find({ isDeleted: false });
      break;
    case 'certificates':
      data = await Certificate.find().populate('studentId', 'name email').populate('internshipId', 'title');
      break;
    default:
      return res.status(400).json({ success: false, message: 'Invalid export type' });
  }

  if (format === 'csv') {
    // Simple CSV conversion
    if (!data.length) {
      return res.status(200).json({ success: true, data: [], message: 'No data to export' });
    }

    const headers = Object.keys(data[0].toObject ? data[0].toObject() : data[0]);
    const csvRows = [headers.join(',')];
    data.forEach((item) => {
      const obj = item.toObject ? item.toObject() : item;
      const values = headers.map((h) => {
        const val = obj[h];
        return typeof val === 'object' ? JSON.stringify(val) : val;
      });
      csvRows.push(values.join(','));
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${type}_export.csv`);
    return res.status(200).send(csvRows.join('\n'));
  }

  res.status(200).json({ success: true, data });
});

