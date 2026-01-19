// Quick test of recommendation engine with real APIs
require('dotenv').config({ path: '.env.test' });

console.log('Testing Recommendation Engine...\n');

// Test 1: Check environment variables
console.log('1. Environment Check:');
console.log('  Google Places API Key:', process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ? '✓ Loaded' : '✗ Missing');
console.log('  Ticketmaster API Key:', process.env.EXPO_PUBLIC_TICKETMASTER_API_KEY ? '✓ Loaded' : '✗ Missing');
console.log('  Supabase URL:', process.env.EXPO_PUBLIC_SUPABASE_URL ? '✓ Loaded' : '✗ Missing');
console.log('');

// Test 2: Test Google Places API directly
async function testGooglePlacesAPI() {
  console.log('2. Testing Google Places API...');

  const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
  const location = { lat: 37.7749, lng: -122.4194 }; // San Francisco
  const radius = 5000;

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating',
      },
      body: JSON.stringify({
        locationRestriction: {
          circle: {
            center: { latitude: location.lat, longitude: location.lng },
            radius: radius,
          },
        },
        maxResultCount: 5,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.log('  ✗ API Error:', response.status, error);
      return false;
    }

    const data = await response.json();
    const placeCount = data.places ? data.places.length : 0;
    console.log('  ✓ Found', placeCount, 'places');
    if (data.places && data.places.length > 0) {
      const name = data.places[0].displayName ? data.places[0].displayName.text : 'Unknown';
      const rating = data.places[0].rating || 'N/A';
      console.log('  Sample:', name, '-', rating, '★');
    }
    return true;
  } catch (error) {
    console.log('  ✗ Error:', error.message);
    return false;
  }
}

// Test 3: Test Ticketmaster API
async function testTicketmasterAPI() {
  console.log('\n3. Testing Ticketmaster API...');

  const API_KEY = process.env.EXPO_PUBLIC_TICKETMASTER_API_KEY;
  const location = { lat: 37.7749, lng: -122.4194 };

  try {
    const url = 'https://app.ticketmaster.com/discovery/v2/events.json?apikey=' + API_KEY + '&latlong=' + location.lat + ',' + location.lng + '&radius=10&unit=miles&size=5';
    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.text();
      console.log('  ✗ API Error:', response.status);
      return false;
    }

    const data = await response.json();
    const events = data._embedded ? data._embedded.events : [];
    const eventCount = events ? events.length : 0;
    console.log('  ✓ Found', eventCount, 'events');
    if (eventCount > 0) {
      const event = events[0];
      const venue = event._embedded && event._embedded.venues ? event._embedded.venues[0].name : 'Unknown venue';
      console.log('  Sample:', event.name, '-', venue);
    }
    return true;
  } catch (error) {
    console.log('  ✗ Error:', error.message);
    return false;
  }
}

// Run tests
(async () => {
  const googleOk = await testGooglePlacesAPI();
  const ticketmasterOk = await testTicketmasterAPI();

  console.log('\n📊 RESULTS:');
  console.log('  Google Places API:', googleOk ? '✓ PASS' : '✗ FAIL');
  console.log('  Ticketmaster API:', ticketmasterOk ? '✓ PASS' : '✗ FAIL');

  if (!googleOk || !ticketmasterOk) {
    console.log('\n⚠️  Some tests failed. Check API keys and network connection.');
    process.exit(1);
  }

  console.log('\n✅ All API tests passed!');
})();
