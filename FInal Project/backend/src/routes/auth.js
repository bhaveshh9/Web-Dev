import { Router } from 'express';
import { col } from '../db.js';
import { checkPassword, hashPassword } from '../utils/passwords.js';
import { nowIST, wrap } from '../utils/helpers.js';

const router = Router();

router.get('/me', (req, res) => {
  if (!req.session || !req.session.user_id) return res.json({ authenticated: false });
  res.json({
    authenticated: true,
    user: { id: req.session.user_id, name: req.session.name, role: req.session.role },
  });
});

router.post('/login', wrap(async (req, res) => {
  const { email, password, role } = req.body || {};

  const user = await col('users').findOne({ email });
  if (!user) return res.status(401).json({ error: 'User not found.' });

  const selectedRole = String(role || '').trim().toLowerCase();
const storedRole = String(user.role || '').trim().toLowerCase();

if (!['student', 'teacher'].includes(selectedRole)) {
  return res.status(400).json({ error: 'Invalid account type selected.' });
}

if (storedRole !== selectedRole) {
  return res.status(401).json({ error: 'Incorrect account type selected.' });
}

  if (!(await checkPassword(user.password, password))) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  req.session.user_id = String(user._id);
  req.session.name = user.full_name;
  req.session.role = user.role;

  res.json({
    user: { id: String(user._id), name: user.full_name, role: user.role },
    redirect: user.role === 'teacher' ? '/teacher/dashboard' : '/',
  });
}));

const logout = (req, res) => {
  req.session = null;
  res.json({ message: 'Logged out successfully.', redirect: '/login' });
};
router.get('/logout', logout);
router.post('/logout', logout);

router.post('/signup', wrap(async (req, res) => {
  const { full_name, email, password, confirm_password, role, institution, grade } = req.body || {};

  if (password !== confirm_password) return res.status(400).json({ error: 'Passwords do not match.' });
  if (!password) return res.status(400).json({ error: 'Password is required.' });

  if (await col('users').findOne({ email })) {
    return res.status(400).json({ error: 'Email already registered.' });
  }

  await col('users').insertOne({
    full_name,
    email,
    password: await hashPassword(password),
    role,
    institution: role === 'teacher' ? institution ?? null : null,
    grade: role === 'student' ? grade ?? null : null,
    created_at: nowIST(),
  });

  res.json({ message: 'Account created.', redirect: '/login' });
}));

export default router;
