const dotenv = require('dotenv');
dotenv.config();

const app = require('./src/app');
const { sequelize, Category, Service, User } = require('./src/models');
const bcrypt = require('bcryptjs');
const createDefaultMetadata = require('./src/utils/createDefaultMetadata');

const PORT = process.env.PORT || 5000;

// ─── Seed Data ─────────────────────────────────────────────────────
const seedDatabase = async () => {
  try {
    // ─── 1. Create Admin User ─────────────────────────────────
    const adminMobile = '9999999999';
    const adminPassword = 'admin123';
    const existingAdmin = await User.findOne({ where: { mobile: adminMobile } });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await User.create({
        mobile: adminMobile,
        name: 'Admin',
        password: hashedPassword,
        role: 'admin',
        isVerified: true,
      });
      console.log('✅ Admin user created (mobile: 9999999999, password: admin123)');
    } else {
      console.log('✅ Admin user already exists');
    }

    // ─── 2. Seed Categories & Services with Images ────────────

    // ─── Metadata for each service ──────────────────────────────────
    const serviceMetadata = {
      // ═══════════════════════════════════════════════════════════
      // WOMEN'S SALON & SPA
      // ═══════════════════════════════════════════════════════════
      'waxing-regular': createDefaultMetadata(
        [
          {
            key: 'bodyArea',
            label: 'Body Area',
            type: 'select',
            required: true,
            options: [
              { value: 'Upper lip / chin', price: 99 },
              { value: 'Underarms', price: 149 },
              { value: 'Half arms', price: 199 },
              { value: 'Full arms', price: 299 },
              { value: 'Half legs', price: 299 },
              { value: 'Full legs', price: 399 },
              { value: 'Full arms + full legs + underarms', price: 699 },
            ],
          },
          { key: 'skinSensitivity', label: 'Skin Sensitivity', type: 'select', options: ['Normal', 'Sensitive'] },
        ],
        { type: 'from_option', field: 'bodyArea' },
      ),

      'chocolate-waxing': createDefaultMetadata(
        [
          {
            key: 'bodyArea',
            label: 'Body Area',
            type: 'select',
            required: true,
            options: [
              { value: 'Upper lip / chin', price: 129 },
              { value: 'Underarms', price: 199 },
              { value: 'Half arms', price: 249 },
              { value: 'Full arms', price: 399 },
              { value: 'Half legs', price: 399 },
              { value: 'Full legs', price: 499 },
              { value: 'Full arms + full legs + underarms', price: 899 },
            ],
          },
        ],
        { type: 'from_option', field: 'bodyArea' },
      ),

      threading: createDefaultMetadata(
        [
          {
            key: 'areas',
            label: 'Areas',
            type: 'select',
            required: true,
            options: [
              { value: 'Eyebrows', price: 50 },
              { value: 'Upper lip', price: 40 },
              { value: 'Chin', price: 40 },
              { value: 'Full face', price: 150 },
            ],
          },
        ],
        { type: 'from_option', field: 'areas' },
      ),

      'classic-facial': createDefaultMetadata(
        [
          {
            key: 'tier',
            label: 'Facial Tier',
            type: 'select',
            required: true,
            options: [
              { value: 'Express cleanup', price: 399 },
              { value: 'Basic facial', price: 699 },
              { value: 'Premium / brand facial', price: 999 },
            ],
          },
          { key: 'skinType', label: 'Skin Type', type: 'select', options: ['Oily', 'Dry', 'Combination', 'Sensitive'] },
        ],
        { type: 'from_option', field: 'tier' },
      ),

      'haircut-styling': createDefaultMetadata(
        [
          {
            key: 'hairLength',
            label: 'Hair Length',
            type: 'select',
            required: true,
            options: [
              { value: 'Short', price: 499 },
              { value: 'Medium', price: 699 },
              { value: 'Long', price: 899 },
            ],
          },
          {
            key: 'addons',
            label: 'Add-on',
            type: 'select',
            options: [
              { value: 'None', price: 0 },
              { value: 'Wash + blow-dry', price: 250 },
              { value: 'Iron / curl styling', price: 350 },
            ],
          },
        ],
        { type: 'base_plus_addon', baseField: 'hairLength', addonField: 'addons' },
      ),

      // ═══════════════════════════════════════════════════════════
      // MEN'S SALON & GROOMING
      // ═══════════════════════════════════════════════════════════
      'standard-haircut': createDefaultMetadata(
        [
          {
            key: 'style',
            label: 'Style',
            type: 'select',
            required: true,
            options: [
              { value: 'Basic', price: 259 },
              { value: 'Fade', price: 299 },
              { value: 'Premium', price: 349 },
              { value: 'Beard combo', price: 399 },
            ],
          },
        ],
        { type: 'from_option', field: 'style' },
      ),

      'beard-shaping': createDefaultMetadata(
        [
          {
            key: 'style',
            label: 'Beard Style',
            type: 'select',
            required: true,
            options: [
              { value: 'Trim', price: 149 },
              { value: 'Shaping', price: 199 },
              { value: 'Premium styling', price: 299 },
            ],
          },
        ],
        { type: 'from_option', field: 'style' },
      ),

      'clean-shave': createDefaultMetadata(
        [
          {
            key: 'tier',
            label: 'Shave Type',
            type: 'select',
            required: true,
            options: [
              { value: 'Standard', price: 149 },
              { value: 'Premium (with hot towel)', price: 249 },
            ],
          },
        ],
        { type: 'from_option', field: 'tier' },
      ),

      'mens-facial': createDefaultMetadata(
        [
          {
            key: 'tier',
            label: 'Facial Tier',
            type: 'select',
            required: true,
            options: [
              { value: 'Express cleanup', price: 399 },
              { value: 'Basic facial', price: 599 },
              { value: 'Premium facial', price: 899 },
            ],
          },
          { key: 'skinType', label: 'Skin Type', type: 'select', options: ['Oily', 'Dry', 'Combination'] },
        ],
        { type: 'from_option', field: 'tier' },
      ),

      'stress-relief-massage': createDefaultMetadata(
        [
          {
            key: 'duration',
            label: 'Duration',
            type: 'select',
            required: true,
            options: [
              { value: '30 minutes', price: 699 },
              { value: '60 minutes', price: 1299 },
              { value: '90 minutes', price: 1799 },
            ],
          },
          {
            key: 'massageType',
            label: 'Massage Type',
            type: 'select',
            options: ['Swedish', 'Deep Tissue', 'Ayurvedic', 'Aroma Therapy'],
          },
        ],
        { type: 'from_option', field: 'duration' },
      ),

      // ═══════════════════════════════════════════════════════════
      // APPLIANCE REPAIR & SERVICE
      // ═══════════════════════════════════════════════════════════
      'ac-repair': createDefaultMetadata(
        [
          {
            key: 'serviceType',
            label: 'Service Type',
            type: 'select',
            required: true,
            options: [
              { value: 'Inspection / diagnosis', price: 299 },
              { value: 'Jet / foam service', price: 599 },
              { value: 'Installation', price: 1299 },
              { value: 'Gas refill', price: 3000 },
            ],
          },
          { key: 'brand', label: 'Brand', type: 'text', required: true, placeholder: 'e.g., LG, Samsung' },
          { key: 'model', label: 'Model', type: 'text', placeholder: 'Model number' },
          { key: 'capacity', label: 'Capacity (tons)', type: 'number', placeholder: 'e.g., 1.5' },
          {
            key: 'issueType',
            label: 'Issue Type',
            type: 'select',
            options: ['Cooling', 'Noise', 'Leakage', 'Gas Filling', 'Installation', 'Other'],
          },
          { key: 'issueDescription', label: 'Issue Description', type: 'textarea', placeholder: 'Describe the problem' },
        ],
        { type: 'from_option', field: 'serviceType' },
      ),

      'ro-service': createDefaultMetadata(
        [
          {
            key: 'serviceType',
            label: 'Service Type',
            type: 'select',
            required: true,
            options: [
              { value: 'Basic service', price: 299 },
              { value: 'Filter / membrane replacement', price: 999 },
              { value: 'Full service + filter', price: 1299 },
            ],
          },
          { key: 'brand', label: 'Brand', type: 'text', required: true, placeholder: 'e.g., Kent, Aquaguard' },
          { key: 'tdsLevel', label: 'TDS Level', type: 'number', placeholder: 'e.g., 100' },
        ],
        { type: 'from_option', field: 'serviceType' },
      ),

      'washing-machine-repair': createDefaultMetadata(
        [
          { key: 'brand', label: 'Brand', type: 'text', required: true, placeholder: 'e.g., LG, Samsung' },
          { key: 'machineType', label: 'Machine Type', type: 'select', options: ['Front Load', 'Top Load', 'Semi-Automatic'] },
          { key: 'issue', label: 'Issue', type: 'textarea', required: true, placeholder: 'Describe the problem' },
        ],
        { type: 'fixed', basePrice: 299 },
      ),

      'refrigerator-repair': createDefaultMetadata(
        [
          { key: 'brand', label: 'Brand', type: 'text', required: true, placeholder: 'e.g., Samsung, LG' },
          {
            key: 'fridgeType',
            label: 'Fridge Type',
            type: 'select',
            options: ['Single Door', 'Double Door', 'Side-by-Side', 'French Door'],
          },
          { key: 'issue', label: 'Issue', type: 'textarea', required: true, placeholder: 'Describe the problem' },
        ],
        { type: 'fixed', basePrice: 299 },
      ),

      'microwave-repair': createDefaultMetadata(
        [
          {
            key: 'serviceType',
            label: 'Service Type',
            type: 'select',
            required: true,
            options: [
              { value: 'Inspection / check-up', price: 199 },
              { value: 'Repair with parts', price: 499 },
            ],
          },
          { key: 'brand', label: 'Brand', type: 'text', required: true },
          { key: 'issue', label: 'Issue', type: 'textarea', required: true, placeholder: 'e.g., not heating, sparking' },
        ],
        { type: 'from_option', field: 'serviceType' },
      ),

      // ═══════════════════════════════════════════════════════════
      // CLEANING & PEST CONTROL
      // ═══════════════════════════════════════════════════════════
      'full-home-deep-cleaning': createDefaultMetadata(
        [
          {
            key: 'bhk',
            label: 'Home Size',
            type: 'select',
            required: true,
            options: [
              { value: '1 BHK', price: 2499 },
              { value: '2 BHK', price: 3499 },
              { value: '3 BHK', price: 4499 },
              { value: '4 BHK+', price: 5999 },
            ],
          },
          {
            key: 'furnishing',
            label: 'Furnishing',
            type: 'select',
            options: [
              { value: 'Furnished', price: 0 },
              { value: 'Unfurnished (adjustment)', price: -300 },
            ],
          },
          {
            key: 'extraBathrooms',
            label: 'Extra Bathrooms',
            type: 'number',
            placeholder: 'Each additional bathroom = +₹350',
          },
          { key: 'includesKitchen', label: 'Includes Kitchen', type: 'boolean' },
          { key: 'includesBalcony', label: 'Includes Balcony', type: 'boolean' },
        ],
        {
          type: 'base_plus',
          baseField: 'bhk',
          adjustments: [
            { field: 'furnishing', fromOptions: true },
            { field: 'extraBathrooms', multiplier: 350 },
          ],
        },
      ),

      'bathroom-deep-cleaning': createDefaultMetadata(
        [
          {
            key: 'bathroomType',
            label: 'Bathroom Type',
            type: 'select',
            required: true,
            options: [
              { value: 'Standard bathroom', price: 529 },
              { value: 'Large / heavily stained bathroom', price: 799 },
            ],
          },
          {
            key: 'quantity',
            label: 'Number of Bathrooms',
            type: 'number',
            required: true,
            placeholder: 'e.g., 2',
          },
        ],
        { type: 'per_unit_from_option', optionField: 'bathroomType', quantityField: 'quantity' },
      ),

      'sofa-carpet-cleaning': createDefaultMetadata(
        [
          {
            key: 'itemType',
            label: 'Item Type',
            type: 'select',
            required: true,
            options: [
              { value: 'Sofa 2-seat', price: 399 },
              { value: 'Sofa 3-seat', price: 599 },
              { value: 'Sofa 5-seat', price: 899 },
              { value: 'Carpet (up to 50 sq ft)', price: 399 },
              { value: 'Carpet (each additional 50 sq ft)', price: 250 },
            ],
          },
          { key: 'fabricType', label: 'Fabric Type', type: 'select', options: ['Cotton', 'Leather', 'Synthetic', 'Wool'] },
          { key: 'serviceType', label: 'Service Type', type: 'select', options: ['Shampooing', 'Dry Cleaning', 'Steam Cleaning'] },
        ],
        { type: 'from_option', field: 'itemType' },
      ),

      'pest-control': createDefaultMetadata(
        [
          {
            key: 'pestType',
            label: 'Pest Type',
            type: 'select',
            required: true,
            options: [
              { value: 'Cockroach', price: 1249 },
              { value: 'Ant', price: 999 },
              { value: 'Bed Bug', price: 1799 },
              { value: 'Rodent', price: 1499 },
            ],
          },
          { key: 'propertyType', label: 'Property Type', type: 'select', options: ['Apartment', 'Villa', 'Office', 'Shop'] },
          { key: 'rooms', label: 'Number of Rooms', type: 'number', required: true },
        ],
        { type: 'from_option', field: 'pestType' },
      ),

      'termite-treatment': createDefaultMetadata(
        [
          {
            key: 'treatmentType',
            label: 'Treatment Type',
            type: 'select',
            required: true,
            options: [
              { value: 'Pre-construction', price: 3999 },
              { value: 'Post-construction', price: 4999 },
            ],
          },
          { key: 'propertyType', label: 'Property Type', type: 'select', options: ['Apartment', 'Villa', 'Office'] },
          { key: 'area', label: 'Area (sq ft)', type: 'number', required: true },
          { key: 'affectedAreas', label: 'Affected Areas', type: 'textarea', placeholder: 'e.g., wooden frames, furniture' },
        ],
        { type: 'from_option', field: 'treatmentType' },
      ),

      // ═══════════════════════════════════════════════════════════
      // HOME REPAIRS & HANDYMAN
      // ═══════════════════════════════════════════════════════════
      electrician: createDefaultMetadata(
        [
          {
            key: 'serviceType',
            label: 'Service Type',
            type: 'select',
            required: true,
            options: [
              { value: 'First visit / diagnosis', price: 199 },
              { value: 'Each additional 30 minutes', price: 150 },
            ],
          },
          { key: 'issueDescription', label: 'Issue Description', type: 'textarea', required: true, placeholder: 'Describe the issue' },
        ],
        { type: 'from_option', field: 'serviceType' },
      ),

      plumber: createDefaultMetadata(
        [
          {
            key: 'serviceType',
            label: 'Service Type',
            type: 'select',
            required: true,
            options: [
              { value: 'First visit / diagnosis', price: 199 },
              { value: 'Each additional 30 minutes', price: 150 },
            ],
          },
          { key: 'issueDescription', label: 'Issue Description', type: 'textarea', required: true, placeholder: 'Describe the issue' },
        ],
        { type: 'from_option', field: 'serviceType' },
      ),

      carpenter: createDefaultMetadata(
        [
          {
            key: 'serviceType',
            label: 'Service Type',
            type: 'select',
            required: true,
            options: [
              { value: 'First visit / diagnosis', price: 249 },
              { value: 'Each additional 30 minutes', price: 175 },
            ],
          },
          { key: 'issueDescription', label: 'Work Description', type: 'textarea', required: true, placeholder: 'Describe the work needed' },
        ],
        { type: 'from_option', field: 'serviceType' },
      ),

      // ═══════════════════════════════════════════════════════════
      // HOME RENOVATIONS & WALL MAKEOVERS
      // ═══════════════════════════════════════════════════════════
      'interior-painting': createDefaultMetadata(
        [
          {
            key: 'pricingMode',
            label: 'Pricing Mode',
            type: 'select',
            required: true,
            options: [
              { value: 'Labour only', price: 12 },
              { value: 'Paint + labour', price: 25 },
            ],
          },
          { key: 'area', label: 'Area (sq ft)', type: 'number', required: true },
          { key: 'coats', label: 'Coats', type: 'select', options: ['1 Coat', '2 Coats', '3 Coats'] },
          { key: 'paintType', label: 'Paint Type', type: 'select', options: ['Emulsion', 'Distemper', 'Enamel', 'Texture'] },
        ],
        { type: 'per_sqft_from_option', optionField: 'pricingMode', areaField: 'area' },
      ),

      waterproofing: createDefaultMetadata(
        [
          { key: 'location', label: 'Location', type: 'select', required: true, options: ['Balcony', 'Terrace', 'Bathroom', 'Basement', 'Roof'] },
          { key: 'area', label: 'Area (sq ft)', type: 'number', required: true },
          { key: 'issueType', label: 'Issue Type', type: 'select', options: ['Leakage', 'Dampness', 'Cracks', 'Seepage'] },
          { key: 'surfaceType', label: 'Surface Type', type: 'select', options: ['Concrete', 'Tiled', 'Metal', 'Wood'] },
        ],
        { type: 'per_sqft', rate: 35, areaField: 'area' },
      ),

      'wall-paneling': createDefaultMetadata(
        [
          {
            key: 'material',
            label: 'Material',
            type: 'select',
            required: true,
            options: [
              { value: 'PVC panel', price: 120 },
              { value: 'WPC panel', price: 150 },
              { value: 'MDF panel', price: 180 },
            ],
          },
          { key: 'area', label: 'Area (sq ft)', type: 'number', required: true },
          { key: 'room', label: 'Room', type: 'select', options: ['Living Room', 'Bedroom', 'Kitchen', 'Bathroom', 'Office'] },
        ],
        { type: 'per_sqft_from_option', optionField: 'material', areaField: 'area' },
      ),

      // ═══════════════════════════════════════════════════════════
      // TRANSPORT HUBS (RAILWAYS & BUS)
      // ═══════════════════════════════════════════════════════════
      'railway-cooli': createDefaultMetadata(
        [
          { key: 'trainNumber', label: 'Train Number', type: 'text', required: true, placeholder: 'e.g., 12345' },
          { key: 'coachNumber', label: 'Coach Number', type: 'text', required: true, placeholder: 'e.g., S1, A2' },
          { key: 'seatNumber', label: 'Seat Number', type: 'text', placeholder: 'e.g., 22' },
          { key: 'passengerName', label: 'Passenger Name', type: 'text' },
          { key: 'luggageItems', label: 'Number of Items', type: 'number', required: true },
          { key: 'luggageWeight', label: 'Luggage Weight (kg)', type: 'number' },
          { key: 'station', label: 'Station Name', type: 'text', required: true },
        ],
        { type: 'fixed', basePrice: 100 },
      ),

      'bus-terminal-service': createDefaultMetadata(
        [
          { key: 'busNumber', label: 'Bus Number', type: 'text', required: true },
          { key: 'route', label: 'Route', type: 'text' },
          { key: 'terminal', label: 'Terminal / Stop', type: 'text', required: true },
          { key: 'luggageItems', label: 'Number of Items', type: 'number', required: true },
          { key: 'luggageWeight', label: 'Luggage Weight (kg)', type: 'number' },
        ],
        { type: 'fixed', basePrice: 100 },
      ),

      'mandi-loading': createDefaultMetadata(
        [
          { key: 'marketName', label: 'Market Name', type: 'text', required: true },
          { key: 'commodityType', label: 'Commodity Type', type: 'text', required: true },
          { key: 'quantity', label: 'Quantity', type: 'number', required: true },
          { key: 'unit', label: 'Unit', type: 'select', options: ['Sacks', 'Crates', 'Boxes', 'Pieces', 'Kilograms'] },
          { key: 'workerHours', label: 'Estimated Worker-Hours', type: 'number', required: true },
        ],
        { type: 'per_hour', rate: 350, hoursField: 'workerHours' },
      ),

      // ═══════════════════════════════════════════════════════════
      // WAREHOUSING & LOGISTICS
      // ═══════════════════════════════════════════════════════════
      'freight-unloading': createDefaultMetadata(
        [
          { key: 'containerType', label: 'Container Type', type: 'select', options: ['Standard', 'Reefer', 'Open Top', 'Flat Rack'] },
          { key: 'weight', label: 'Weight (kg)', type: 'number', required: true },
          { key: 'pallets', label: 'Number of Pallets', type: 'number' },
          { key: 'workerHours', label: 'Estimated Worker-Hours', type: 'number', required: true },
        ],
        { type: 'per_hour', rate: 450, hoursField: 'workerHours' },
      ),

      'pallet-stacking': createDefaultMetadata(
        [
          { key: 'pallets', label: 'Number of Pallets', type: 'number', required: true },
          { key: 'height', label: 'Stack Height (meters)', type: 'number' },
        ],
        { type: 'per_unit', rate: 50, quantityField: 'pallets' },
      ),

      'loading-service': createDefaultMetadata(
        [
          {
            key: 'crewSize',
            label: 'Crew Size',
            type: 'select',
            required: true,
            options: [
              { value: 'One worker per hour', price: 350 },
              { value: 'Two workers per hour', price: 650 },
              { value: 'Four workers per hour', price: 1200 },
            ],
          },
          { key: 'hours', label: 'Hours', type: 'number', required: true },
          { key: 'vehicleType', label: 'Vehicle Type', type: 'text', required: true },
        ],
        { type: 'per_hour_from_option', optionField: 'crewSize', hoursField: 'hours' },
      ),

      // ═══════════════════════════════════════════════════════════
      // CONSTRUCTION & SITE MATERIALS
      // ═══════════════════════════════════════════════════════════
      'material-shifting': createDefaultMetadata(
        [
          { key: 'materialType', label: 'Material Type', type: 'select', required: true, options: ['Cement', 'Bricks', 'Sand', 'Steel', 'Wood', 'Tiles'] },
          { key: 'workerHours', label: 'Estimated Worker-Hours', type: 'number', required: true },
          { key: 'sourceFloor', label: 'Source Floor', type: 'text' },
          { key: 'destinationFloor', label: 'Destination Floor', type: 'text' },
          { key: 'requiresLift', label: 'Requires Lift/Elevator', type: 'boolean' },
        ],
        { type: 'per_hour', rate: 350, hoursField: 'workerHours' },
      ),

      'masonry-work': createDefaultMetadata(
        [
          { key: 'workType', label: 'Work Type', type: 'select', required: true, options: ['Brickwork', 'Plastering', 'Tiling', 'Foundation', 'Retaining Wall'] },
          { key: 'area', label: 'Area (sq ft)', type: 'number', required: true },
          { key: 'material', label: 'Material', type: 'select', options: ['Brick', 'Concrete Block', 'Stone', 'Tile', 'Marble'] },
          { key: 'includesPlastering', label: 'Includes Plastering', type: 'boolean' },
        ],
        { type: 'per_sqft', rate: 35, areaField: 'area' },
      ),

      demolition: createDefaultMetadata(
        [
          { key: 'structureType', label: 'Structure Type', type: 'select', required: true, options: ['Wall', 'Ceiling', 'Partition', 'Balcony', 'Floor', 'Foundation'] },
          { key: 'area', label: 'Area (sq ft)', type: 'number', required: true },
          { key: 'includesDebrisRemoval', label: 'Include Debris Removal', type: 'boolean' },
          { key: 'includesSafetyMeasures', label: 'Include Safety Measures', type: 'boolean' },
        ],
        { type: 'per_sqft', rate: 25, areaField: 'area' },
      ),

      // ═══════════════════════════════════════════════════════════
      // DOMESTIC MOVING & SHIFTING
      // ═══════════════════════════════════════════════════════════
      'household-shifting': createDefaultMetadata(
        [
          {
            key: 'homeSize',
            label: 'Home Size',
            type: 'select',
            required: true,
            options: [
              { value: '1 BHK local move', price: 3999 },
              { value: '2 BHK local move', price: 6999 },
              { value: '3 BHK local move', price: 9999 },
            ],
          },
          {
            key: 'packingMaterials',
            label: 'Packing Materials',
            type: 'boolean',
            price: 800,
          },
          {
            key: 'longCarry',
            label: 'Long Carry / No Lift',
            type: 'boolean',
            price: 500,
          },
          { key: 'originAddress', label: 'Origin Address', type: 'textarea', required: true },
          { key: 'destinationAddress', label: 'Destination Address', type: 'textarea', required: true },
        ],
        { type: 'base_plus_booleans', baseField: 'homeSize' },
      ),

      'furniture-moving': createDefaultMetadata(
        [
          { key: 'items', label: 'Items (comma separated)', type: 'textarea', required: true },
          { key: 'originAddress', label: 'Origin Address', type: 'textarea', required: true },
          { key: 'destinationAddress', label: 'Destination Address', type: 'textarea', required: true },
        ],
        { type: 'fixed', basePrice: 499 },
      ),

      'appliance-moving': createDefaultMetadata(
        [
          { key: 'appliances', label: 'Appliances (comma separated)', type: 'textarea', required: true },
          { key: 'originAddress', label: 'Origin Address', type: 'textarea', required: true },
          { key: 'destinationAddress', label: 'Destination Address', type: 'textarea', required: true },
        ],
        { type: 'fixed', basePrice: 399 },
      ),

      // ═══════════════════════════════════════════════════════════
      // SEWAGE & DRAINAGE WORKS
      // ═══════════════════════════════════════════════════════════
      'pipeline-cleaning': createDefaultMetadata(
        [
          { key: 'location', label: 'Location', type: 'select', required: true, options: ['Kitchen', 'Bathroom', 'Toilet', 'Outdoor Drain', 'Basement'] },
          { key: 'blockageType', label: 'Blockage Type', type: 'select', options: ['Grease', 'Hair', 'Solid Waste', 'Root Intrusion', 'Unknown'] },
          { key: 'serviceType', label: 'Service Type', type: 'select', options: ['Pipeline Cleaning', 'Root Removal', 'Inspection'] },
        ],
        { type: 'fixed', basePrice: 499 },
      ),

      'septic-tank-cleaning': createDefaultMetadata(
        [
          {
            key: 'tankSize',
            label: 'Tank Size',
            type: 'select',
            required: true,
            options: [
              { value: 'Small tank', price: 3500 },
              { value: 'Medium tank', price: 5500 },
              { value: 'Large tank', price: 8000 },
            ],
          },
          { key: 'accessibility', label: 'Accessibility', type: 'select', options: ['Easy', 'Moderate', 'Difficult'] },
        ],
        { type: 'from_option', field: 'tankSize' },
      ),

      'manhole-maintenance': createDefaultMetadata(
        [
          { key: 'depth', label: 'Depth (meters)', type: 'number', required: true },
          { key: 'condition', label: 'Condition', type: 'select', options: ['Good', 'Fair', 'Poor'] },
        ],
        { type: 'fixed', basePrice: 2500 },
      ),

      // ═══════════════════════════════════════════════════════════
      // GARDEN SETUP & MAINTENANCE
      // ═══════════════════════════════════════════════════════════
      landscaping: createDefaultMetadata(
        [
          { key: 'serviceType', label: 'Service Type', type: 'select', required: true, options: ['Lawn Installation', 'Balcony Garden', 'Kitchen Garden', 'Vertical Garden', 'Flower Bed'] },
          { key: 'area', label: 'Area (sq ft)', type: 'number', required: true },
          { key: 'includesIrrigation', label: 'Include Drip/Sprinkler Irrigation', type: 'boolean' },
        ],
        { type: 'per_sqft', rate: 25, areaField: 'area' },
      ),

      'plant-care': createDefaultMetadata(
        [
          {
            key: 'serviceType',
            label: 'Service Type',
            type: 'select',
            required: true,
            options: [
              { value: 'Pruning', price: 299 },
              { value: 'Weeding', price: 249 },
              { value: 'Mowing', price: 299 },
              { value: 'Soil Care', price: 349 },
              { value: 'Fertilizing', price: 299 },
            ],
          },
          { key: 'plantCount', label: 'Number of Plants / Area', type: 'text', required: true },
          { key: 'includesPestControl', label: 'Include Pest Control', type: 'boolean' },
        ],
        { type: 'from_option', field: 'serviceType' },
      ),

      'pest-control-garden': createDefaultMetadata(
        [
          { key: 'plantType', label: 'Plant Type', type: 'text', required: true },
          { key: 'pestType', label: 'Pest Type', type: 'select', options: ['Aphids', 'Mealybugs', 'Fungal', 'Other'] },
          { key: 'area', label: 'Area (sq ft)', type: 'number', required: true },
        ],
        { type: 'fixed', basePrice: 499 },
      ),

      // ═══════════════════════════════════════════════════════════
      // FARMING & AGRICULTURE
      // ═══════════════════════════════════════════════════════════
      'land-preparation': createDefaultMetadata(
        [
          {
            key: 'equipment',
            label: 'Equipment',
            type: 'select',
            required: true,
            options: [
              { value: 'Tractor / tiller', price: 2500 },
              { value: 'Rotavator', price: 2800 },
              { value: 'Plough', price: 2200 },
              { value: 'Manual', price: 1500 },
            ],
          },
          { key: 'fieldSize', label: 'Field Size (acres)', type: 'number', required: true },
          { key: 'cropType', label: 'Crop Type', type: 'text', required: true },
          { key: 'soilType', label: 'Soil Type', type: 'select', options: ['Loamy', 'Sandy', 'Clay', 'Silt', 'Peaty'] },
        ],
        { type: 'per_acre_from_option', optionField: 'equipment', areaField: 'fieldSize' },
      ),

      'sowing-planting': createDefaultMetadata(
        [
          { key: 'cropType', label: 'Crop Type', type: 'text', required: true },
          { key: 'seedVariety', label: 'Seed Variety', type: 'text' },
          { key: 'sowingMethod', label: 'Sowing Method', type: 'select', options: ['Broadcast', 'Seed Drill', 'Dibbling', 'Transplanting'] },
          { key: 'area', label: 'Area (acres)', type: 'number', required: true },
        ],
        { type: 'per_acre', rate: 1800, areaField: 'area' },
      ),

      harvesting: createDefaultMetadata(
        [
          { key: 'cropType', label: 'Crop Type', type: 'text', required: true },
          { key: 'area', label: 'Area (acres)', type: 'number', required: true },
          { key: 'harvestMethod', label: 'Harvest Method', type: 'select', options: ['Manual', 'Combine Harvester', 'Mechanical', 'Semi-Mechanical'] },
          { key: 'includesProcessing', label: 'Include Primary Processing', type: 'boolean' },
        ],
        { type: 'per_acre', rate: 2500, areaField: 'area' },
      ),
    };

    const categoriesData = [
      {
        name: "Women's Salon & Spa",
        slug: "women-salon-spa",
        icon: "Venus",
        description: "Waxing, threading, facials, hair, massage, laser",
        image: "https://picsum.photos/seed/women-salon/400/300",
        sortOrder: 1,
        isActive: true,
        services: [
          { name: "Waxing (Regular)", slug: "waxing-regular", basePrice: 399, duration: 45, metadata: serviceMetadata['waxing-regular'], image: "https://picsum.photos/seed/waxing/200/150" },
          { name: "Chocolate Waxing", slug: "chocolate-waxing", basePrice: 599, duration: 45, metadata: serviceMetadata['chocolate-waxing'], image: "https://picsum.photos/seed/chocolate-wax/200/150" },
          { name: "Threading", slug: "threading", basePrice: 50, duration: 15, metadata: serviceMetadata['threading'], image: "https://picsum.photos/seed/threading/200/150" },
          { name: "Classic Facial", slug: "classic-facial", basePrice: 699, duration: 60, metadata: serviceMetadata['classic-facial'], image: "https://picsum.photos/seed/classic-facial/200/150" },
          { name: "Haircut & Styling", slug: "haircut-styling", basePrice: 699, duration: 45, metadata: serviceMetadata['haircut-styling'], image: "https://picsum.photos/seed/haircut/200/150" },
        ],
      },
      {
        name: "Men's Salon & Grooming",
        slug: "men-salon-grooming",
        icon: "Mars",
        description: "Haircuts, beard, shaving, facials, massages",
        image: "https://picsum.photos/seed/men-salon/400/300",
        sortOrder: 2,
        isActive: true,
        services: [
          { name: "Standard Haircut", slug: "standard-haircut", basePrice: 259, duration: 25, metadata: serviceMetadata['standard-haircut'], image: "https://picsum.photos/seed/men-haircut/200/150" },
          { name: "Beard Shaping", slug: "beard-shaping", basePrice: 149, duration: 15, metadata: serviceMetadata['beard-shaping'], image: "https://picsum.photos/seed/beard/200/150" },
          { name: "Clean Shave", slug: "clean-shave", basePrice: 149, duration: 20, metadata: serviceMetadata['clean-shave'], image: "https://picsum.photos/seed/shaves/200/150" },
          { name: "Men's Facial", slug: "mens-facial", basePrice: 599, duration: 45, metadata: serviceMetadata['mens-facial'], image: "https://picsum.photos/seed/mens-facial/200/150" },
          { name: "Stress Relief Massage", slug: "stress-relief-massage", basePrice: 999, duration: 60, metadata: serviceMetadata['stress-relief-massage'], image: "https://picsum.photos/seed/massage/200/150" },
        ],
      },
      {
        name: "Appliance Repair & Service",
        slug: "appliance-repair-service",
        icon: "Wrench",
        description: "AC, RO, washing machine, refrigerator, microwave",
        image: "https://picsum.photos/seed/appliance/400/300",
        sortOrder: 3,
        isActive: true,
        services: [
          { name: "AC Repair", slug: "ac-repair", basePrice: 299, duration: 60, metadata: serviceMetadata['ac-repair'], image: "https://picsum.photos/seed/ac-repair/200/150" },
          { name: "RO Service", slug: "ro-service", basePrice: 299, duration: 45, metadata: serviceMetadata['ro-service'], image: "https://picsum.photos/seed/ro-service/200/150" },
          { name: "Washing Machine Repair", slug: "washing-machine-repair", basePrice: 299, duration: 60, metadata: serviceMetadata['washing-machine-repair'], image: "https://picsum.photos/seed/washing-machine/200/150" },
          { name: "Refrigerator Repair", slug: "refrigerator-repair", basePrice: 299, duration: 60, metadata: serviceMetadata['refrigerator-repair'], image: "https://picsum.photos/seed/refrigerator/200/150" },
          { name: "Microwave Repair", slug: "microwave-repair", basePrice: 199, duration: 45, metadata: serviceMetadata['microwave-repair'], image: "https://picsum.photos/seed/microwave/200/150" },
        ],
      },
      {
        name: "Cleaning & Pest Control",
        slug: "cleaning-pest-control",
        icon: "Sparkles",
        description: "Deep cleaning, upholstery, pest control",
        image: "https://picsum.photos/seed/cleaning/400/300",
        sortOrder: 4,
        isActive: true,
        services: [
          { name: "Full Home Deep Cleaning", slug: "full-home-deep-cleaning", basePrice: 2499, duration: 240, metadata: serviceMetadata['full-home-deep-cleaning'], image: "https://picsum.photos/seed/deep-clean/200/150" },
          { name: "Bathroom Deep Cleaning", slug: "bathroom-deep-cleaning", basePrice: 529, duration: 60, metadata: serviceMetadata['bathroom-deep-cleaning'], image: "https://picsum.photos/seed/bathroom-clean/200/150" },
          { name: "Sofa & Carpet Cleaning", slug: "sofa-carpet-cleaning", basePrice: 399, duration: 60, metadata: serviceMetadata['sofa-carpet-cleaning'], image: "https://picsum.photos/seed/sofa-clean/200/150" },
          { name: "Pest Control", slug: "pest-control", basePrice: 1249, duration: 60, metadata: serviceMetadata['pest-control'], image: "https://picsum.photos/seed/pest-control/200/150" },
          { name: "Termite Treatment", slug: "termite-treatment", basePrice: 3999, duration: 120, metadata: serviceMetadata['termite-treatment'], image: "https://picsum.photos/seed/termite/200/150" },
        ],
      },
      {
        name: "Home Repairs & Handyman",
        slug: "home-repairs-handyman",
        icon: "Hammer",
        description: "Electrician, plumber, carpenter",
        image: "https://picsum.photos/seed/handyman/400/300",
        sortOrder: 5,
        isActive: true,
        services: [
          { name: "Electrician", slug: "electrician", basePrice: 199, duration: 30, metadata: serviceMetadata['electrician'], image: "https://picsum.photos/seed/electrician/200/150" },
          { name: "Plumber", slug: "plumber", basePrice: 199, duration: 30, metadata: serviceMetadata['plumber'], image: "https://picsum.photos/seed/plumber/200/150" },
          { name: "Carpenter", slug: "carpenter", basePrice: 249, duration: 30, metadata: serviceMetadata['carpenter'], image: "https://picsum.photos/seed/carpenter/200/150" },
        ],
      },
      {
        name: "Home Renovations & Wall Makeovers",
        slug: "home-renovations-wall-makeovers",
        icon: "PaintRoller",
        description: "Painting, waterproofing, wall paneling",
        image: "https://picsum.photos/seed/renovation/400/300",
        sortOrder: 6,
        isActive: true,
        services: [
          { name: "Interior Painting", slug: "interior-painting", basePrice: 12, duration: 120, metadata: serviceMetadata['interior-painting'], image: "https://picsum.photos/seed/painting/200/150" },
          { name: "Waterproofing", slug: "waterproofing", basePrice: 35, duration: 90, metadata: serviceMetadata['waterproofing'], image: "https://picsum.photos/seed/waterproof/200/150" },
          { name: "Wall Paneling", slug: "wall-paneling", basePrice: 120, duration: 120, metadata: serviceMetadata['wall-paneling'], image: "https://picsum.photos/seed/paneling/200/150" },
        ],
      },
      {
        name: "Transport Hubs (Railways & Bus)",
        slug: "transport-hubs-railways-bus",
        icon: "TrainFront",
        description: "Luggage carrying, loading/unloading, hand carts",
        image: "https://picsum.photos/seed/transport/400/300",
        sortOrder: 7,
        isActive: true,
        services: [
          { name: "Railway Cooli", slug: "railway-cooli", basePrice: 100, duration: 30, metadata: serviceMetadata['railway-cooli'], image: "https://picsum.photos/seed/railway/200/150" },
          { name: "Bus Terminal Service", slug: "bus-terminal-service", basePrice: 100, duration: 20, metadata: serviceMetadata['bus-terminal-service'], image: "https://picsum.photos/seed/bus/200/150" },
          { name: "Mandi Loading", slug: "mandi-loading", basePrice: 350, duration: 60, metadata: serviceMetadata['mandi-loading'], image: "https://picsum.photos/seed/mandi/200/150" },
        ],
      },
      {
        name: "Warehousing & Logistics",
        slug: "warehousing-logistics",
        icon: "Package",
        description: "Freight unloading, pallet stacking, loading",
        image: "https://picsum.photos/seed/warehouse/400/300",
        sortOrder: 8,
        isActive: true,
        services: [
          { name: "Freight Loading", slug: "freight-unloading", basePrice: 450, duration: 60, metadata: serviceMetadata['freight-unloading'], image: "https://picsum.photos/seed/freight/200/150" },
          { name: "Pallet Stacking", slug: "pallet-stacking", basePrice: 50, duration: 30, metadata: serviceMetadata['pallet-stacking'], image: "https://picsum.photos/seed/pallet/200/150" },
          { name: "Loading Service", slug: "loading-service", basePrice: 350, duration: 60, metadata: serviceMetadata['loading-service'], image: "https://picsum.photos/seed/loading/200/150" },
        ],
      },
      {
        name: "Construction & Site Material",
        slug: "construction-site-material",
        icon: "Construction",
        description: "Brickwork, plastering, tiling, demolition",
        image: "https://picsum.photos/seed/construction/400/300",
        sortOrder: 9,
        isActive: true,
        services: [
          { name: "Material Shifting", slug: "material-shifting", basePrice: 350, duration: 60, metadata: serviceMetadata['material-shifting'], image: "https://picsum.photos/seed/material/200/150" },
          { name: "Masonry Works", slug: "masonry-work", basePrice: 35, duration: 240, metadata: serviceMetadata['masonry-work'], image: "https://picsum.photos/seed/masonry/200/150" },
          { name: "Demolishing Works", slug: "demolition", basePrice: 25, duration: 180, metadata: serviceMetadata['demolition'], image: "https://picsum.photos/seed/demolition/200/150" },
        ],
      },
      {
        name: "Domestic Moving & Shifting",
        slug: "domestic-moving-shifting",
        icon: "Truck",
        description: "Furniture lifting, appliance moving, packing",
        image: "https://picsum.photos/seed/moving/400/300",
        sortOrder: 10,
        isActive: true,
        services: [
          { name: "Household Shifting", slug: "household-shifting", basePrice: 3999, duration: 480, metadata: serviceMetadata['household-shifting'], image: "https://picsum.photos/seed/household/200/150" },
          { name: "Furniture Moving", slug: "furniture-moving", basePrice: 499, duration: 120, metadata: serviceMetadata['furniture-moving'], image: "https://picsum.photos/seed/furniture/200/150" },
          { name: "Appliances Moving", slug: "appliance-moving", basePrice: 399, duration: 90, metadata: serviceMetadata['appliance-moving'], image: "https://picsum.photos/seed/appliance-move/200/150" },
        ],
      },
      {
        name: "Sewage & Drainage",
        slug: "sewage-drainage",
        icon: "Droplet",
        description: "Pipeline cleaning, septic tank, manhole maintenance",
        image: "https://picsum.photos/seed/sewage/400/300",
        sortOrder: 11,
        isActive: true,
        services: [
          { name: "Pipeline Cleaning", slug: "pipeline-cleaning", basePrice: 499, duration: 60, metadata: serviceMetadata['pipeline-cleaning'], image: "https://picsum.photos/seed/pipeline/200/150" },
          { name: "Septic Tank Cleaning", slug: "septic-tank-cleaning", basePrice: 3500, duration: 120, metadata: serviceMetadata['septic-tank-cleaning'], image: "https://picsum.photos/seed/septic/200/150" },
          { name: "Manhole Maintenance", slug: "manhole-maintenance", basePrice: 2500, duration: 120, metadata: serviceMetadata['manhole-maintenance'], image: "https://picsum.photos/seed/manhole/200/150" },
        ],
      },
      {
        name: "Garden Setup & Maintenance",
        slug: "garden-setup-maintenance",
        icon: "Sprout",
        description: "Landscaping, plant care, soil management, pest control",
        image: "https://picsum.photos/seed/garden/400/300",
        sortOrder: 12,
        isActive: true,
        services: [
          { name: "Landscaping", slug: "landscaping", basePrice: 25, duration: 240, metadata: serviceMetadata['landscaping'], image: "https://picsum.photos/seed/landscaping/200/150" },
          { name: "Plant Care", slug: "plant-care", basePrice: 299, duration: 60, metadata: serviceMetadata['plant-care'], image: "https://picsum.photos/seed/plant-care/200/150" },
          { name: "Pest Control (Garden)", slug: "pest-control-garden", basePrice: 499, duration: 60, metadata: serviceMetadata['pest-control-garden'], image: "https://picsum.photos/seed/garden-pest/200/150" },
        ],
      },
      {
        name: "Farming & Agriculture",
        slug: "farming-agriculture",
        icon: "Tractor",
        description: "Land preparation, sowing, irrigation, harvesting",
        image: "https://picsum.photos/seed/farming/400/300",
        sortOrder: 13,
        isActive: true,
        services: [
          { name: "Land Preparation", slug: "land-preparation", basePrice: 2500, duration: 480, metadata: serviceMetadata['land-preparation'], image: "https://picsum.photos/seed/land-prep/200/150" },
          { name: "Sowing & Planting", slug: "sowing-planting", basePrice: 1800, duration: 360, metadata: serviceMetadata['sowing-planting'], image: "https://picsum.photos/seed/sowing/200/150" },
          { name: "Harvesting", slug: "harvesting", basePrice: 2500, duration: 480, metadata: serviceMetadata['harvesting'], image: "https://picsum.photos/seed/harvest/200/150" },
        ],
      }
    ];

    for (const categoryData of categoriesData) {
      const [category, created] = await Category.findOrCreate({
        where: { slug: categoryData.slug },
        defaults: {
          name: categoryData.name,
          slug: categoryData.slug,
          icon: categoryData.icon,
          description: categoryData.description,
          image: categoryData.image,
          sortOrder: categoryData.sortOrder,
          isActive: categoryData.isActive,
        }
      });

      if (!created) {
        await category.update({
          name: categoryData.name,
          icon: categoryData.icon,
          description: categoryData.description,
          image: categoryData.image,
          sortOrder: categoryData.sortOrder,
          isActive: categoryData.isActive,
        });
      }

      for (const serviceData of categoryData.services) {
        await Service.findOrCreate({
          where: { slug: serviceData.slug },
          defaults: {
            categoryId: category.id,
            name: serviceData.name,
            slug: serviceData.slug,
            description: serviceData.description,
            basePrice: serviceData.basePrice,
            duration: serviceData.duration,
            image: serviceData.image,
            metadata: serviceData.metadata,
            pricingUnit: serviceData.pricingUnit,
            isActive: true,
          }
        });
      }
    }

    console.log('✅ Database seeded with categories, services, and images');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  }
};

// ─── Start Server ──────────────────────────────────────────────────
sequelize
  .sync({ alter: true })
  .then(() => {
    console.log('✅ Database synced');
    return seedDatabase();
  })
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on ${process.env.BASE_URL || 'http://localhost:' + PORT}`);
      console.log(`📁 Uploads available at ${process.env.BASE_URL || 'http://localhost:' + PORT}/uploads/`);
    });
    const initSocket = require('./src/socket');
    const io = initSocket(server);
    app.set('io', io);       // controllers using req.app.get('io')
    global.io = io;          // anything using global.io
    console.log(`🔌 WebSocket server initialized`);
  })
  .catch((err) => {
    console.error('❌ Database connection failed:', err);
  });