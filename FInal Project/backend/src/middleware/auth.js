// Same guard rules as the Flask version: 401 if not logged in, 403 for the wrong role.
export const requireLogin = (req, res, next) => {
  if (!req.session || !req.session.user_id) {
    return res.status(401).json({ error: 'Please login again.', redirect: '/login' });
  }
  next();
};

export const requireRole = (role, redirect = '/login') => (req, res, next) => {
  if (req.session.role !== role) {
    return res.status(403).json({ error: 'Unauthorized Access!', redirect });
  }
  next();
};
