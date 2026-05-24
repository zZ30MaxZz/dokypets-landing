const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');

// Get all services (public)
router.get('/', async (req, res) => {
  try {
    const { rows } = await req.pool.query('SELECT * FROM services ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific service by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { rows } = await req.pool.query('SELECT * FROM services WHERE id = $1', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new service (admin only)
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  const { name, description, price } = req.body;
  
  // Basic validation
  if (!name || price === undefined) {
    return res.status(400).json({ error: 'Name and price are required' });
  }
  
  try {
    const { rows } = await req.pool.query(
      'INSERT INTO services (name, description, price) VALUES ($1, $2, $3) RETURNING *',
      [name, description || null, price]
    );
    
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a service (admin only)
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  const { id } = req.params;
  const { name, description, price } = req.body;
  
  try {
    // Check if service exists
    const { rows: serviceRows } = await req.pool.query(
      'SELECT id FROM services WHERE id = $1',
      [id]
    );
    
    if (serviceRows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    // Update service
    const { rows } = await req.pool.query(
      'UPDATE services SET name = $1, description = $2, price = $3 WHERE id = $4 RETURNING *',
      [name || null, description || null, price || null, id]
    );
    
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a service (admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  const { id } = req.params;
  
  try {
    // Check if service exists
    const { rows: serviceRows } = await req.pool.query(
      'SELECT id FROM services WHERE id = $1',
      [id]
    );
    
    if (serviceRows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    // Delete service
    await req.pool.query(
      'DELETE FROM services WHERE id = $1',
      [id]
    );
    
    res.json({ message: 'Service deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;