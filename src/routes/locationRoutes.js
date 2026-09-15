const express = require('express');
const router = express.Router();
const {auth} = require('../middleware/auth');
const axios = require('axios');

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// ─── Reverse Geocode ─────────────────────────────────────────
router.post('/reverse-geocode', auth, async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_API_KEY}`;
    const { data } = await axios.get(url);
    if (!data.results || data.results.length === 0) {
      return res.status(404).json({ error: 'No address found' });
    }
    res.json({
      success: true,
      data: {
        address: data.results[0].formatted_address,
        placeId: data.results[0].place_id,
        components: data.results[0].address_components,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── Forward Geocode ─────────────────────────────────────────
router.post('/geocode', auth, async (req, res, next) => {
  try {
    const { address } = req.body;
    if (!address) return res.status(400).json({ error: 'Address required' });
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_API_KEY}`;
    const { data } = await axios.get(url);
    if (!data.results || data.results.length === 0) {
      return res.status(404).json({ error: 'No coordinates found' });
    }
    const loc = data.results[0].geometry.location;
    res.json({
      success: true,
      data: {
        latitude: loc.lat,
        longitude: loc.lng,
        address: data.results[0].formatted_address,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── Get Route (Directions) ──────────────────────────────────
router.post('/route', auth, async (req, res, next) => {
  try {
    const { originLat, originLng, destLat, destLng } = req.body;
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${destLat},${destLng}&key=${GOOGLE_API_KEY}`;
    const { data } = await axios.get(url);
    if (!data.routes || data.routes.length === 0) {
      return res.status(404).json({ error: 'No route found' });
    }
    const route = data.routes[0];
    res.json({
      success: true,
      data: {
        polyline: route.overview_polyline.points,
        distance: route.legs[0].distance,       // { text, value }
        duration: route.legs[0].duration,       // { text, value }
        startAddress: route.legs[0].start_address,
        endAddress: route.legs[0].end_address,
        steps: route.legs[0].steps,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;