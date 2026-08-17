const dotenv = require('dotenv');
dotenv.config();

const app = require('./src/app');
const { sequelize, Category, Service, User } = require('./src/models');
const bcrypt = require('bcryptjs');

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
    // ─── Helper to create default metadata ──────────────────────────
const createDefaultMetadata = (fields = []) => ({
  formFields: fields,
  priceCalculation: { type: 'fixed' },
});

// ─── Metadata for each service ──────────────────────────────────
const serviceMetadata = {
  // Women's Salon & Spa
  'waxing-regular': createDefaultMetadata([
    { key: 'bodyArea', label: 'Body Area', type: 'select', required: true, options: ['Arms', 'Legs', 'Full Body', 'Bikini'] },
    { key: 'sensitivity', label: 'Skin Sensitivity', type: 'select', options: ['Normal', 'Sensitive'] },
  ]),
  'chocolate-waxing': createDefaultMetadata([
    { key: 'bodyArea', label: 'Body Area', type: 'select', required: true, options: ['Arms', 'Legs', 'Full Body', 'Bikini'] },
  ]),
  threading: createDefaultMetadata([
    { key: 'areas', label: 'Areas', type: 'select', required: true, options: ['Eyebrow', 'Upper Lip', 'Chin', 'Full Face'] },
  ]),
  'classic-facial': createDefaultMetadata([
    { key: 'skinType', label: 'Skin Type', type: 'select', options: ['Oily', 'Dry', 'Combination', 'Sensitive'] },
    { key: 'addons', label: 'Add-ons', type: 'select', options: ['Steam', 'Mask', 'Massage'] },
  ]),
  'haircut-styling': createDefaultMetadata([
    { key: 'style', label: 'Style', type: 'select', required: true, options: ['Classic', 'Trendy', 'Buzz Cut', 'Crew Cut'] },
    { key: 'length', label: 'Desired Length', type: 'text', placeholder: 'e.g., Short, Medium' },
  ]),

  // Men's Salon & Grooming
  'standard-haircut': createDefaultMetadata([
    { key: 'style', label: 'Style', type: 'select', required: true, options: ['Classic', 'Fade', 'Buzz', 'Crew'] },
  ]),
  'beard-shaping': createDefaultMetadata([
    { key: 'style', label: 'Beard Style', type: 'select', options: ['Stubble', 'Full', 'Goatee', 'Clean Shave'] },
  ]),
  'clean-shave': createDefaultMetadata([
    { key: 'withHotTowel', label: 'Hot Towel', type: 'boolean' },
  ]),
  'mens-facial': createDefaultMetadata([
    { key: 'skinType', label: 'Skin Type', type: 'select', options: ['Oily', 'Dry', 'Combination'] },
  ]),
  'stress-relief-massage': createDefaultMetadata([
    { key: 'massageType', label: 'Massage Type', type: 'select', required: true, options: ['Swedish', 'Deep Tissue', 'Ayurvedic'] },
    { key: 'focusAreas', label: 'Focus Areas', type: 'textarea', placeholder: 'e.g., Neck, Shoulders, Lower Back' },
  ]),

  // Appliance Repair & Service
  'ac-repair': createDefaultMetadata([
    { key: 'brand', label: 'Brand', type: 'text', required: true, placeholder: 'e.g., LG, Samsung' },
    { key: 'model', label: 'Model', type: 'text', placeholder: 'Model number' },
    { key: 'capacity', label: 'Capacity (tons)', type: 'number', placeholder: 'e.g., 1.5' },
    { key: 'issueType', label: 'Issue Type', type: 'select', required: true, options: ['Cooling', 'Noise', 'Leakage', 'Gas Filling', 'Installation', 'Other'] },
    { key: 'issueDescription', label: 'Issue Description', type: 'textarea', required: true, placeholder: 'Describe the problem' },
  ]),
  'ro-service': createDefaultMetadata([
    { key: 'brand', label: 'Brand', type: 'text', required: true, placeholder: 'e.g., Kent, Aquaguard' },
    { key: 'filterType', label: 'Filter Type', type: 'select', options: ['Sediment', 'Carbon', 'RO', 'UV', 'UF'] },
    { key: 'tdsLevel', label: 'TDS Level', type: 'number', placeholder: 'e.g., 100' },
    { key: 'issue', label: 'Issue', type: 'textarea', required: true, placeholder: 'Describe the issue' },
  ]),
  'washing-machine-repair': createDefaultMetadata([
    { key: 'brand', label: 'Brand', type: 'text', required: true, placeholder: 'e.g., LG, Samsung' },
    { key: 'machineType', label: 'Machine Type', type: 'select', options: ['Front Load', 'Top Load', 'Semi-Automatic'] },
    { key: 'issue', label: 'Issue', type: 'textarea', required: true, placeholder: 'Describe the problem' },
  ]),
  'refrigerator-repair': createDefaultMetadata([
    { key: 'brand', label: 'Brand', type: 'text', required: true, placeholder: 'e.g., Samsung, LG' },
    { key: 'fridgeType', label: 'Fridge Type', type: 'select', options: ['Single Door', 'Double Door', 'Side-by-Side', 'French Door'] },
    { key: 'issue', label: 'Issue', type: 'textarea', required: true, placeholder: 'Describe the problem' },
  ]),
  'microwave-repair': createDefaultMetadata([
    { key: 'brand', label: 'Brand', type: 'text', required: true },
    { key: 'issue', label: 'Issue', type: 'textarea', required: true, placeholder: 'e.g., not heating, sparking' },
  ]),

  // Cleaning & Pest Control
  'full-home-deep-cleaning': createDefaultMetadata([
    { key: 'propertyType', label: 'Property Type', type: 'select', required: true, options: ['Apartment', 'Villa', 'Bungalow', 'Office'] },
    { key: 'rooms', label: 'Number of Rooms', type: 'number', required: true, placeholder: 'e.g., 2' },
    { key: 'bathrooms', label: 'Number of Bathrooms', type: 'number', required: true },
    { key: 'isDeepClean', label: 'Deep Clean', type: 'boolean' },
    { key: 'includesKitchen', label: 'Includes Kitchen', type: 'boolean' },
    { key: 'includesBalcony', label: 'Includes Balcony', type: 'boolean' },
  ]),
  'bathroom-deep-cleaning': createDefaultMetadata([
    { key: 'bathrooms', label: 'Number of Bathrooms', type: 'number', required: true },
    { key: 'scrubbing', label: 'Scrubbing Required', type: 'boolean' },
  ]),
  'sofa-carpet-cleaning': createDefaultMetadata([
    { key: 'itemType', label: 'Item Type', type: 'select', required: true, options: ['Sofa', 'Carpet', 'Mattress', 'Curtains'] },
    { key: 'fabricType', label: 'Fabric Type', type: 'select', options: ['Cotton', 'Leather', 'Synthetic', 'Wool'] },
    { key: 'serviceType', label: 'Service Type', type: 'select', required: true, options: ['Shampooing', 'Dry Cleaning', 'Steam Cleaning'] },
  ]),
  'pest-control': createDefaultMetadata([
    { key: 'pestType', label: 'Pest Type', type: 'select', required: true, options: ['Cockroach', 'Ant', 'Termite', 'Bed Bug', 'Rodent'] },
    { key: 'propertyType', label: 'Property Type', type: 'select', options: ['Apartment', 'Villa', 'Office', 'Shop'] },
    { key: 'rooms', label: 'Number of Rooms', type: 'number', required: true },
    { key: 'severity', label: 'Severity', type: 'select', options: ['Low', 'Medium', 'High', 'Critical'] },
  ]),
  'termite-treatment': createDefaultMetadata([
    { key: 'propertyType', label: 'Property Type', type: 'select', options: ['Apartment', 'Villa', 'Office'] },
    { key: 'affectedAreas', label: 'Affected Areas', type: 'textarea', placeholder: 'e.g., wooden frames, furniture' },
  ]),

  // Home Repairs & Handyman
  electrician: createDefaultMetadata([
    { key: 'serviceType', label: 'Service Type', type: 'select', required: true, options: ['Switchboard Repair', 'Socket Replacement', 'Fan Installation', 'Light Installation', 'Short Circuit', 'Wiring Work'] },
    { key: 'issueDescription', label: 'Issue Description', type: 'textarea', required: true, placeholder: 'Describe the issue' },
  ]),
  plumber: createDefaultMetadata([
    { key: 'serviceType', label: 'Service Type', type: 'select', required: true, options: ['Tap Repair', 'Flush Tank Fix', 'Jet Spray Installation', 'Sink Blockage', 'Water Pump Installation', 'Pipe Leakage'] },
    { key: 'issueDescription', label: 'Issue Description', type: 'textarea', required: true, placeholder: 'Describe the issue' },
  ]),
  carpenter: createDefaultMetadata([
    { key: 'serviceType', label: 'Service Type', type: 'select', required: true, options: ['Furniture Assembly', 'Door Lock Installation', 'Drawer Repair', 'Custom Woodwork', 'Cabinet Repair'] },
    { key: 'issueDescription', label: 'Work Description', type: 'textarea', required: true, placeholder: 'Describe the work needed' },
  ]),

  // Renovations
  'interior-painting': createDefaultMetadata([
    { key: 'propertyType', label: 'Property Type', type: 'select', required: true, options: ['Apartment', 'Villa', 'Office'] },
    { key: 'rooms', label: 'Number of Rooms', type: 'number', required: true },
    { key: 'area', label: 'Area (sq ft)', type: 'number', required: true },
    { key: 'paintType', label: 'Paint Type', type: 'select', options: ['Emulsion', 'Distemper', 'Enamel', 'Texture'] },
    { key: 'finishType', label: 'Finish Type', type: 'select', options: ['Matt', 'Satin', 'Gloss', 'Eggshell'] },
  ]),
  waterproofing: createDefaultMetadata([
    { key: 'location', label: 'Location', type: 'select', required: true, options: ['Balcony', 'Terrace', 'Bathroom', 'Basement', 'Roof'] },
    { key: 'area', label: 'Area (sq ft)', type: 'number', required: true },
    { key: 'issueType', label: 'Issue Type', type: 'select', options: ['Leakage', 'Dampness', 'Cracks', 'Seepage'] },
    { key: 'surfaceType', label: 'Surface Type', type: 'select', options: ['Concrete', 'Tiled', 'Metal', 'Wood'] },
  ]),
  'wall-paneling': createDefaultMetadata([
    { key: 'material', label: 'Material', type: 'select', required: true, options: ['PVC Panel', 'Wood Panel', 'Wallpaper', 'Fabric Panel', 'Glass Panel'] },
    { key: 'area', label: 'Area (sq ft)', type: 'number', required: true },
    { key: 'room', label: 'Room', type: 'select', options: ['Living Room', 'Bedroom', 'Kitchen', 'Bathroom', 'Office'] },
    { key: 'includesInstallation', label: 'Include Installation', type: 'boolean' },
    { key: 'customDesign', label: 'Custom Design', type: 'boolean' },
  ]),

  // Transport
  'railway-cooli': createDefaultMetadata([
    { key: 'trainNumber', label: 'Train Number', type: 'text', required: true, placeholder: 'e.g., 12345' },
    { key: 'coachNumber', label: 'Coach Number', type: 'text', required: true, placeholder: 'e.g., S1, A2' },
    { key: 'seatNumber', label: 'Seat Number', type: 'text', placeholder: 'e.g., 22' },
    { key: 'passengerName', label: 'Passenger Name', type: 'text' },
    { key: 'luggageWeight', label: 'Luggage Weight (kg)', type: 'number' },
    { key: 'luggageItems', label: 'Number of Items', type: 'number', required: true },
    { key: 'station', label: 'Station Name', type: 'text', required: true },
    { key: 'platform', label: 'Platform Number', type: 'text' },
  ]),
  'bus-terminal-service': createDefaultMetadata([
    { key: 'busNumber', label: 'Bus Number', type: 'text', required: true },
    { key: 'route', label: 'Route', type: 'text' },
    { key: 'terminal', label: 'Terminal / Stop', type: 'text', required: true },
    { key: 'luggageWeight', label: 'Luggage Weight (kg)', type: 'number' },
    { key: 'luggageItems', label: 'Number of Items', type: 'number', required: true },
    { key: 'passengerName', label: 'Passenger Name', type: 'text' },
  ]),
  'mandi-loading': createDefaultMetadata([
    { key: 'marketName', label: 'Market Name', type: 'text', required: true },
    { key: 'commodityType', label: 'Commodity Type', type: 'text', required: true },
    { key: 'quantity', label: 'Quantity', type: 'number', required: true },
    { key: 'unit', label: 'Unit', type: 'select', options: ['Sacks', 'Crates', 'Boxes', 'Pieces', 'Kilograms'] },
    { key: 'vehicleRequired', label: 'Vehicle Required (Thela/Cart)', type: 'boolean' },
  ]),

  // Warehousing
  'freight-unloading': createDefaultMetadata([
    { key: 'containerType', label: 'Container Type', type: 'select', options: ['Standard', 'Reefer', 'Open Top', 'Flat Rack'] },
    { key: 'weight', label: 'Weight (kg)', type: 'number', required: true },
    { key: 'pallets', label: 'Number of Pallets', type: 'number' },
  ]),
  'pallet-stacking': createDefaultMetadata([
    { key: 'pallets', label: 'Number of Pallets', type: 'number', required: true },
    { key: 'height', label: 'Stack Height (meters)', type: 'number' },
  ]),
  'loading-service': createDefaultMetadata([
    { key: 'vehicleType', label: 'Vehicle Type', type: 'text', required: true },
    { key: 'weight', label: 'Total Weight (kg)', type: 'number', required: true },
  ]),

  // Construction
  'material-shifting': createDefaultMetadata([
    { key: 'materialType', label: 'Material Type', type: 'select', required: true, options: ['Cement', 'Bricks', 'Sand', 'Steel', 'Wood', 'Tiles'] },
    { key: 'quantity', label: 'Quantity', type: 'number', required: true },
    { key: 'unit', label: 'Unit', type: 'select', options: ['Sacks', 'Bags', 'Pieces', 'Kilograms', 'Tons'] },
    { key: 'sourceFloor', label: 'Source Floor', type: 'text' },
    { key: 'destinationFloor', label: 'Destination Floor', type: 'text' },
    { key: 'requiresLift', label: 'Requires Lift/Elevator', type: 'boolean' },
  ]),
  'masonry-work': createDefaultMetadata([
    { key: 'workType', label: 'Work Type', type: 'select', required: true, options: ['Brickwork', 'Plastering', 'Tiling', 'Foundation', 'Retaining Wall'] },
    { key: 'area', label: 'Area (sq ft)', type: 'number', required: true },
    { key: 'walls', label: 'Number of Walls', type: 'number' },
    { key: 'material', label: 'Material', type: 'select', options: ['Brick', 'Concrete Block', 'Stone', 'Tile', 'Marble'] },
    { key: 'includesPlastering', label: 'Includes Plastering', type: 'boolean' },
    { key: 'includesTiling', label: 'Includes Tiling', type: 'boolean' },
  ]),
  demolition: createDefaultMetadata([
    { key: 'structureType', label: 'Structure Type', type: 'select', required: true, options: ['Wall', 'Ceiling', 'Partition', 'Balcony', 'Floor', 'Foundation'] },
    { key: 'area', label: 'Area (sq ft)', type: 'number', required: true },
    { key: 'includesDebrisRemoval', label: 'Include Debris Removal', type: 'boolean' },
    { key: 'includesSafetyMeasures', label: 'Include Safety Measures', type: 'boolean' },
  ]),

  // Moving
  'household-shifting': createDefaultMetadata([
    { key: 'propertyType', label: 'Property Type', type: 'select', options: ['Apartment', 'Villa', 'Bungalow', 'House'] },
    { key: 'rooms', label: 'Number of Rooms', type: 'number', required: true },
    { key: 'furniture', label: 'Furniture Items (comma separated)', type: 'textarea', placeholder: 'e.g., Beds, Sofa, Wardrobe' },
    { key: 'appliances', label: 'Appliances (comma separated)', type: 'textarea', placeholder: 'e.g., Fridge, Washing Machine' },
    { key: 'originAddress', label: 'Origin Address', type: 'textarea', required: true },
    { key: 'destinationAddress', label: 'Destination Address', type: 'textarea', required: true },
  ]),
  'furniture-moving': createDefaultMetadata([
    { key: 'items', label: 'Items (comma separated)', type: 'textarea', required: true },
    { key: 'originAddress', label: 'Origin Address', type: 'textarea', required: true },
    { key: 'destinationAddress', label: 'Destination Address', type: 'textarea', required: true },
  ]),
  'appliance-moving': createDefaultMetadata([
    { key: 'appliances', label: 'Appliances (comma separated)', type: 'textarea', required: true },
    { key: 'originAddress', label: 'Origin Address', type: 'textarea', required: true },
    { key: 'destinationAddress', label: 'Destination Address', type: 'textarea', required: true },
  ]),

  // Sewage
  'pipeline-cleaning': createDefaultMetadata([
    { key: 'location', label: 'Location', type: 'select', required: true, options: ['Kitchen', 'Bathroom', 'Toilet', 'Outdoor Drain', 'Basement'] },
    { key: 'blockageType', label: 'Blockage Type', type: 'select', options: ['Grease', 'Hair', 'Solid Waste', 'Root Intrusion', 'Unknown'] },
    { key: 'serviceType', label: 'Service Type', type: 'select', options: ['Pipeline Cleaning', 'Septic Tank', 'Manhole', 'Root Removal', 'Inspection'] },
  ]),
  'septic-tank-cleaning': createDefaultMetadata([
    { key: 'tankSize', label: 'Tank Size (liters)', type: 'number', required: true },
    { key: 'accessibility', label: 'Accessibility', type: 'select', options: ['Easy', 'Moderate', 'Difficult'] },
  ]),
  'manhole-maintenance': createDefaultMetadata([
    { key: 'depth', label: 'Depth (meters)', type: 'number', required: true },
    { key: 'condition', label: 'Condition', type: 'select', options: ['Good', 'Fair', 'Poor'] },
  ]),

  // Gardening
  landscaping: createDefaultMetadata([
    { key: 'serviceType', label: 'Service Type', type: 'select', required: true, options: ['Lawn Installation', 'Balcony Garden', 'Kitchen Garden', 'Vertical Garden', 'Flower Bed'] },
    { key: 'area', label: 'Area (sq ft)', type: 'number', required: true },
    { key: 'plants', label: 'Plants (comma separated)', type: 'textarea', placeholder: 'e.g., Flowers, Shrubs, Herbs' },
    { key: 'includesIrrigation', label: 'Include Drip/Sprinkler Irrigation', type: 'boolean' },
  ]),
  'plant-care': createDefaultMetadata([
    { key: 'serviceType', label: 'Service Type', type: 'select', required: true, options: ['Pruning', 'Weeding', 'Mowing', 'Soil Care', 'Watering', 'Fertilizing'] },
    { key: 'plantCount', label: 'Number of Plants / Area', type: 'text', required: true },
    { key: 'issueType', label: 'Issue Type', type: 'select', options: ['Overgrown', 'Weeds', 'Yellowing', 'Pests', 'Fungal', 'General Maintenance'] },
    { key: 'includesPestControl', label: 'Include Pest Control', type: 'boolean' },
  ]),
  'pest-control-garden': createDefaultMetadata([
    { key: 'plantType', label: 'Plant Type', type: 'text', required: true },
    { key: 'pestType', label: 'Pest Type', type: 'select', options: ['Aphids', 'Mealybugs', 'Fungal', 'Other'] },
    { key: 'area', label: 'Area (sq ft)', type: 'number', required: true },
  ]),

  // Farming
  'land-preparation': createDefaultMetadata([
    { key: 'fieldSize', label: 'Field Size (acres)', type: 'number', required: true },
    { key: 'cropType', label: 'Crop Type', type: 'text', required: true },
    { key: 'soilType', label: 'Soil Type', type: 'select', options: ['Loamy', 'Sandy', 'Clay', 'Silt', 'Peaty'] },
    { key: 'equipment', label: 'Equipment Required', type: 'select', options: ['Tractor', 'Rotavator', 'Plough', 'Harrow', 'Manual'] },
    { key: 'includesManure', label: 'Include Organic Manure', type: 'boolean' },
  ]),
  'sowing-planting': createDefaultMetadata([
    { key: 'cropType', label: 'Crop Type', type: 'text', required: true },
    { key: 'seedVariety', label: 'Seed Variety', type: 'text' },
    { key: 'sowingMethod', label: 'Sowing Method', type: 'select', options: ['Broadcast', 'Seed Drill', 'Dibbling', 'Transplanting'] },
    { key: 'area', label: 'Area (acres)', type: 'number', required: true },
    { key: 'requiresIrrigation', label: 'Requires Irrigation Setup', type: 'boolean' },
  ]),
  harvesting: createDefaultMetadata([
    { key: 'cropType', label: 'Crop Type', type: 'text', required: true },
    { key: 'area', label: 'Area (acres)', type: 'number', required: true },
    { key: 'harvestMethod', label: 'Harvest Method', type: 'select', options: ['Manual', 'Combine Harvester', 'Mechanical', 'Semi-Mechanical'] },
    { key: 'includesProcessing', label: 'Include Primary Processing (Threshing, Winnowing)', type: 'boolean' },
  ]),
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
          { name: "Waxing (Regular)", slug: "waxing-regular", description: "Standard waxing", basePrice: 299, duration: 30, image: "https://picsum.photos/seed/waxing/200/150",metadata: serviceMetadata['waxing-regular'] },
          { name: "Chocolate Waxing", slug: "chocolate-waxing", description: "Luxury chocolate wax", basePrice: 499, duration: 45, image: "https://picsum.photos/seed/chocolate-wax/200/150",metadata: serviceMetadata['chocolate-waxing'] },
          { name: "Threading", slug: "threading", description: "Eyebrow and upper lip threading", basePrice: 99, duration: 15, image: "https://picsum.photos/seed/threading/200/150",metadata: serviceMetadata['threading'] },
          { name: "Classic Facial", slug: "classic-facial", description: "Basic facial treatment", basePrice: 399, duration: 60, image: "https://picsum.photos/seed/classic-facial/200/150",metadata: serviceMetadata['classic-facial'] },
          { name: "Haircut & Styling", slug: "haircut-styling", description: "Professional haircut", basePrice: 350, duration: 30, image: "https://picsum.photos/seed/haircut/200/150",metadata: serviceMetadata['haircut-styling'] },
        ]
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
          { name: "Standard Haircut", slug: "standard-haircut", description: "Classic haircut", basePrice: 250, duration: 25, image: "https://picsum.photos/seed/men-haircut/200/150",metadata: serviceMetadata['standard-haircut'] },
          { name: "Beard Shaping", slug: "beard-shaping", description: "Professional beard trim", basePrice: 150, duration: 15, image: "https://picsum.photos/seed/beard/200/150" ,metadata: serviceMetadata['beard-shaping']},
          { name: "Clean Shave", slug: "clean-shave", description: "Hot towel shave", basePrice: 200, duration: 20, image: "https://picsum.photos/seed/shaves/200/150",metadata: serviceMetadata['clean-shave'] },
          { name: "Men's Facial", slug: "mens-facial", description: "Deep cleansing facial", basePrice: 350, duration: 45, image: "https://picsum.photos/seed/mens-facial/200/150",metadata: serviceMetadata['mens-facial'] },
          { name: "Stress Relief Massage", slug: "stress-relief-massage", description: "Full body massage", basePrice: 600, duration: 60, image: "https://picsum.photos/seed/massage/200/150",metadata: serviceMetadata['stress-relief-massage'] },
        ]
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
          { name: "AC Repair", slug: "ac-repair", description: "AC cooling and gas filling", basePrice: 499, duration: 60, image: "https://picsum.photos/seed/ac-repair/200/150",metadata: serviceMetadata['stress-relief-massage'] },
          { name: "RO Service", slug: "ro-service", description: "Filter replacement and TDS check", basePrice: 399, duration: 45, image: "https://picsum.photos/seed/ro-service/200/150",metadata: serviceMetadata['ro-service'] },
          { name: "Washing Machine Repair", slug: "washing-machine-repair", description: "Motor and drum repair", basePrice: 449, duration: 60, image: "https://picsum.photos/seed/washing-machine/200/150",metadata: serviceMetadata['washing-machine-repair'] },
          { name: "Refrigerator Repair", slug: "refrigerator-repair", description: "Cooling and compressor fix", basePrice: 499, duration: 60, image: "https://picsum.photos/seed/refrigerator/200/150",metadata: serviceMetadata['refrigerator-repair'] },
          { name: "Microwave Repair", slug: "microwave-repair", description: "Heating and electrical fix", basePrice: 399, duration: 45, image: "https://picsum.photos/seed/microwave/200/150",metadata: serviceMetadata['microwave-repair'] },
        ]
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
          { name: "Full Home Deep Cleaning", slug: "full-home-deep-cleaning", description: "Complete house cleaning", basePrice: 999, duration: 180, image: "https://picsum.photos/seed/deep-clean/200/150",metadata: serviceMetadata['full-home-deep-cleaning'] },
          { name: "Bathroom Deep Cleaning", slug: "bathroom-deep-cleaning", description: "Scrubbing and sanitization", basePrice: 299, duration: 60, image: "https://picsum.photos/seed/bathroom-clean/200/150",metadata: serviceMetadata['bathroom-deep-cleaning'] },
          { name: "Sofa & Carpet Cleaning", slug: "sofa-carpet-cleaning", description: "Shampooing and steam cleaning", basePrice: 499, duration: 90, image: "https://picsum.photos/seed/sofa-clean/200/150",metadata: serviceMetadata['sofa-carpet-cleaning'] },
          { name: "Pest Control", slug: "pest-control", description: "Cockroach and ant control", basePrice: 599, duration: 60, image: "https://picsum.photos/seed/pest-control/200/150",metadata: serviceMetadata['pest-control'] },
          { name: "Termite Treatment", slug: "termite-treatment", description: "Termite removal and prevention", basePrice: 799, duration: 90, image: "https://picsum.photos/seed/termite/200/150",metadata: serviceMetadata['termite-treatment'] },
        ]
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
          { name: "Electrician", slug: "electrician", description: "Switchboard, socket, fan", basePrice: 349, duration: 60, image: "https://picsum.photos/seed/electrician/200/150",metadata: serviceMetadata['electrician'] },
          { name: "Plumber", slug: "plumber", description: "Tap, flush, pipe repair", basePrice: 349, duration: 60, image: "https://picsum.photos/seed/plumber/200/150",metadata: serviceMetadata['plumber'] },
          { name: "Carpenter", slug: "carpenter", description: "Furniture repair and assembly", basePrice: 399, duration: 60, image: "https://picsum.photos/seed/carpenter/200/150",metadata: serviceMetadata['carpenter'] },
        ]
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
          { name: "Interior Painting", slug: "interior-painting", description: "Room painting", basePrice: 1499, duration: 120, image: "https://picsum.photos/seed/painting/200/150",metadata: serviceMetadata['interior-painting'] },
          { name: "Waterproofing", slug: "waterproofing", description: "Terrace and balcony sealing", basePrice: 999, duration: 90, image: "https://picsum.photos/seed/waterproof/200/150",metadata: serviceMetadata['waterproofing'] },
          { name: "Wall Paneling", slug: "wall-paneling", description: "PVC and wood panel installation", basePrice: 1299, duration: 120, image: "https://picsum.photos/seed/paneling/200/150",metadata: serviceMetadata['wall-paneling'] },
        ]
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
          { name: "Railway Cooli", slug: "railway-cooli", description: "Luggage assistance at station", basePrice: 199, duration: 30, image: "https://picsum.photos/seed/railway/200/150",metadata: serviceMetadata['railway-cooli'] },
          { name: "Bus Terminal Service", slug: "bus-terminal-service", description: "Luggage loading at bus stop", basePrice: 149, duration: 20, image: "https://picsum.photos/seed/bus/200/150",metadata: serviceMetadata['bus-terminal-service'] },
          { name: "Mandi Loading", slug: "mandi-loading", description: "Loading/unloading goods in market", basePrice: 299, duration: 45, image: "https://picsum.photos/seed/mandi/200/150",metadata: serviceMetadata['mandi-loading'] },
        ]
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
          { name: "Freight Unloading", slug: "freight-unloading", description: "Container unloading", basePrice: 499, duration: 60, image: "https://picsum.photos/seed/freight/200/150",metadata: serviceMetadata['freight-unloading'] },
          { name: "Pallet Stacking", slug: "pallet-stacking", description: "Stacking and organizing", basePrice: 399, duration: 45, image: "https://picsum.photos/seed/pallet/200/150",metadata: serviceMetadata['pallet-stacking'] },
          { name: "Loading Service", slug: "loading-service", description: "Loading delivery vehicles", basePrice: 449, duration: 60, image: "https://picsum.photos/seed/loading/200/150",metadata: serviceMetadata['loading-service'] },
        ]
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
          { name: "Material Shifting", slug: "material-shifting", description: "Moving construction materials", basePrice: 499, duration: 60, image: "https://picsum.photos/seed/material/200/150",metadata: serviceMetadata['material-shifting'] },
          { name: "Masonry Work", slug: "masonry-work", description: "Brickwork and plastering", basePrice: 599, duration: 90, image: "https://picsum.photos/seed/masonry/200/150",metadata: serviceMetadata['masonry-work'] },
          { name: "Demolition", slug: "demolition", description: "Wall and structure demolition", basePrice: 699, duration: 60, image: "https://picsum.photos/seed/demolition/200/150",metadata: serviceMetadata['demolition'] },
        ]
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
          { name: "Household Shifting", slug: "household-shifting", description: "Moving home goods", basePrice: 999, duration: 120, image: "https://picsum.photos/seed/household/200/150",metadata: serviceMetadata['household-shifting'] },
          { name: "Furniture Moving", slug: "furniture-moving", description: "Furniture relocation", basePrice: 499, duration: 60, image: "https://picsum.photos/seed/furniture/200/150",metadata: serviceMetadata['furniture-moving'] },
          { name: "Appliance Moving", slug: "appliance-moving", description: "Fridge, washing machine", basePrice: 399, duration: 45, image: "https://picsum.photos/seed/appliance-move/200/150",metadata: serviceMetadata['appliance-moving'] },
        ]
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
          { name: "Pipeline Cleaning", slug: "pipeline-cleaning", description: "Clearing blockages", basePrice: 399, duration: 45, image: "https://picsum.photos/seed/pipeline/200/150",metadata: serviceMetadata['pipeline-cleaning'] },
          { name: "Septic Tank Cleaning", slug: "septic-tank-cleaning", description: "Desludging septic tank", basePrice: 599, duration: 60, image: "https://picsum.photos/seed/septic/200/150",metadata: serviceMetadata['septic-tank-cleaning'] },
          { name: "Manhole Maintenance", slug: "manhole-maintenance", description: "Cleaning and repair", basePrice: 499, duration: 45, image: "https://picsum.photos/seed/manhole/200/150",metadata: serviceMetadata['manhole-maintenance'] },
        ]
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
          { name: "Landscaping", slug: "landscaping", description: "Garden design and setup", basePrice: 799, duration: 90, image: "https://picsum.photos/seed/landscaping/200/150",metadata: serviceMetadata['landscaping'] },
          { name: "Plant Care", slug: "plant-care", description: "Pruning, watering, fertilizing", basePrice: 399, duration: 60, image: "https://picsum.photos/seed/plant-care/200/150",metadata: serviceMetadata['plant-care'] },
          { name: "Pest Control (Garden)", slug: "pest-control-garden", description: "Plant pest management", basePrice: 499, duration: 45, image: "https://picsum.photos/seed/garden-pest/200/150",metadata: serviceMetadata['pest-control-garden'] },
        ]
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
          { name: "Land Preparation", slug: "land-preparation", description: "Ploughing and tilling", basePrice: 999, duration: 120, image: "https://picsum.photos/seed/land-prep/200/150",metadata: serviceMetadata['land-preparation'] },
          { name: "Sowing & Planting", slug: "sowing-planting", description: "Seed sowing and transplanting", basePrice: 799, duration: 90, image: "https://picsum.photos/seed/sowing/200/150",metadata: serviceMetadata['sowing-planting'] },
          { name: "Harvesting", slug: "harvesting", description: "Crop harvesting and processing", basePrice: 899, duration: 120, image: "https://picsum.photos/seed/harvest/200/150",metadata: serviceMetadata['harvesting'] },
        ]
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
            metadata:serviceData.metadata,
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
    global.io = io;
    console.log(`🔌 WebSocket server initialized`);
  })
  .catch((err) => {
    console.error('❌ Database connection failed:', err);
  });