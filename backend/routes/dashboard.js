const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');

// Get dashboard statistics (admin/vet only)
router.get('/stats', authenticate, authorize('admin', 'vet'), async (req, res) => {
  try {
    // Total pets
    const petsCount = await req.pool.query('SELECT COUNT(*) as count FROM pets');
    
    // Total appointments
    const appointmentsCount = await req.pool.query('SELECT COUNT(*) as count FROM appointments');
    
    // Appointments by status
    const appointmentsByStatus = await req.pool.query(
      `SELECT status, COUNT(*) as count 
       FROM appointments 
       GROUP BY status`
    );
    
    // Today's appointments
    const today = new Date().toISOString().split('T')[0];
    const todayAppointments = await req.pool.query(
      `SELECT COUNT(*) as count 
       FROM appointments 
       WHERE DATE(appointment_date) = $1`,
      [today]
    );
    
    // Upcoming appointments (next 7 days)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const upcomingAppointments = await req.pool.query(
      `SELECT COUNT(*) as count 
       FROM appointments 
       WHERE appointment_date BETWEEN NOW() AND $1 
       AND status = 'scheduled'`,
      [nextWeek.toISOString()]
    );
    
    // Recent appointments
    const recentAppointments = await req.pool.query(
      `SELECT a.id, a.appointment_date, a.status,
              p.name as pet_name, p.species,
              u.email as owner_email
       FROM appointments a
       JOIN pets p ON a.pet_id = p.id
       JOIN users u ON p.owner_id = u.id
       ORDER BY a.created_at DESC
       LIMIT 10`
    );
    
    // Pets by species
    const petsBySpecies = await req.pool.query(
      `SELECT species, COUNT(*) as count 
       FROM pets 
       WHERE species IS NOT NULL 
       GROUP BY species`
    );
    
    res.json({
      stats: {
        totalPets: parseInt(petsCount.rows[0].count),
        totalAppointments: parseInt(appointmentsCount.rows[0].count),
        todayAppointments: parseInt(todayAppointments.rows[0].count),
        upcomingAppointments: parseInt(upcomingAppointments.rows[0].count),
        appointmentsByStatus: appointmentsByStatus.rows,
        petsBySpecies: petsBySpecies.rows
      },
      recentAppointments: recentAppointments.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get calendar data (admin/vet only)
router.get('/calendar', authenticate, authorize('admin', 'vet'), async (req, res) => {
  const { start, end } = req.query;
  
  if (!start || !end) {
    return res.status(400).json({ error: 'Start and end dates are required' });
  }
  
  try {
    const { rows } = await req.pool.query(
      `SELECT a.id, a.appointment_date as start, a.status,
              p.name as pet_name, p.species,
              u.email as owner_email,
              v.email as vet_email
       FROM appointments a
       JOIN pets p ON a.pet_id = p.id
       JOIN users u ON p.owner_id = u.id
       LEFT JOIN users v ON a.vet_id = v.id
       WHERE a.appointment_date BETWEEN $1 AND $2
       ORDER BY a.appointment_date`,
      [start, end]
    );
    
    // Transform to calendar format
    const events = rows.map(row => ({
      id: row.id,
      title: `${row.pet_name} (${row.species})`,
      start: row.start,
      status: row.status,
      owner: row.owner_email,
      vet: row.vet_email
    }));
    
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all users (admin only)
router.get('/users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { rows } = await req.pool.query(
      `SELECT id, email, role, created_at 
       FROM users 
       ORDER BY created_at DESC`
    );
    
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all pets (admin/vet)
router.get('/pets', authenticate, authorize('admin', 'vet'), async (req, res) => {
  try {
    const { rows } = await req.pool.query(
      `SELECT p.id, p.name, p.species, p.breed, p.age, p.created_at,
              u.id as owner_id, u.email as owner_email
       FROM pets p
       JOIN users u ON p.owner_id = u.id
       ORDER BY p.created_at DESC`
    );
    
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;