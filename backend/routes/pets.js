const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// Get all pets (for owners) or pets by owner ID
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await req.pool.query(
      `SELECT p.id, p.name, p.species, p.breed, p.age, 
              u.id as owner_id, u.email as owner_email
       FROM pets p
       JOIN users u ON p.owner_id = u.id
       WHERE p.owner_id = $1`,
      [req.user.id]
    );
    
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific pet by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { rows } = await req.pool.query(
      `SELECT p.id, p.name, p.species, p.breed, p.age, 
              u.id as owner_id, u.email as owner_email
       FROM pets p
       JOIN users u ON p.owner_id = u.id
       WHERE p.id = $1 AND p.owner_id = $2`,
      [id, req.user.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Pet not found' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new pet
router.post('/', authenticate, async (req, res) => {
  const { name, species, breed, age } = req.body;
  
  // Basic validation
  if (!name || !species) {
    return res.status(400).json({ error: 'Name and species are required' });
  }
  
  try {
    const { rows } = await req.pool.query(
      'INSERT INTO pets (name, species, breed, age, owner_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, species, breed || null, age || null, req.user.id]
    );
    
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a pet
router.put('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { name, species, breed, age } = req.body;
  
  try {
    // Check if pet exists and belongs to user
    const { rows: petRows } = await req.pool.query(
      'SELECT id FROM pets WHERE id = $1 AND owner_id = $2',
      [id, req.user.id]
    );
    
    if (petRows.length === 0) {
      return res.status(404).json({ error: 'Pet not found' });
    }
    
    // Update pet
    const { rows } = await req.pool.query(
      'UPDATE pets SET name = $1, species = $2, breed = $3, age = $4 WHERE id = $5 AND owner_id = $6 RETURNING *',
      [name || null, species || null, breed || null, age || null, id, req.user.id]
    );
    
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a pet
router.delete('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  
  try {
    // Check if pet exists and belongs to user
    const { rows: petRows } = await req.pool.query(
      'SELECT id FROM pets WHERE id = $1 AND owner_id = $2',
      [id, req.user.id]
    );
    
    if (petRows.length === 0) {
      return res.status(404).json({ error: 'Pet not found' });
    }
    
    // Delete pet
    await req.pool.query(
      'DELETE FROM pets WHERE id = $1 AND owner_id = $2',
      [id, req.user.id]
    );
    
    res.json({ message: 'Pet deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;