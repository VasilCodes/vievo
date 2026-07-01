const express = require('express');
const router = express.Router();

router.post('/register', (req, res) => {
  res.status(501).json({ message: 'Not implemented - uses Firebase Auth directly' });
});

router.post('/login', (req, res) => {
  res.status(501).json({ message: 'Not implemented - uses Firebase Auth directly' });
});

module.exports = router;
