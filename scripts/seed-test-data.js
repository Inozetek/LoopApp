/**
 * Seed Test Data Script
 *
 * Creates dummy friends, calendar events, and moments for testing the app.
 * Run with: node scripts/seed-test-data.js
 *
 * Prerequisites:
 * - User must be logged in (has a session)
 * - Supabase credentials in .env.local
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key for admin operations
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Check .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================
// Test Data Configuration
// ============================================

const TEST_FRIENDS = [
  {
    name: 'Alex Chen',
    email: 'alex.chen.test@loop.app',
    profile_picture_url: 'https://randomuser.me/api/portraits/men/32.jpg',
    interests: ['coffee', 'hiking', 'photography'],
    loop_score: 450,
  },
  {
    name: 'Sarah Johnson',
    email: 'sarah.j.test@loop.app',
    profile_picture_url: 'https://randomuser.me/api/portraits/women/44.jpg',
    interests: ['restaurants', 'yoga', 'wine'],
    loop_score: 620,
  },
  {
    name: 'Mike Williams',
    email: 'mike.w.test@loop.app',
    profile_picture_url: 'https://randomuser.me/api/portraits/men/67.jpg',
    interests: ['sports', 'bars', 'live music'],
    loop_score: 380,
  },
  {
    name: 'Emily Davis',
    email: 'emily.d.test@loop.app',
    profile_picture_url: 'https://randomuser.me/api/portraits/women/22.jpg',
    interests: ['art', 'museums', 'brunch'],
    loop_score: 510,
  },
  {
    name: 'James Park',
    email: 'james.p.test@loop.app',
    profile_picture_url: 'https://randomuser.me/api/portraits/men/45.jpg',
    interests: ['fitness', 'outdoor activities', 'healthy food'],
    loop_score: 720,
  },
  {
    name: 'Lisa Martinez',
    email: 'lisa.m.test@loop.app',
    profile_picture_url: 'https://randomuser.me/api/portraits/women/68.jpg',
    interests: ['shopping', 'spa', 'dining'],
    loop_score: 290,
  },
  {
    name: 'David Kim',
    email: 'david.k.test@loop.app',
    profile_picture_url: null, // Test user without profile pic
    interests: ['tech', 'coffee', 'games'],
    loop_score: 180,
  },
  {
    name: 'Rachel Green',
    email: 'rachel.g.test@loop.app',
    profile_picture_url: 'https://randomuser.me/api/portraits/women/33.jpg',
    interests: ['fashion', 'cocktails', 'nightlife'],
    loop_score: 550,
  },
];

// Sample calendar events for today and this week
function generateCalendarEvents(userId) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return [
    // Today's events
    {
      user_id: userId,
      title: 'Morning Coffee at Blue Bottle',
      description: 'Quick coffee before work',
      category: 'dining',
      address: '123 Main St, Dallas, TX 75201',
      start_time: new Date(today.getTime() + 8 * 60 * 60 * 1000).toISOString(), // 8 AM
      end_time: new Date(today.getTime() + 9 * 60 * 60 * 1000).toISOString(), // 9 AM
      source: 'manual',
      status: 'scheduled',
    },
    {
      user_id: userId,
      title: 'Lunch at Uchi',
      description: 'Sushi with the team',
      category: 'dining',
      address: '2817 Maple Ave, Dallas, TX 75201',
      start_time: new Date(today.getTime() + 12 * 60 * 60 * 1000).toISOString(), // 12 PM
      end_time: new Date(today.getTime() + 13 * 60 * 60 * 1000).toISOString(), // 1 PM
      source: 'recommendation',
      status: 'scheduled',
    },
    {
      user_id: userId,
      title: 'Gym Session',
      description: 'Leg day',
      category: 'fitness',
      address: '500 Fitness Way, Dallas, TX 75201',
      start_time: new Date(today.getTime() + 18 * 60 * 60 * 1000).toISOString(), // 6 PM
      end_time: new Date(today.getTime() + 19.5 * 60 * 60 * 1000).toISOString(), // 7:30 PM
      source: 'manual',
      status: 'scheduled',
    },
    // Tomorrow's events
    {
      user_id: userId,
      title: 'Brunch at Oddfellows',
      description: 'Weekend brunch with friends',
      category: 'social',
      address: '316 W 7th St, Dallas, TX 75208',
      start_time: new Date(today.getTime() + 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000).toISOString(), // Tomorrow 10 AM
      end_time: new Date(today.getTime() + 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000).toISOString(), // Tomorrow 12 PM
      source: 'group_plan',
      status: 'scheduled',
    },
    // Past completed event
    {
      user_id: userId,
      title: 'Movie Night at Alamo Drafthouse',
      description: 'Saw the new Marvel movie',
      category: 'entertainment',
      address: '100 S Central Expy, Richardson, TX 75080',
      start_time: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000 + 19 * 60 * 60 * 1000).toISOString(), // 2 days ago 7 PM
      end_time: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000 + 22 * 60 * 60 * 1000).toISOString(), // 2 days ago 10 PM
      source: 'recommendation',
      status: 'completed',
      completed_at: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000 + 22 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

// Sample moments from friends
function generateMoments(friendUserIds) {
  const now = new Date();
  const moments = [];

  const samplePlaces = [
    { id: 'ChIJN1t_tDeuEmsRUsoyG83frY4', name: 'Blue Bottle Coffee', address: '123 Main St' },
    { id: 'ChIJrTLr-GyuEmsRBfy61i59si0', name: 'Uchi Dallas', address: '2817 Maple Ave' },
    { id: 'ChIJP3Sa8ziYEmsRUKgyFmh9AQM', name: 'Klyde Warren Park', address: '2012 Woodall Rodgers Fwy' },
    { id: 'ChIJN5Nz71WZToYRXIzce4_YT6g', name: 'Dallas Museum of Art', address: '1717 N Harwood St' },
  ];

  // Create 2-3 moments per friend (not all friends have moments)
  friendUserIds.slice(0, 5).forEach((friendId, idx) => {
    const place = samplePlaces[idx % samplePlaces.length];

    moments.push({
      user_id: friendId,
      place_id: place.id,
      place_name: place.name,
      place_address: place.address,
      photo_url: `https://source.unsplash.com/800x600/?${encodeURIComponent(place.name.split(' ')[0])}`,
      caption: ['Amazing spot!', 'Love this place', 'Great vibes here', 'Must try!', ''][idx % 5],
      visibility: 'friends',
      is_tagged_to_place: idx % 3 === 0, // Every 3rd moment is tagged to place
      expires_at: idx % 3 === 0 ? null : new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(), // 24h expiry unless tagged
      views_count: Math.floor(Math.random() * 50),
      likes_count: Math.floor(Math.random() * 20),
      capture_trigger: 'manual',
      is_active: true,
      created_at: new Date(now.getTime() - Math.floor(Math.random() * 12) * 60 * 60 * 1000).toISOString(), // Random time in last 12 hours
    });
  });

  return moments;
}

// ============================================
// Main Seeding Functions
// ============================================

async function getOrCreateTestUser(email) {
  // Check if test user exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (existingUser) {
    return existingUser.id;
  }

  // Create auth user first
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: 'TestPassword123!',
    email_confirm: true,
  });

  if (authError) {
    console.error(`Error creating auth user ${email}:`, authError.message);
    return null;
  }

  return authData.user.id;
}

async function seedTestFriends(currentUserId) {
  console.log('\n=== Seeding Test Friends ===\n');

  const friendUserIds = [];

  for (const friend of TEST_FRIENDS) {
    try {
      // Get or create the test user
      const userId = await getOrCreateTestUser(friend.email);
      if (!userId) continue;

      // Update/insert user profile
      const { error: profileError } = await supabase
        .from('users')
        .upsert({
          id: userId,
          email: friend.email,
          name: friend.name,
          profile_picture_url: friend.profile_picture_url,
          interests: friend.interests,
          loop_score: friend.loop_score,
          subscription_tier: 'free',
          subscription_status: 'active',
          account_type: 'personal',
        }, {
          onConflict: 'id',
        });

      if (profileError) {
        console.error(`Error updating profile for ${friend.name}:`, profileError.message);
        continue;
      }

      // Create friendship (bidirectional)
      const { error: friendshipError } = await supabase
        .from('friendships')
        .upsert({
          user_id: currentUserId,
          friend_id: userId,
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,friend_id',
        });

      if (friendshipError && !friendshipError.message.includes('duplicate')) {
        console.error(`Error creating friendship with ${friend.name}:`, friendshipError.message);
      }

      // Also create reverse friendship
      await supabase
        .from('friendships')
        .upsert({
          user_id: userId,
          friend_id: currentUserId,
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,friend_id',
        });

      friendUserIds.push(userId);
      console.log(`✅ Created friend: ${friend.name}`);

    } catch (err) {
      console.error(`Error seeding friend ${friend.name}:`, err.message);
    }
  }

  console.log(`\n✅ Created ${friendUserIds.length} test friends`);
  return friendUserIds;
}

async function seedCalendarEvents(userId) {
  console.log('\n=== Seeding Calendar Events ===\n');

  const events = generateCalendarEvents(userId);

  for (const event of events) {
    try {
      // Need to create a proper PostGIS point for location
      // For now, use a placeholder that the app can handle
      const eventWithLocation = {
        ...event,
        location: `POINT(-96.7970 32.7767)`, // Dallas coordinates as WKT
      };

      const { error } = await supabase
        .from('calendar_events')
        .insert(eventWithLocation);

      if (error) {
        // Try without location if PostGIS fails
        const { error: fallbackError } = await supabase
          .from('calendar_events')
          .insert({
            ...event,
            location: null,
          });

        if (fallbackError) {
          console.error(`Error creating event "${event.title}":`, fallbackError.message);
          continue;
        }
      }

      console.log(`✅ Created event: ${event.title}`);
    } catch (err) {
      console.error(`Error seeding event ${event.title}:`, err.message);
    }
  }

  console.log(`\n✅ Created ${events.length} calendar events`);
}

async function seedMoments(friendUserIds) {
  console.log('\n=== Seeding Moments ===\n');

  const moments = generateMoments(friendUserIds);

  // Check if moments table exists
  const { error: tableCheck } = await supabase
    .from('moments')
    .select('id')
    .limit(1);

  if (tableCheck && tableCheck.message?.includes('does not exist')) {
    console.log('⚠️ Moments table does not exist. Skipping moments seeding.');
    console.log('   Run migration 024_loop_moments.sql to create the table.');
    return;
  }

  for (const moment of moments) {
    try {
      const { error } = await supabase
        .from('moments')
        .insert(moment);

      if (error) {
        console.error(`Error creating moment at "${moment.place_name}":`, error.message);
        continue;
      }

      console.log(`✅ Created moment at: ${moment.place_name}`);
    } catch (err) {
      console.error(`Error seeding moment:`, err.message);
    }
  }

  console.log(`\n✅ Created ${moments.length} moments`);
}

async function getCurrentUser() {
  // Get the most recently active user (for testing)
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, name')
    .eq('account_type', 'personal')
    .order('last_login_at', { ascending: false, nullsFirst: false })
    .limit(1);

  if (error || !users || users.length === 0) {
    console.error('No users found. Please log in to the app first.');
    return null;
  }

  return users[0];
}

// ============================================
// Main Execution
// ============================================

async function main() {
  console.log('🌱 Loop Test Data Seeder');
  console.log('========================\n');

  // Get current user
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    process.exit(1);
  }

  console.log(`Seeding test data for user: ${currentUser.name} (${currentUser.email})`);

  // Seed friends
  const friendUserIds = await seedTestFriends(currentUser.id);

  // Seed calendar events
  await seedCalendarEvents(currentUser.id);

  // Seed moments from friends
  if (friendUserIds.length > 0) {
    await seedMoments(friendUserIds);
  }

  console.log('\n========================');
  console.log('✅ Test data seeding complete!');
  console.log('\nYou can now test the app with:');
  console.log(`  - ${friendUserIds.length} friends`);
  console.log('  - 5 calendar events (today, tomorrow, past)');
  console.log('  - Multiple moments from friends');
}

main().catch(console.error);
