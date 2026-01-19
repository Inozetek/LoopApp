/**
 * Direct API Integration Test Script
 * Tests Ticketmaster and Eventbrite APIs with real requests
 *
 * Run with: node scripts/test-api-integrations.js
 */

require('dotenv').config();

const TICKETMASTER_API_KEY = process.env.EXPO_PUBLIC_TICKETMASTER_API_KEY;
const EVENTBRITE_API_KEY = process.env.EXPO_PUBLIC_EVENTBRITE_API_KEY;
const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

// Test location: Dallas, TX
const TEST_LOCATION = {
  latitude: 32.7767,
  longitude: -96.7970,
  city: 'Dallas, TX'
};

// Test user personas with different interests
const TEST_PERSONAS = [
  {
    name: 'Sarah - Young Professional',
    age: 28,
    interests: ['dining', 'live_music', 'fitness', 'bars', 'coffee'],
    description: 'Works downtown, active social life, loves trying new restaurants and going to concerts'
  },
  {
    name: 'Mike - Sports Fan Dad',
    age: 42,
    interests: ['sports', 'family', 'outdoor', 'dining', 'entertainment'],
    description: 'Married with kids, loves taking family to games and outdoor activities'
  },
  {
    name: 'Emma - Culture Enthusiast',
    age: 35,
    interests: ['arts', 'theater', 'museums', 'dining', 'wellness'],
    description: 'Appreciates fine arts, theater, and cultural experiences'
  },
  {
    name: 'Jake - Budget Explorer',
    age: 24,
    interests: ['entertainment', 'nightlife', 'food', 'music', 'outdoor'],
    description: 'Recent grad, limited budget but wants to explore the city'
  }
];

