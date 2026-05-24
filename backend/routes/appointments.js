const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');

// Get all appointments
router.get('/', authenticate, async (req, res) => {
  try {
    let query;
    let params;
    
    // Different queries based on user role
    if (req.user.role === 'owner') {
      // Owners see their own pet appointments
      query = `
        SELECT a.id, a.appointment_date, a.status, a.created_at,
               p.id as pet_id, p.name as pet_name, p.species as pet_species,
               u.id as vet_id, u.email as vet_email
        FROM appointments a
        JOIN pets p ON a.pet_id = p.id
        LEFT JOIN users u ON a.vet_id = u.id
        WHERE p.owner_id = $1
        ORDER BY a.appointment_date DESC
      `;
      params = [req.user.id];
    } else if (req.user.role === 'vet') {
      // Vets see their assigned appointments
      query = `
        SELECT a.id, a.appointment_date, a.status, a.created_at,
               p.id as pet_id, p.name as pet_name, p.species as pet_species,
               u.id as owner_id, u.email as owner_email
        FROM appointments a
        JOIN pets p ON a.pet_id = p.id
        JOIN users u ON p.owner_id = u.id
        WHERE a.vet_id = $1
        ORDER BY a.appointment_date DESC
      `;
      params = [req.user.id];
    } else {
      // Admins see all appointments
      query = `
        SELECT a.id, a.appointment_date, a.status, a.created_at,
               p.id as pet_id, p.name as pet_name, p.species as pet_species,
               u.id as owner_id, u.email as owner_email,
               v.id as vet_id, v.email as vet_email
        FROM appointments a
        JOIN pets p ON a.pet_id = p.id
        JOIN users u ON p.owner_id = u.id
        LEFT JOIN users v ON a.vet_id = v.id
        ORDER BY a.appointment_date DESC
      `;
      params = [];
    }
    
    const { rows } = await req.pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get appointments by date range (for vets/admin)
router.get('/range', authenticate, async (req, res) => {
  const { start, end } = req.query;
  
  if (!start || !end) {
    return res.status(400).json({ error: 'Start and end dates are required' });
  }
  
  try {
    const { rows } = await req.pool.query(
      `SELECT a.id, a.appointment_date, a.status,
              p.id as pet_id, p.name as pet_name
       FROM appointments a
       JOIN pets p ON a.pet_id = p.id
       WHERE a.appointment_date BETWEEN $1 AND $2
       ORDER BY a.appointment_date`,
      [start, end]
    );
    
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific appointment by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { rows } = await req.pool.query(
      `SELECT a.id, a.appointment_date, a.status, a.created_at,
              p.id as pet_id, p.name as pet_name, p.species, p.breed, p.age,
              u.id as owner_id, u.email as owner_email,
              v.id as vet_id, v.email as vet_email
       FROM appointments a
       JOIN pets p ON a.pet_id = p.id
       JOIN users u ON p.owner_id = u.id
       LEFT JOIN users v ON a.vet_id = v.id
       WHERE a.id = $1`,
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new appointment (owner books appointment for their pet)
router.post('/', authenticate, async (req, res) => {
  const { pet_id, appointment_date, service_ids } = req.body;
  
  // Basic validation
  if (!pet_id || !appointment_date) {
    return res.status(400).json({ error: 'Pet ID and appointment date are required' });
  }
  
  // Verify pet belongs to user
  try {
    const petCheck = await req.pool.query(
      'SELECT id FROM pets WHERE id = $1 AND owner_id = $2',
      [pet_id, req.user.id]
    );
    
    if (petCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Pet not found or does not belong to you' });
    }
    
    // Create appointment
    const { rows } = await req.pool.query(
      'INSERT INTO appointments (pet_id, appointment_date) VALUES ($1, $2) RETURNING *',
      [pet_id, appointment_date]
    );
    
    const appointment = rows[0];
    
    // Add services if provided
    if (service_ids && service_ids.length > 0) {
      for (const service_id of service_ids) {
        await req.pool.query(
          'INSERT INTO appointment_services (appointment_id, service_id) VALUES ($1, $2)',
          [appointment.id, service_id]
        );
      }
    }
    
    res.status(201).json(appointment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update appointment status (vet or admin)
router.put('/:id', authenticate, authorize('vet', 'admin'), async (req, res) => {
  const { id } = req.params;
  const { status, vet_id, appointment_date } = req.body;
  
  // Validate status
  const validStatuses = ['scheduled', 'completed', 'cancelled'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  
  try {
    // Check if appointment exists
    const { rows: apptRows } = await req.pool.query(
      'SELECT id FROM appointments WHERE id = $1',
      [id]
    );
    
    if (apptRows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    
    // Update appointment
    const { rows } = await req.pool.query(
      `UPDATE appointments 
       SET status = COALESCE($1, status),
           vet_id = COALESCE($2, vet_id),
           appointment_date = COALESCE($3, appointment_date),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 
       RETURNING *`,
      [status, vet_id, appointment_date, id]
    );
    
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cancel appointment (owner can cancel their own, admin can cancel any)
router.delete('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  
  try {
    // Check if appointment exists
    const { rows: apptRows } = await req.pool.query(
      'SELECT id, pet_id FROM appointments WHERE id = $1',
      [id]
    );
    
    if (apptRows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    
    // Check if user has permission
    if (req.user.role === 'owner') {
      const { rows: petRows } = await req.pool.query(
        'SELECT owner_id FROM pets WHERE id = $1',
        [apptRows[0].pet_id]
      );
      
      if (petRows[0].owner_id !== req.user.id) {
        return res.status(403).json({ error: 'You can only cancel your own appointments' });
      }
    }
    
    // Delete appointment
    await req.pool.query('DELETE FROM appointments WHERE id = $1', [id]);
    
    res.json({ message: 'Appointment cancelled successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;