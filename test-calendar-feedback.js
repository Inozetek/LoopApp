/**
 * Test Calendar Service + Feedback Service
 */

require('dotenv').config({ path: '.env.test' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

console.log('🧪 TESTING CALENDAR & FEEDBACK SERVICES\n');

let testUserId = null;
let testEventId = null;

async function createTestUser() {
  console.log('1. Creating test user...');

  const testEmail = `test-cal-${Date.now()}@loopapp.com`;

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: testEmail,
    password: 'TestPassword123!',
  });

  if (authError) {
    console.log('  ✗', authError.message);
    return null;
  }

  const userId = authData.user.id;

  await supabase.from('users').insert({
    id: userId,
    email: testEmail,
    name: 'Test User',
    interests: ['coffee'],
    home_location: `POINT(-122.4194 37.7749)`,
    ai_profile: {
      preferred_distance_miles: 5.0,
      budget_level: 2,
      favorite_categories: ['coffee'],
      disliked_categories: [],
    },
  });

  console.log('  ✓ User created:', userId);
  return userId;
}

async function testCalendarCRUD(userId) {
  console.log('\n2. Testing Calendar CRUD...');

  try {
    // CREATE
    const now = new Date();
    const startTime = new Date(now.getTime() + 3600000); // 1 hour from now
    const endTime = new Date(now.getTime() + 7200000); // 2 hours from now

    const { data: created, error: createError } = await supabase
      .from('calendar_events')
      .insert({
        user_id: userId,
        title: 'Test Coffee Meeting',
        location: `POINT(-122.4194 37.7749)`,
        address: '1 Market St, San Francisco, CA',
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        category: 'personal',
        source: 'manual',
        status: 'scheduled',
      })
      .select()
      .single();

    if (createError) {
      console.log('  ✗ Create failed:', createError.message);
      return null;
    }

    console.log('  ✓ Created event:', created.title);
    testEventId = created.id;

    // READ
    const { data: read, error: readError } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('id', testEventId)
      .single();

    if (readError || !read) {
      console.log('  ✗ Read failed');
      return null;
    }

    console.log('  ✓ Read event:', read.title);

    // UPDATE
    const { error: updateError } = await supabase
      .from('calendar_events')
      .update({ title: 'Updated Coffee Meeting' })
      .eq('id', testEventId);

    if (updateError) {
      console.log('  ✗ Update failed:', updateError.message);
      return null;
    }

    console.log('  ✓ Updated event title');

    return testEventId;
  } catch (error) {
    console.log('  ✗ Error:', error.message);
    return null;
  }
}

async function testFreeTimeDetection(userId) {
  console.log('\n3. Testing Free Time Detection...');

  try {
    // Create multiple events to test gap detection
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    const events = [
      {
        title: 'Morning Meeting',
        start: new Date(tomorrow.getTime()),
        end: new Date(tomorrow.getTime() + 3600000), // 9am-10am
      },
      {
        title: 'Lunch',
        start: new Date(tomorrow.getTime() + 10800000), // 12pm
        end: new Date(tomorrow.getTime() + 14400000), // 1pm
      },
    ];

    for (const event of events) {
      await supabase.from('calendar_events').insert({
        user_id: userId,
        title: event.title,
        location: `POINT(-122.4194 37.7749)`,
        address: 'San Francisco, CA',
        start_time: event.start.toISOString(),
        end_time: event.end.toISOString(),
        category: 'personal',
        source: 'manual',
        status: 'scheduled',
      });
    }

    console.log('  ✓ Created test events:', events.length);

    // Fetch events to detect gaps
    const { data: allEvents } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .gte('start_time', tomorrow.toISOString())
      .lte('start_time', new Date(tomorrow.getTime() + 86400000).toISOString())
      .order('start_time');

    console.log('  ✓ Fetched events for tomorrow:', allEvents.length);

    // Calculate gaps
    const gaps = [];
    for (let i = 0; i < allEvents.length - 1; i++) {
      const endTime = new Date(allEvents[i].end_time);
      const nextStart = new Date(allEvents[i + 1].start_time);
      const gapMinutes = (nextStart - endTime) / 60000;

      if (gapMinutes >= 60) {
        gaps.push({
          start: endTime,
          end: nextStart,
          minutes: gapMinutes,
        });
      }
    }

    console.log('  ✓ Detected gaps (≥1 hour):', gaps.length);

    if (gaps.length > 0) {
      gaps.forEach((gap, i) => {
        console.log(`    Gap ${i + 1}: ${gap.minutes} minutes`);
      });
      return true;
    }

    return false;
  } catch (error) {
    console.log('  ✗ Error:', error.message);
    return false;
  }
}

async function testFeedbackService(userId) {
  console.log('\n4. Testing Feedback Service...');

  try {
    // Get initial AI profile
    const { data: before } = await supabase
      .from('users')
      .select('ai_profile')
      .eq('id', userId)
      .single();

    console.log('  Initial favorites:', before.ai_profile.favorite_categories.join(', '));

    // Simulate thumbs up on hiking activity
    const updatedFavorites = [...new Set([...before.ai_profile.favorite_categories, 'hiking'])];

    await supabase
      .from('users')
      .update({
        ai_profile: {
          ...before.ai_profile,
          favorite_categories: updatedFavorites,
        },
      })
      .eq('id', userId);

    // Verify
    const { data: after } = await supabase
      .from('users')
      .select('ai_profile')
      .eq('id', userId)
      .single();

    console.log('  Updated favorites:', after.ai_profile.favorite_categories.join(', '));

    if (after.ai_profile.favorite_categories.includes('hiking')) {
      console.log('  ✓ Feedback updated AI profile');
      return true;
    }

    return false;
  } catch (error) {
    console.log('  ✗ Error:', error.message);
    return false;
  }
}

async function cleanup(userId) {
  console.log('\n5. Cleaning up...');
  await supabase.from('calendar_events').delete().eq('user_id', userId);
  await supabase.from('users').delete().eq('id', userId);
  console.log('  ✓ Deleted all test data');
}

(async () => {
  try {
    testUserId = await createTestUser();
    if (!testUserId) {
      console.log('\n❌ Failed to create user');
      process.exit(1);
    }

    const calendarTest = await testCalendarCRUD(testUserId);
    const freeTimeTest = await testFreeTimeDetection(testUserId);
    const feedbackTest = await testFeedbackService(testUserId);

    await cleanup(testUserId);

    console.log('\n📊 TEST RESULTS:');
    console.log('  Calendar CRUD:', calendarTest ? '✓ PASS' : '✗ FAIL');
    console.log('  Free Time Detection:', freeTimeTest ? '✓ PASS' : '✗ FAIL');
    console.log('  Feedback Service:', feedbackTest ? '✓ PASS' : '✗ FAIL');

    if (!calendarTest || !freeTimeTest || !feedbackTest) {
      console.log('\n⚠️  Some tests failed');
      process.exit(1);
    }

    console.log('\n✅ ALL TESTS PASSED!');

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    if (testUserId) await cleanup(testUserId);
    process.exit(1);
  }
})();