async function testTicketmaster() {
  console.log('\n' + '='.repeat(60));
  console.log('TICKETMASTER API TEST');
  console.log('='.repeat(60));

  if (!TICKETMASTER_API_KEY || TICKETMASTER_API_KEY === 'your_key_here') {
    console.log('❌ Ticketmaster API key not configured');
    return { success: false, error: 'API key missing' };
  }

  console.log('✓ API Key configured:', TICKETMASTER_API_KEY.substring(0, 10) + '...');

  try {
    const now = new Date();
    const startDateTime = now.toISOString().split('.')[0] + 'Z';

    const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TICKETMASTER_API_KEY}&latlong=${TEST_LOCATION.latitude},${TEST_LOCATION.longitude}&radius=25&unit=miles&startDateTime=${startDateTime}&size=20&sort=date,asc`;

    console.log('\nFetching events near', TEST_LOCATION.city, '...');

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ API Error:', response.status, errorText);
      return { success: false, error: `${response.status}: ${errorText}` };
    }

    const data = await response.json();
    const events = data._embedded?.events || [];

    console.log(`✓ Found ${events.length} events`);
    console.log('\nSample Events:');

    events.slice(0, 5).forEach((event, i) => {
      const venue = event._embedded?.venues?.[0];
      const classification = event.classifications?.[0];
      const priceRange = event.priceRanges?.[0];

      console.log(`\n  ${i + 1}. ${event.name}`);
      console.log(`     📍 ${venue?.name || 'Unknown venue'}, ${venue?.city?.name || ''}`);
      console.log(`     📅 ${event.dates.start.localDate} ${event.dates.start.localTime || ''}`);
      console.log(`     🎭 ${classification?.segment?.name || 'Unknown'} > ${classification?.genre?.name || 'Unknown'}`);
      if (priceRange) {
        console.log(`     💰 $${priceRange.min} - $${priceRange.max}`);
      }
    });

    // Categorize events
    const categories = {};
    events.forEach(event => {
      const segment = event.classifications?.[0]?.segment?.name || 'Other';
      categories[segment] = (categories[segment] || 0) + 1;
    });

    console.log('\nEvent Categories:');
    Object.entries(categories).forEach(([cat, count]) => {
      console.log(`  • ${cat}: ${count} events`);
    });

    return { success: true, eventCount: events.length, categories };

  } catch (error) {
    console.log('❌ Request failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function testEventbrite() {
  console.log('\n' + '='.repeat(60));
  console.log('EVENTBRITE API TEST (Multiple Endpoints)');
  console.log('='.repeat(60));

  if (!EVENTBRITE_API_KEY || EVENTBRITE_API_KEY === 'your_key_here') {
    console.log('❌ Eventbrite API key not configured');
    return { success: false, error: 'API key missing' };
  }

  console.log('✓ API Key configured:', EVENTBRITE_API_KEY.substring(0, 10) + '...');

  const results = {
    success: false,
    endpoints_tested: [],
    working_endpoints: [],
    events_found: 0
  };

  // Test 1: Try the deprecated search endpoint (expected to fail)
  console.log('\n--- Test 1: /events/search (deprecated) ---');
  try {
    const searchUrl = `https://www.eventbriteapi.com/v3/events/search/?location.latitude=${TEST_LOCATION.latitude}&location.longitude=${TEST_LOCATION.longitude}&location.within=25mi`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${EVENTBRITE_API_KEY}` }
    });
    const searchData = await searchRes.json();
    results.endpoints_tested.push('/events/search');
    if (searchRes.ok) {
      console.log('✓ /events/search works! Events:', searchData.events?.length || 0);
      results.working_endpoints.push('/events/search');
      results.events_found += searchData.events?.length || 0;
    } else {
      console.log('❌ /events/search:', searchData.error_description || searchRes.status);
    }
  } catch (e) {
    console.log('❌ /events/search failed:', e.message);
  }

  // Test 2: Try categories endpoint
  console.log('\n--- Test 2: /categories ---');
  try {
    const catRes = await fetch('https://www.eventbriteapi.com/v3/categories/', {
      headers: { 'Authorization': `Bearer ${EVENTBRITE_API_KEY}` }
    });
    const catData = await catRes.json();
    results.endpoints_tested.push('/categories');
    if (catRes.ok && catData.categories) {
      console.log('✓ /categories works! Found', catData.categories.length, 'categories');
      results.working_endpoints.push('/categories');
      console.log('   Sample categories:', catData.categories.slice(0, 5).map(c => c.name).join(', '));
    } else {
      console.log('❌ /categories:', catData.error_description || catRes.status);
    }
  } catch (e) {
    console.log('❌ /categories failed:', e.message);
  }

  // Test 3: Try formats endpoint
  console.log('\n--- Test 3: /formats ---');
  try {
    const fmtRes = await fetch('https://www.eventbriteapi.com/v3/formats/', {
      headers: { 'Authorization': `Bearer ${EVENTBRITE_API_KEY}` }
    });
    const fmtData = await fmtRes.json();
    results.endpoints_tested.push('/formats');
    if (fmtRes.ok && fmtData.formats) {
      console.log('✓ /formats works! Found', fmtData.formats.length, 'formats');
      results.working_endpoints.push('/formats');
      console.log('   Formats:', fmtData.formats.map(f => f.name).join(', '));
    } else {
      console.log('❌ /formats:', fmtData.error_description || fmtRes.status);
    }
  } catch (e) {
    console.log('❌ /formats failed:', e.message);
  }

  // Test 4: Try user's organizations (to find events via organization)
  console.log('\n--- Test 4: /users/me/organizations ---');
  try {
    const orgRes = await fetch('https://www.eventbriteapi.com/v3/users/me/organizations/', {
      headers: { 'Authorization': `Bearer ${EVENTBRITE_API_KEY}` }
    });
    const orgData = await orgRes.json();
    results.endpoints_tested.push('/users/me/organizations');
    if (orgRes.ok && orgData.organizations) {
      console.log('✓ /users/me/organizations works! Found', orgData.organizations.length, 'orgs');
      results.working_endpoints.push('/users/me/organizations');

      // If we have organizations, try to get their events
      if (orgData.organizations.length > 0) {
        const orgId = orgData.organizations[0].id;
        console.log('   Testing events for org:', orgId);
        const eventsRes = await fetch(`https://www.eventbriteapi.com/v3/organizations/${orgId}/events/`, {
          headers: { 'Authorization': `Bearer ${EVENTBRITE_API_KEY}` }
        });
        if (eventsRes.ok) {
          const eventsData = await eventsRes.json();
          console.log('   ✓ Org events endpoint works! Events:', eventsData.events?.length || 0);
          results.working_endpoints.push('/organizations/:id/events');
        }
      }
    } else {
      console.log('❌ /users/me/organizations:', orgData.error_description || orgRes.status);
    }
  } catch (e) {
    console.log('❌ /users/me/organizations failed:', e.message);
  }

  // Test 5: Try destination/browse endpoint (internal API)
  console.log('\n--- Test 5: /destination/search (internal API) ---');
  try {
    const destParams = new URLSearchParams({
      'page_size': '20',
      'place': 'Dallas',
      'dates': 'this_week'
    });
    const destRes = await fetch(`https://www.eventbriteapi.com/v3/destination/search/?${destParams}`, {
      headers: { 'Authorization': `Bearer ${EVENTBRITE_API_KEY}` }
    });
    const destData = await destRes.json();
    results.endpoints_tested.push('/destination/search');
    if (destRes.ok && destData.events) {
      console.log('✓ /destination/search works! Events:', destData.events?.events?.length || 0);
      results.working_endpoints.push('/destination/search');
      results.events_found += destData.events?.events?.length || 0;
    } else {
      console.log('❌ /destination/search:', destData.error_description || destRes.status);
    }
  } catch (e) {
    console.log('❌ /destination/search failed:', e.message);
  }

  // Test 6: Try venue search
  console.log('\n--- Test 6: /venues/search ---');
  try {
    const venueRes = await fetch(`https://www.eventbriteapi.com/v3/venues/search/?location.latitude=${TEST_LOCATION.latitude}&location.longitude=${TEST_LOCATION.longitude}&location.within=25mi`, {
      headers: { 'Authorization': `Bearer ${EVENTBRITE_API_KEY}` }
    });
    const venueData = await venueRes.json();
    results.endpoints_tested.push('/venues/search');
    if (venueRes.ok && venueData.venues) {
      console.log('✓ /venues/search works! Venues:', venueData.venues.length);
      results.working_endpoints.push('/venues/search');
    } else {
      console.log('❌ /venues/search:', venueData.error_description || venueRes.status);
    }
  } catch (e) {
    console.log('❌ /venues/search failed:', e.message);
  }

  // Summary
  console.log('\n' + '-'.repeat(60));
  console.log('EVENTBRITE ENDPOINT SUMMARY:');
  console.log(`  Tested: ${results.endpoints_tested.length} endpoints`);
  console.log(`  Working: ${results.working_endpoints.length}`);
  if (results.working_endpoints.length > 0) {
    console.log(`  Working endpoints: ${results.working_endpoints.join(', ')}`);
    results.success = true;
  }

  return results;
}

async function testGooglePlaces() {
  console.log('\n' + '='.repeat(60));
  console.log('GOOGLE PLACES API (NEW) TEST');
  console.log('='.repeat(60));

  if (!GOOGLE_PLACES_API_KEY || GOOGLE_PLACES_API_KEY === 'your_key_here') {
    console.log('❌ Google Places API key not configured');
    return { success: false, error: 'API key missing' };
  }

  console.log('✓ API Key configured:', GOOGLE_PLACES_API_KEY.substring(0, 10) + '...');

  try {
    // NEW API uses POST with JSON body
    const requestBody = {
      includedTypes: ['restaurant', 'cafe', 'bar', 'museum', 'park', 'gym'],
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: {
            latitude: TEST_LOCATION.latitude,
            longitude: TEST_LOCATION.longitude,
          },
          radius: 8000,
        },
      },
    };

    console.log('\nFetching places near', TEST_LOCATION.city, '(NEW API)...');

    const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.types,places.editorialSummary',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.log('❌ API Error:', response.status, data.error?.message || JSON.stringify(data));
      return { success: false, error: `${response.status}: ${data.error?.message}` };
    }

    const places = data.places || [];

    console.log(`✓ Found ${places.length} places`);
    console.log('\nSample Places:');

    places.slice(0, 5).forEach((place, i) => {
      const priceMap = {
        'PRICE_LEVEL_FREE': '$',
        'PRICE_LEVEL_INEXPENSIVE': '$',
        'PRICE_LEVEL_MODERATE': '$$',
        'PRICE_LEVEL_EXPENSIVE': '$$$',
        'PRICE_LEVEL_VERY_EXPENSIVE': '$$$$',
      };
      console.log(`\n  ${i + 1}. ${place.displayName?.text || 'Unknown'}`);
      console.log(`     📍 ${place.formattedAddress || 'No address'}`);
      console.log(`     ⭐ ${place.rating || 'No rating'} (${place.userRatingCount || 0} reviews)`);
      console.log(`     💰 ${priceMap[place.priceLevel] || 'N/A'}`);
      console.log(`     🏷️  ${place.types?.slice(0, 3).join(', ') || 'No types'}`);
      if (place.editorialSummary?.text) {
        console.log(`     📝 ${place.editorialSummary.text.substring(0, 60)}...`);
      }
    });

    // Categorize by type
    const categories = {};
    places.forEach(place => {
      const mainType = place.types?.[0] || 'other';
      categories[mainType] = (categories[mainType] || 0) + 1;
    });

    console.log('\nPlace Types Found:');
    Object.entries(categories).forEach(([cat, count]) => {
      console.log(`  • ${cat}: ${count} places`);
    });

    return { success: true, placeCount: places.length, categories };

  } catch (error) {
    console.log('❌ Request failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function simulatePersonaExperience(persona) {
  console.log('\n' + '='.repeat(60));
  console.log(`PERSONA TEST: ${persona.name}`);
  console.log('='.repeat(60));
  console.log(`Age: ${persona.age}`);
  console.log(`Interests: ${persona.interests.join(', ')}`);
  console.log(`Profile: ${persona.description}`);
  console.log('-'.repeat(60));

  // Simulate what this persona would see
  const results = {
    persona: persona.name,
    wouldSee: {
      ticketmaster: [],
      eventbrite: [],
      googlePlaces: []
    },
    issues: [],
    suggestions: []
  };

  // Check if their interests would map to available content
  const interestMapping = {
    'dining': { google: true, eventbrite: 'Food & Drink', ticketmaster: false },
    'live_music': { google: true, eventbrite: 'Music', ticketmaster: 'Music' },
    'fitness': { google: true, eventbrite: 'Health & Wellness', ticketmaster: false },
    'bars': { google: true, eventbrite: 'Food & Drink', ticketmaster: false },
    'coffee': { google: true, eventbrite: false, ticketmaster: false },
    'sports': { google: true, eventbrite: 'Sports & Fitness', ticketmaster: 'Sports' },
    'family': { google: true, eventbrite: 'Family & Education', ticketmaster: 'Family' },
    'outdoor': { google: true, eventbrite: 'Travel & Outdoor', ticketmaster: false },
    'entertainment': { google: true, eventbrite: 'Film, Media & Entertainment', ticketmaster: 'Arts & Theatre' },
    'arts': { google: true, eventbrite: 'Performing & Visual Arts', ticketmaster: 'Arts & Theatre' },
    'theater': { google: false, eventbrite: 'Performing & Visual Arts', ticketmaster: 'Arts & Theatre' },
    'museums': { google: true, eventbrite: 'Community & Culture', ticketmaster: false },
    'wellness': { google: true, eventbrite: 'Health & Wellness', ticketmaster: false },
    'nightlife': { google: true, eventbrite: 'Music', ticketmaster: 'Music' },
    'food': { google: true, eventbrite: 'Food & Drink', ticketmaster: false },
    'music': { google: true, eventbrite: 'Music', ticketmaster: 'Music' }
  };

  let ticketmasterCoverage = 0;
  let eventbriteCoverage = 0;
  let googleCoverage = 0;

  persona.interests.forEach(interest => {
    const mapping = interestMapping[interest] || { google: false, eventbrite: false, ticketmaster: false };
    if (mapping.google) googleCoverage++;
    if (mapping.eventbrite) eventbriteCoverage++;
    if (mapping.ticketmaster) ticketmasterCoverage++;
  });

  console.log('\nInterest Coverage:');
  console.log(`  • Google Places: ${googleCoverage}/${persona.interests.length} interests covered`);
  console.log(`  • Ticketmaster: ${ticketmasterCoverage}/${persona.interests.length} interests covered`);
  console.log(`  • Eventbrite: ${eventbriteCoverage}/${persona.interests.length} interests covered`);

  // Identify gaps
  if (ticketmasterCoverage < persona.interests.length * 0.4) {
    results.issues.push(`Low Ticketmaster coverage for ${persona.name} - may see few events`);
  }

  if (persona.interests.includes('coffee') || persona.interests.includes('dining')) {
    results.suggestions.push('Google Places will be primary source for food/drink');
  }

  if (persona.interests.includes('sports') || persona.interests.includes('live_music')) {
    results.suggestions.push('Ticketmaster will provide good event coverage');
  }

  console.log('\nPotential Issues:');
  if (results.issues.length === 0) {
    console.log('  ✓ No major coverage gaps identified');
  } else {
    results.issues.forEach(issue => console.log(`  ⚠️  ${issue}`));
  }

  console.log('\nNotes:');
  results.suggestions.forEach(note => console.log(`  • ${note}`));

  return results;
}

async function runAllTests() {
  console.log('\n' + '═'.repeat(70));
  console.log('   LOOP APP - COMPREHENSIVE API & PERSONA TESTING');
  console.log('   Test Location:', TEST_LOCATION.city);
  console.log('   Run Time:', new Date().toISOString());
  console.log('═'.repeat(70));

  const results = {
    apis: {},
    personas: [],
    summary: {
      apisWorking: 0,
      apisFailed: 0,
      totalIssues: [],
      totalSuggestions: []
    }
  };

  // Test APIs
  results.apis.ticketmaster = await testTicketmaster();
  results.apis.eventbrite = await testEventbrite();
  results.apis.googlePlaces = await testGooglePlaces();

  // Count API status
  Object.values(results.apis).forEach(api => {
    if (api.success) results.summary.apisWorking++;
    else results.summary.apisFailed++;
  });

  // Test personas
  for (const persona of TEST_PERSONAS) {
    const personaResult = await simulatePersonaExperience(persona);
    results.personas.push(personaResult);
    results.summary.totalIssues.push(...personaResult.issues);
    results.summary.totalSuggestions.push(...personaResult.suggestions);
  }

  // Final summary
  console.log('\n' + '═'.repeat(70));
  console.log('   TESTING SUMMARY');
  console.log('═'.repeat(70));

  console.log('\nAPI Status:');
  console.log(`  ✓ Working: ${results.summary.apisWorking}/3`);
  console.log(`  ✗ Failed: ${results.summary.apisFailed}/3`);

  if (!results.apis.ticketmaster.success) {
    console.log('  ⚠️  Ticketmaster: ' + results.apis.ticketmaster.error);
  } else {
    console.log(`  ✓ Ticketmaster: ${results.apis.ticketmaster.eventCount} events found`);
  }

  if (!results.apis.eventbrite.success) {
    console.log('  ⚠️  Eventbrite: ' + results.apis.eventbrite.error);
  } else {
    console.log(`  ✓ Eventbrite: ${results.apis.eventbrite.qualityEvents} quality events found`);
  }

  if (!results.apis.googlePlaces.success) {
    console.log('  ⚠️  Google Places: ' + results.apis.googlePlaces.error);
  } else {
    console.log(`  ✓ Google Places: ${results.apis.googlePlaces.placeCount} places found`);
  }

  console.log('\nPersona Coverage Issues:');
  if (results.summary.totalIssues.length === 0) {
    console.log('  ✓ All personas have adequate content coverage');
  } else {
    [...new Set(results.summary.totalIssues)].forEach(issue => {
      console.log(`  ⚠️  ${issue}`);
    });
  }

  console.log('\n' + '═'.repeat(70));
  console.log('   TEST COMPLETE');
  console.log('═'.repeat(70) + '\n');

  return results;
}

// Run tests
runAllTests().catch(console.error);
