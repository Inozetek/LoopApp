/**
 * Seed Script: Curated Dallas Recommendations
 * 50+ hand-picked Dallas places across all interest categories.
 *
 * Run: npx ts-node scripts/seed-curated-dallas.ts
 * (or import and call seedDallasCuratedPicks() from a migration runner)
 */

interface CuratedPick {
  place_name: string;
  place_data: {
    id: string;
    name: string;
    category: string;
    description?: string;
    location: { latitude: number; longitude: number; address: string; city: string; state: string };
    rating: number;
    reviewsCount: number;
    priceRange: number;
    googlePlaceId?: string;
    photoUrl?: string;
  };
  categories: string[];
  age_brackets: string[];
  time_of_day: string[];
  curated_explanation: string;
  priority: number;
}

const DALLAS_PICKS: CuratedPick[] = [
  // ============================================================================
  // DINING (10)
  // ============================================================================
  {
    place_name: 'Pecan Lodge',
    place_data: {
      id: 'pecan-lodge', name: 'Pecan Lodge', category: 'restaurant',
      description: 'Iconic Texas BBQ in Deep Ellum. Lines form early for a reason.',
      location: { latitude: 32.7838, longitude: -96.7846, address: '2702 Main St, Dallas, TX 75226', city: 'Dallas', state: 'TX' },
      rating: 4.6, reviewsCount: 12500, priceRange: 2,
    },
    categories: ['Dining'],
    age_brackets: ['18-24', '25-34', '35-44', '45+'],
    time_of_day: ['afternoon', 'evening'],
    curated_explanation: 'Deep Ellum legend — 4.6★ with 12K+ reviews. The brisket and hot links are worth every minute in line.',
    priority: 95,
  },
  {
    place_name: 'Uchi Dallas',
    place_data: {
      id: 'uchi-dallas', name: 'Uchi Dallas', category: 'japanese_restaurant',
      description: 'James Beard-nominated Japanese farmhouse dining with innovative sushi.',
      location: { latitude: 32.8024, longitude: -96.8038, address: '2817 Maple Ave, Dallas, TX 75201', city: 'Dallas', state: 'TX' },
      rating: 4.7, reviewsCount: 3800, priceRange: 3,
    },
    categories: ['Dining'],
    age_brackets: ['25-34', '35-44', '45+'],
    time_of_day: ['evening'],
    curated_explanation: 'James Beard-nominated sushi — 4.7★ upscale Japanese in Uptown. The wagyu sashimi is unforgettable.',
    priority: 90,
  },
  {
    place_name: 'Cane Rosso',
    place_data: {
      id: 'cane-rosso', name: 'Cane Rosso', category: 'italian_restaurant',
      description: 'Neapolitan-style pizza with a wood-fired oven and craft cocktails.',
      location: { latitude: 32.7856, longitude: -96.7836, address: '2612 Commerce St, Dallas, TX 75226', city: 'Dallas', state: 'TX' },
      rating: 4.5, reviewsCount: 5200, priceRange: 2,
    },
    categories: ['Dining'],
    age_brackets: ['18-24', '25-34', '35-44'],
    time_of_day: ['afternoon', 'evening'],
    curated_explanation: 'Deep Ellum\'s best pizza — 4.5★ wood-fired Neapolitan pies. The Honey Bastard is a must-try.',
    priority: 85,
  },
  {
    place_name: 'Loro Asian Smokehouse & Bar',
    place_data: {
      id: 'loro-dallas', name: 'Loro Asian Smokehouse & Bar', category: 'restaurant',
      description: 'Fusion of Texas BBQ and Southeast Asian flavors from Uchi and Franklin BBQ teams.',
      location: { latitude: 32.8152, longitude: -96.8022, address: '3526 Oak Lawn Ave, Dallas, TX 75219', city: 'Dallas', state: 'TX' },
      rating: 4.5, reviewsCount: 2900, priceRange: 2,
    },
    categories: ['Dining'],
    age_brackets: ['25-34', '35-44'],
    time_of_day: ['afternoon', 'evening'],
    curated_explanation: 'BBQ meets Thai from the Uchi + Franklin Barbecue teams — 4.5★. The brisket pad thai is genius.',
    priority: 88,
  },
  {
    place_name: 'Meso Maya Comida y Copas',
    place_data: {
      id: 'meso-maya', name: 'Meso Maya Comida y Copas', category: 'mexican_restaurant',
      description: 'Interior Mexican cuisine beyond Tex-Mex, with moles and chiles from Oaxaca.',
      location: { latitude: 32.7869, longitude: -96.7986, address: '1611 McKinney Ave, Dallas, TX 75202', city: 'Dallas', state: 'TX' },
      rating: 4.5, reviewsCount: 4100, priceRange: 2,
    },
    categories: ['Dining'],
    age_brackets: ['25-34', '35-44', '45+'],
    time_of_day: ['afternoon', 'evening'],
    curated_explanation: 'Interior Mexican beyond Tex-Mex — 4.5★. The mole negro and mezcal cocktails transport you to Oaxaca.',
    priority: 82,
  },
  {
    place_name: 'The Rustic',
    place_data: {
      id: 'the-rustic', name: 'The Rustic', category: 'restaurant',
      description: 'Texas comfort food with live music, a massive patio, and weekend brunch.',
      location: { latitude: 32.7989, longitude: -96.8044, address: '3656 Howell St, Dallas, TX 75204', city: 'Dallas', state: 'TX' },
      rating: 4.3, reviewsCount: 7500, priceRange: 2,
    },
    categories: ['Dining', 'Live Music'],
    age_brackets: ['18-24', '25-34', '35-44'],
    time_of_day: ['afternoon', 'evening'],
    curated_explanation: 'Live music + Texas comfort food on a huge patio — 4.3★ with 7.5K reviews. Perfect for groups.',
    priority: 80,
  },
  {
    place_name: 'Terry Black\'s Barbecue',
    place_data: {
      id: 'terry-blacks', name: 'Terry Black\'s Barbecue', category: 'restaurant',
      description: 'Austin BBQ dynasty brings legendary brisket to Deep Ellum.',
      location: { latitude: 32.7835, longitude: -96.7818, address: '3025 Main St, Dallas, TX 75226', city: 'Dallas', state: 'TX' },
      rating: 4.5, reviewsCount: 6200, priceRange: 2,
    },
    categories: ['Dining'],
    age_brackets: ['18-24', '25-34', '35-44', '45+'],
    time_of_day: ['afternoon', 'evening'],
    curated_explanation: 'Austin BBQ royalty in Deep Ellum — 4.5★ with 6K+ reviews. Brisket that rivals the original.',
    priority: 87,
  },
  {
    place_name: 'Nobu Dallas',
    place_data: {
      id: 'nobu-dallas', name: 'Nobu Dallas', category: 'japanese_restaurant',
      description: 'World-famous Japanese-Peruvian fusion in the Crescent Hotel.',
      location: { latitude: 32.7999, longitude: -96.8028, address: '400 Crescent Ct, Dallas, TX 75201', city: 'Dallas', state: 'TX' },
      rating: 4.4, reviewsCount: 2100, priceRange: 3,
    },
    categories: ['Dining'],
    age_brackets: ['25-34', '35-44', '45+'],
    time_of_day: ['evening'],
    curated_explanation: 'World-famous Japanese-Peruvian fusion — 4.4★. The black cod miso is iconic for a reason.',
    priority: 83,
  },
  {
    place_name: 'Velvet Taco',
    place_data: {
      id: 'velvet-taco', name: 'Velvet Taco', category: 'mexican_restaurant',
      description: 'Creative globally-inspired tacos with a rotating weekly taco feature.',
      location: { latitude: 32.8122, longitude: -96.7963, address: '3012 N Henderson Ave, Dallas, TX 75206', city: 'Dallas', state: 'TX' },
      rating: 4.4, reviewsCount: 5800, priceRange: 1,
    },
    categories: ['Dining'],
    age_brackets: ['18-24', '25-34'],
    time_of_day: ['afternoon', 'evening', 'night'],
    curated_explanation: 'Creative tacos with global twists — 4.4★ at just $. The WTF (Weekly Taco Feature) is always wild.',
    priority: 78,
  },
  {
    place_name: 'Filament at Deep Ellum',
    place_data: {
      id: 'filament', name: 'Filament', category: 'restaurant',
      description: 'Upscale New American in a converted 1920s Ford assembly plant.',
      location: { latitude: 32.7840, longitude: -96.7830, address: '2626 Main St, Dallas, TX 75226', city: 'Dallas', state: 'TX' },
      rating: 4.4, reviewsCount: 1800, priceRange: 3,
    },
    categories: ['Dining'],
    age_brackets: ['25-34', '35-44', '45+'],
    time_of_day: ['evening'],
    curated_explanation: 'Upscale dining in a converted 1920s Ford plant — 4.4★. Industrial chic meets refined New American.',
    priority: 75,
  },

  // ============================================================================
  // COFFEE & CAFES (6)
  // ============================================================================
  {
    place_name: 'Houndstooth Coffee',
    place_data: {
      id: 'houndstooth', name: 'Houndstooth Coffee', category: 'cafe',
      description: 'Specialty coffee roaster with minimalist design and expert baristas.',
      location: { latitude: 32.8189, longitude: -96.7999, address: '1900 N Henderson Ave, Dallas, TX 75206', city: 'Dallas', state: 'TX' },
      rating: 4.6, reviewsCount: 1200, priceRange: 2,
    },
    categories: ['Coffee & Cafes'],
    age_brackets: ['18-24', '25-34', '35-44'],
    time_of_day: ['morning', 'afternoon'],
    curated_explanation: 'Dallas\'s best specialty coffee — 4.6★. Single-origin pour-overs and a clean, focused workspace.',
    priority: 90,
  },
  {
    place_name: 'Weekend Coffee',
    place_data: {
      id: 'weekend-coffee', name: 'Weekend Coffee', category: 'cafe',
      description: 'Cozy neighborhood cafe with house-roasted beans and fresh pastries.',
      location: { latitude: 32.7867, longitude: -96.7789, address: '1515 Elm St, Dallas, TX 75201', city: 'Dallas', state: 'TX' },
      rating: 4.7, reviewsCount: 600, priceRange: 1,
    },
    categories: ['Coffee & Cafes'],
    age_brackets: ['18-24', '25-34'],
    time_of_day: ['morning', 'afternoon'],
    curated_explanation: 'Hidden gem — 4.7★. House-roasted beans, fresh pastries, and the coziest vibe in Dallas.',
    priority: 85,
  },
  {
    place_name: 'La La Land Kind Cafe',
    place_data: {
      id: 'la-la-land', name: 'La La Land Kind Cafe', category: 'cafe',
      description: 'Social enterprise cafe employing transitional-age youth from foster care.',
      location: { latitude: 32.7844, longitude: -96.7850, address: '2630 Main St, Dallas, TX 75226', city: 'Dallas', state: 'TX' },
      rating: 4.6, reviewsCount: 2400, priceRange: 1,
    },
    categories: ['Coffee & Cafes'],
    age_brackets: ['18-24', '25-34', '35-44'],
    time_of_day: ['morning', 'afternoon'],
    curated_explanation: 'Great coffee with a greater mission — 4.6★ Deep Ellum cafe employing youth from foster care.',
    priority: 88,
  },
  {
    place_name: 'Ascension Coffee',
    place_data: {
      id: 'ascension', name: 'Ascension Coffee', category: 'cafe',
      description: 'Upscale coffee and brunch spot with a beautiful Design District location.',
      location: { latitude: 32.7918, longitude: -96.8198, address: '1621 Oak Lawn Ave, Dallas, TX 75207', city: 'Dallas', state: 'TX' },
      rating: 4.4, reviewsCount: 3100, priceRange: 2,
    },
    categories: ['Coffee & Cafes', 'Dining'],
    age_brackets: ['25-34', '35-44', '45+'],
    time_of_day: ['morning', 'afternoon'],
    curated_explanation: 'Design District elegance — 4.4★. Craft coffee, stunning brunch, and Instagram-worthy interiors.',
    priority: 82,
  },
  {
    place_name: 'Davis Street Espresso',
    place_data: {
      id: 'davis-street', name: 'Davis Street Espresso', category: 'cafe',
      description: 'Oak Cliff staple with direct-trade espresso and community vibe.',
      location: { latitude: 32.7475, longitude: -96.8269, address: '819 W Davis St, Dallas, TX 75208', city: 'Dallas', state: 'TX' },
      rating: 4.5, reviewsCount: 900, priceRange: 1,
    },
    categories: ['Coffee & Cafes'],
    age_brackets: ['18-24', '25-34', '35-44'],
    time_of_day: ['morning', 'afternoon'],
    curated_explanation: 'Oak Cliff staple — 4.5★ direct-trade espresso with real neighborhood character.',
    priority: 80,
  },
  {
    place_name: 'Opening Bell Coffee',
    place_data: {
      id: 'opening-bell', name: 'Opening Bell Coffee', category: 'cafe',
      description: 'Non-profit coffee shop in a converted 1903 church. Live music and community events.',
      location: { latitude: 32.7532, longitude: -96.8305, address: '1409 S Lamar St, Dallas, TX 75215', city: 'Dallas', state: 'TX' },
      rating: 4.5, reviewsCount: 1100, priceRange: 1,
    },
    categories: ['Coffee & Cafes', 'Live Music'],
    age_brackets: ['18-24', '25-34', '35-44'],
    time_of_day: ['morning', 'afternoon', 'evening'],
    curated_explanation: 'Non-profit cafe in a 1903 church — 4.5★. Live music, community events, and soul-warming coffee.',
    priority: 78,
  },

  // ============================================================================
  // BARS & NIGHTLIFE (5)
  // ============================================================================
  {
    place_name: 'Midnight Rambler',
    place_data: {
      id: 'midnight-rambler', name: 'Midnight Rambler', category: 'bar',
      description: 'Subterranean cocktail bar beneath The Joule hotel. Sophisticated speakeasy vibes.',
      location: { latitude: 32.7816, longitude: -96.7981, address: '1530 Main St, Dallas, TX 75201', city: 'Dallas', state: 'TX' },
      rating: 4.5, reviewsCount: 1900, priceRange: 3,
    },
    categories: ['Bars & Nightlife'],
    age_brackets: ['25-34', '35-44'],
    time_of_day: ['evening', 'night'],
    curated_explanation: 'Underground speakeasy beneath The Joule — 4.5★. Some of the best cocktails in Texas, period.',
    priority: 92,
  },
  {
    place_name: 'Deep Ellum Brewing Company',
    place_data: {
      id: 'deep-ellum-brewing', name: 'Deep Ellum Brewing Company', category: 'brewery',
      description: 'Dallas-born craft brewery with taproom, food trucks, and live music.',
      location: { latitude: 32.7800, longitude: -96.7750, address: '2823 St Louis St, Dallas, TX 75226', city: 'Dallas', state: 'TX' },
      rating: 4.5, reviewsCount: 3200, priceRange: 2,
    },
    categories: ['Bars & Nightlife'],
    age_brackets: ['18-24', '25-34', '35-44'],
    time_of_day: ['afternoon', 'evening', 'night'],
    curated_explanation: 'Dallas-born craft brewery — 4.5★. Great taproom, rotating food trucks, and weekend live music.',
    priority: 85,
  },
  {
    place_name: 'The Adolphus Rooftop',
    place_data: {
      id: 'adolphus-rooftop', name: 'The Adolphus Rooftop', category: 'bar',
      description: 'Rooftop pool and cocktail bar atop the historic Adolphus Hotel with skyline views.',
      location: { latitude: 32.7807, longitude: -96.7971, address: '1321 Commerce St, Dallas, TX 75202', city: 'Dallas', state: 'TX' },
      rating: 4.3, reviewsCount: 1500, priceRange: 3,
    },
    categories: ['Bars & Nightlife'],
    age_brackets: ['25-34', '35-44', '45+'],
    time_of_day: ['evening', 'night'],
    curated_explanation: 'Dallas skyline views from a historic rooftop — 4.3★. The sunset cocktails here are unbeatable.',
    priority: 88,
  },
  {
    place_name: 'Bitter Sisters Brewing',
    place_data: {
      id: 'bitter-sisters', name: 'Bitter Sisters Brewing', category: 'brewery',
      description: 'Women-owned craft brewery in Addison with creative seasonal brews.',
      location: { latitude: 32.9592, longitude: -96.8332, address: '14424 Midway Rd, Addison, TX 75001', city: 'Dallas', state: 'TX' },
      rating: 4.4, reviewsCount: 800, priceRange: 1,
    },
    categories: ['Bars & Nightlife'],
    age_brackets: ['25-34', '35-44'],
    time_of_day: ['afternoon', 'evening'],
    curated_explanation: 'Women-owned craft brewery — 4.4★. Creative seasonal brews and a welcoming taproom vibe.',
    priority: 75,
  },
  {
    place_name: 'Cidercade Dallas',
    place_data: {
      id: 'cidercade', name: 'Cidercade Dallas', category: 'bar',
      description: '150+ free-play arcade games with craft ciders. Gaming meets drinking.',
      location: { latitude: 32.7757, longitude: -96.8113, address: '2777 Irving Blvd, Dallas, TX 75207', city: 'Dallas', state: 'TX' },
      rating: 4.6, reviewsCount: 4500, priceRange: 1,
    },
    categories: ['Bars & Nightlife', 'Entertainment'],
    age_brackets: ['18-24', '25-34'],
    time_of_day: ['evening', 'night'],
    curated_explanation: '150+ free-play arcade games with craft ciders — 4.6★. The most fun you can have for $12 admission.',
    priority: 90,
  },

  // ============================================================================
  // ENTERTAINMENT (5)
  // ============================================================================
  {
    place_name: 'Alamo Drafthouse Cinema',
    place_data: {
      id: 'alamo-drafthouse', name: 'Alamo Drafthouse Cinema', category: 'movie_theater',
      description: 'Dine-in cinema with craft beer, food service, and strict no-talking policy.',
      location: { latitude: 32.7788, longitude: -96.8016, address: '1005 S Lamar St, Dallas, TX 75215', city: 'Dallas', state: 'TX' },
      rating: 4.4, reviewsCount: 3800, priceRange: 2,
    },
    categories: ['Entertainment', 'Movies'],
    age_brackets: ['18-24', '25-34', '35-44'],
    time_of_day: ['afternoon', 'evening', 'night'],
    curated_explanation: 'The ultimate movie experience — 4.4★. Dine-in cinema with strict no-talking policy. Movie lovers\' paradise.',
    priority: 88,
  },
  {
    place_name: 'TopGolf Dallas',
    place_data: {
      id: 'topgolf-dallas', name: 'TopGolf Dallas', category: 'entertainment',
      description: 'High-tech driving range with food, drinks, and games.',
      location: { latitude: 32.8542, longitude: -96.8517, address: '8787 Park Ln, Dallas, TX 75231', city: 'Dallas', state: 'TX' },
      rating: 4.3, reviewsCount: 9200, priceRange: 2,
    },
    categories: ['Entertainment', 'Sports'],
    age_brackets: ['18-24', '25-34', '35-44'],
    time_of_day: ['afternoon', 'evening'],
    curated_explanation: 'Even non-golfers love it — 4.3★ with 9K+ reviews. Perfect group activity with food, drinks, and competition.',
    priority: 85,
  },
  {
    place_name: 'SODA Bar & Arcade',
    place_data: {
      id: 'soda-bar', name: 'SODA Bar & Arcade', category: 'arcade',
      description: 'Retro arcade bar in Deep Ellum with classic games and craft cocktails.',
      location: { latitude: 32.7843, longitude: -96.7835, address: '2618 Main St, Dallas, TX 75226', city: 'Dallas', state: 'TX' },
      rating: 4.2, reviewsCount: 500, priceRange: 2,
    },
    categories: ['Entertainment', 'Bars & Nightlife'],
    age_brackets: ['18-24', '25-34'],
    time_of_day: ['evening', 'night'],
    curated_explanation: 'Retro arcade meets cocktail bar in Deep Ellum — 4.2★. Pac-Man + craft cocktails = perfect date night.',
    priority: 78,
  },
  {
    place_name: 'Texas Live!',
    place_data: {
      id: 'texas-live', name: 'Texas Live!', category: 'entertainment',
      description: 'Entertainment complex near AT&T Stadium with multiple venues, restaurants, and live events.',
      location: { latitude: 32.7474, longitude: -97.0935, address: '1650 E Randol Mill Rd, Arlington, TX 76011', city: 'Dallas', state: 'TX' },
      rating: 4.2, reviewsCount: 6100, priceRange: 2,
    },
    categories: ['Entertainment', 'Dining', 'Sports'],
    age_brackets: ['18-24', '25-34', '35-44'],
    time_of_day: ['afternoon', 'evening', 'night'],
    curated_explanation: 'Entertainment complex near AT&T Stadium — 4.2★. Multiple venues, game day energy, and always something happening.',
    priority: 75,
  },
  {
    place_name: 'Comedy Arena',
    place_data: {
      id: 'comedy-arena', name: 'Dallas Comedy Club', category: 'comedy_club',
      description: 'Local improv and stand-up comedy club with nightly shows.',
      location: { latitude: 32.7844, longitude: -96.7844, address: '3036 Elm St, Dallas, TX 75226', city: 'Dallas', state: 'TX' },
      rating: 4.6, reviewsCount: 800, priceRange: 1,
    },
    categories: ['Entertainment'],
    age_brackets: ['18-24', '25-34', '35-44'],
    time_of_day: ['evening', 'night'],
    curated_explanation: 'Improv & stand-up in Deep Ellum — 4.6★. Affordable shows with genuine laughs. Great date night idea.',
    priority: 82,
  },

  // ============================================================================
  // OUTDOOR ACTIVITIES (4)
  // ============================================================================
  {
    place_name: 'White Rock Lake Park',
    place_data: {
      id: 'white-rock-lake', name: 'White Rock Lake Park', category: 'park',
      description: 'Urban lake park with 9-mile trail, kayaking, and skyline views.',
      location: { latitude: 32.8230, longitude: -96.7270, address: '8300 E Lawther Dr, Dallas, TX 75218', city: 'Dallas', state: 'TX' },
      rating: 4.7, reviewsCount: 15000, priceRange: 0,
    },
    categories: ['Outdoor Activities'],
    age_brackets: ['18-24', '25-34', '35-44', '45+'],
    time_of_day: ['morning', 'afternoon'],
    curated_explanation: 'Dallas\'s crown jewel park — 4.7★ with 15K reviews. 9-mile trail, kayaking, and stunning skyline views. Free.',
    priority: 95,
  },
  {
    place_name: 'Katy Trail',
    place_data: {
      id: 'katy-trail', name: 'Katy Trail', category: 'hiking_area',
      description: '3.5-mile converted rail trail through Uptown. Dallas\'s most popular running/biking path.',
      location: { latitude: 32.8084, longitude: -96.8063, address: '3601 Turtle Creek Blvd, Dallas, TX 75219', city: 'Dallas', state: 'TX' },
      rating: 4.7, reviewsCount: 8500, priceRange: 0,
    },
    categories: ['Outdoor Activities', 'Fitness'],
    age_brackets: ['18-24', '25-34', '35-44', '45+'],
    time_of_day: ['morning', 'afternoon'],
    curated_explanation: 'Dallas\'s favorite trail — 4.7★. 3.5 miles through Uptown for running, biking, or dog walking. Free.',
    priority: 92,
  },
  {
    place_name: 'Klyde Warren Park',
    place_data: {
      id: 'klyde-warren', name: 'Klyde Warren Park', category: 'park',
      description: 'Urban deck park built over a freeway with food trucks, yoga, and events.',
      location: { latitude: 32.7892, longitude: -96.8014, address: '2012 Woodall Rodgers Fwy, Dallas, TX 75201', city: 'Dallas', state: 'TX' },
      rating: 4.7, reviewsCount: 18000, priceRange: 0,
    },
    categories: ['Outdoor Activities'],
    age_brackets: ['18-24', '25-34', '35-44', '45+'],
    time_of_day: ['morning', 'afternoon', 'evening'],
    curated_explanation: 'Park built over a freeway — 4.7★ with 18K reviews. Free yoga, food trucks, games, and people-watching.',
    priority: 93,
  },
  {
    place_name: 'Trinity River Audubon Center',
    place_data: {
      id: 'trinity-audubon', name: 'Trinity River Audubon Center', category: 'nature_reserve',
      description: '120 acres of wetlands with hiking trails and birdwatching just minutes from downtown.',
      location: { latitude: 32.6961, longitude: -96.7437, address: '6500 Great Trinity Forest Way, Dallas, TX 75217', city: 'Dallas', state: 'TX' },
      rating: 4.6, reviewsCount: 1200, priceRange: 0,
    },
    categories: ['Outdoor Activities'],
    age_brackets: ['25-34', '35-44', '45+'],
    time_of_day: ['morning', 'afternoon'],
    curated_explanation: '120 acres of nature minutes from downtown — 4.6★. Stunning wetland trails and birdwatching. A local secret.',
    priority: 80,
  },

  // ============================================================================
  // FITNESS (4)
  // ============================================================================
  {
    place_name: 'Equinox Highland Park',
    place_data: {
      id: 'equinox-hp', name: 'Equinox Highland Park', category: 'gym',
      description: 'Luxury fitness club with state-of-the-art equipment and group classes.',
      location: { latitude: 32.8335, longitude: -96.8030, address: '4023 Oak Lawn Ave, Dallas, TX 75219', city: 'Dallas', state: 'TX' },
      rating: 4.3, reviewsCount: 600, priceRange: 3,
    },
    categories: ['Fitness'],
    age_brackets: ['25-34', '35-44'],
    time_of_day: ['morning', 'afternoon', 'evening'],
    curated_explanation: 'Premium fitness experience — 4.3★. Top-tier equipment, spa, and group classes in Highland Park.',
    priority: 80,
  },
  {
    place_name: 'Sunstone Yoga',
    place_data: {
      id: 'sunstone-yoga', name: 'Sunstone Yoga', category: 'yoga_studio',
      description: 'Hot yoga studio with multiple class types from beginner to advanced.',
      location: { latitude: 32.8201, longitude: -96.7955, address: '5600 W Lovers Ln, Dallas, TX 75209', city: 'Dallas', state: 'TX' },
      rating: 4.6, reviewsCount: 450, priceRange: 2,
    },
    categories: ['Fitness', 'Wellness'],
    age_brackets: ['18-24', '25-34', '35-44', '45+'],
    time_of_day: ['morning', 'afternoon', 'evening'],
    curated_explanation: 'Hot yoga haven — 4.6★. Multiple class styles from gentle flow to power yoga. Great for beginners.',
    priority: 82,
  },
  {
    place_name: 'Peloton Studios Dallas',
    place_data: {
      id: 'peloton-dallas', name: 'Peloton Studios Dallas', category: 'cycling_studio',
      description: 'Peloton\'s second-ever studio location with live classes and retail.',
      location: { latitude: 32.7920, longitude: -96.8050, address: '2300 N Field St, Dallas, TX 75201', city: 'Dallas', state: 'TX' },
      rating: 4.8, reviewsCount: 300, priceRange: 2,
    },
    categories: ['Fitness'],
    age_brackets: ['18-24', '25-34', '35-44'],
    time_of_day: ['morning', 'afternoon'],
    curated_explanation: 'Peloton\'s 2nd-ever studio — 4.8★. Take live classes with real instructors. A bucket-list fitness experience.',
    priority: 85,
  },
  {
    place_name: 'GRIT Fitness',
    place_data: {
      id: 'grit-fitness', name: 'GRIT Fitness', category: 'fitness_center',
      description: 'Women-focused boutique fitness with HIIT, boxing, and barre classes.',
      location: { latitude: 32.8133, longitude: -96.7951, address: '3106 N Henderson Ave, Dallas, TX 75206', city: 'Dallas', state: 'TX' },
      rating: 4.8, reviewsCount: 350, priceRange: 2,
    },
    categories: ['Fitness'],
    age_brackets: ['18-24', '25-34', '35-44'],
    time_of_day: ['morning', 'afternoon', 'evening'],
    curated_explanation: 'Women-focused boutique fitness — 4.8★. HIIT, boxing, and barre that will push your limits.',
    priority: 78,
  },

  // ============================================================================
  // ARTS & CULTURE (4)
  // ============================================================================
  {
    place_name: 'Dallas Museum of Art',
    place_data: {
      id: 'dma', name: 'Dallas Museum of Art', category: 'museum',
      description: 'World-class art museum with free general admission. 24,000+ works spanning 5,000 years.',
      location: { latitude: 32.7877, longitude: -96.8009, address: '1717 N Harwood St, Dallas, TX 75201', city: 'Dallas', state: 'TX' },
      rating: 4.6, reviewsCount: 12000, priceRange: 0,
    },
    categories: ['Arts & Culture'],
    age_brackets: ['18-24', '25-34', '35-44', '45+'],
    time_of_day: ['morning', 'afternoon'],
    curated_explanation: 'World-class art, always free — 4.6★ with 12K reviews. 24,000 works spanning 5,000 years of human creativity.',
    priority: 93,
  },
  {
    place_name: 'Nasher Sculpture Center',
    place_data: {
      id: 'nasher', name: 'Nasher Sculpture Center', category: 'art_gallery',
      description: 'Renzo Piano-designed museum with modern sculpture in a stunning garden setting.',
      location: { latitude: 32.7888, longitude: -96.8002, address: '2001 Flora St, Dallas, TX 75201', city: 'Dallas', state: 'TX' },
      rating: 4.6, reviewsCount: 5200, priceRange: 2,
    },
    categories: ['Arts & Culture'],
    age_brackets: ['25-34', '35-44', '45+'],
    time_of_day: ['morning', 'afternoon'],
    curated_explanation: 'Renzo Piano-designed masterpiece — 4.6★. Modern sculpture in a garden that feels like its own artwork.',
    priority: 88,
  },
  {
    place_name: 'The Sixth Floor Museum',
    place_data: {
      id: 'sixth-floor', name: 'The Sixth Floor Museum at Dealey Plaza', category: 'museum',
      description: 'JFK assassination site museum — a powerful historical experience.',
      location: { latitude: 32.7799, longitude: -96.8083, address: '411 Elm St, Dallas, TX 75202', city: 'Dallas', state: 'TX' },
      rating: 4.6, reviewsCount: 22000, priceRange: 2,
    },
    categories: ['Arts & Culture'],
    age_brackets: ['18-24', '25-34', '35-44', '45+'],
    time_of_day: ['morning', 'afternoon'],
    curated_explanation: 'Where history happened — 4.6★ with 22K reviews. The JFK assassination site is a must-visit experience.',
    priority: 90,
  },
  {
    place_name: 'Dallas Contemporary',
    place_data: {
      id: 'dallas-contemporary', name: 'Dallas Contemporary', category: 'art_gallery',
      description: 'Free contemporary art museum with bold, rotating exhibitions.',
      location: { latitude: 32.7904, longitude: -96.8136, address: '161 Glass St, Dallas, TX 75207', city: 'Dallas', state: 'TX' },
      rating: 4.4, reviewsCount: 600, priceRange: 0,
    },
    categories: ['Arts & Culture'],
    age_brackets: ['18-24', '25-34', '35-44'],
    time_of_day: ['morning', 'afternoon'],
    curated_explanation: 'Free contemporary art that pushes boundaries — 4.4★. Bold rotating exhibitions you won\'t find elsewhere.',
    priority: 78,
  },

  // ============================================================================
  // SHOPPING (3)
  // ============================================================================
  {
    place_name: 'NorthPark Center',
    place_data: {
      id: 'northpark', name: 'NorthPark Center', category: 'shopping_mall',
      description: 'Iconic luxury shopping center with museum-quality art displays throughout.',
      location: { latitude: 32.8686, longitude: -96.7725, address: '8687 N Central Expy, Dallas, TX 75225', city: 'Dallas', state: 'TX' },
      rating: 4.6, reviewsCount: 25000, priceRange: 3,
    },
    categories: ['Shopping'],
    age_brackets: ['18-24', '25-34', '35-44', '45+'],
    time_of_day: ['morning', 'afternoon', 'evening'],
    curated_explanation: 'Dallas\'s iconic luxury mall — 4.6★ with 25K reviews. Museum-quality art between Gucci and Nordstrom.',
    priority: 88,
  },
  {
    place_name: 'Deep Ellum Murals & Shops',
    place_data: {
      id: 'deep-ellum-shops', name: 'Deep Ellum Murals & Shops', category: 'shopping_mall',
      description: 'Walkable arts district with indie shops, vintage stores, and world-class street art.',
      location: { latitude: 32.7843, longitude: -96.7835, address: 'Main St & Elm St, Dallas, TX 75226', city: 'Dallas', state: 'TX' },
      rating: 4.5, reviewsCount: 3500, priceRange: 1,
    },
    categories: ['Shopping', 'Arts & Culture'],
    age_brackets: ['18-24', '25-34'],
    time_of_day: ['afternoon', 'evening'],
    curated_explanation: 'Indie shops, vintage finds, and world-class street art — 4.5★. Deep Ellum is Dallas\'s creative heartbeat.',
    priority: 85,
  },
  {
    place_name: 'Dallas Farmers Market',
    place_data: {
      id: 'farmers-market', name: 'Dallas Farmers Market', category: 'farmers_market',
      description: 'Year-round open-air market with local produce, artisan goods, and food stalls.',
      location: { latitude: 32.7740, longitude: -96.7950, address: '920 S Harwood St, Dallas, TX 75201', city: 'Dallas', state: 'TX' },
      rating: 4.4, reviewsCount: 7500, priceRange: 1,
    },
    categories: ['Shopping', 'Dining'],
    age_brackets: ['25-34', '35-44', '45+'],
    time_of_day: ['morning', 'afternoon'],
    curated_explanation: 'Year-round local market — 4.4★. Fresh produce, artisan goods, and incredible food stalls every weekend.',
    priority: 82,
  },

  // ============================================================================
  // LIVE MUSIC (3)
  // ============================================================================
  {
    place_name: 'Trees',
    place_data: {
      id: 'trees-dallas', name: 'Trees', category: 'live_music_venue',
      description: 'Legendary Deep Ellum music venue since 1990. Intimate setting for live bands.',
      location: { latitude: 32.7846, longitude: -96.7850, address: '2709 Elm St, Dallas, TX 75226', city: 'Dallas', state: 'TX' },
      rating: 4.3, reviewsCount: 2500, priceRange: 1,
    },
    categories: ['Live Music', 'Entertainment'],
    age_brackets: ['18-24', '25-34', '35-44'],
    time_of_day: ['evening', 'night'],
    curated_explanation: 'Deep Ellum legend since 1990 — 4.3★. Intimate live music venue where every show feels electric.',
    priority: 88,
  },
  {
    place_name: 'The Kessler Theater',
    place_data: {
      id: 'kessler', name: 'The Kessler Theater', category: 'performing_arts_theater',
      description: 'Restored 1940s Art Deco theater hosting indie and folk concerts.',
      location: { latitude: 32.7424, longitude: -96.8277, address: '1230 W Davis St, Dallas, TX 75208', city: 'Dallas', state: 'TX' },
      rating: 4.7, reviewsCount: 1800, priceRange: 2,
    },
    categories: ['Live Music', 'Entertainment'],
    age_brackets: ['25-34', '35-44', '45+'],
    time_of_day: ['evening', 'night'],
    curated_explanation: 'Restored 1940s Art Deco theater — 4.7★. Intimate indie and folk shows in one of Dallas\'s most beautiful venues.',
    priority: 90,
  },
  {
    place_name: 'Ruins',
    place_data: {
      id: 'ruins-dallas', name: 'Ruins', category: 'live_music_venue',
      description: 'Eclectic Deep Ellum bar with live DJs, vinyl nights, and an epic patio.',
      location: { latitude: 32.7844, longitude: -96.7832, address: '2653 Commerce St, Dallas, TX 75226', city: 'Dallas', state: 'TX' },
      rating: 4.4, reviewsCount: 700, priceRange: 1,
    },
    categories: ['Live Music', 'Bars & Nightlife'],
    age_brackets: ['18-24', '25-34'],
    time_of_day: ['evening', 'night'],
    curated_explanation: 'Deep Ellum\'s most eclectic bar — 4.4★. Live DJs, vinyl nights, and a patio that goes until 2am.',
    priority: 82,
  },

  // ============================================================================
  // SPORTS (3)
  // ============================================================================
  {
    place_name: 'American Airlines Center',
    place_data: {
      id: 'aac', name: 'American Airlines Center', category: 'stadium',
      description: 'Home of the Dallas Mavericks and Dallas Stars. World-class sports and concert venue.',
      location: { latitude: 32.7906, longitude: -96.8103, address: '2500 Victory Ave, Dallas, TX 75219', city: 'Dallas', state: 'TX' },
      rating: 4.6, reviewsCount: 35000, priceRange: 3,
    },
    categories: ['Sports', 'Entertainment'],
    age_brackets: ['18-24', '25-34', '35-44', '45+'],
    time_of_day: ['evening', 'night'],
    curated_explanation: 'Home of the Mavs & Stars — 4.6★ with 35K reviews. Electric game day atmosphere in Victory Park.',
    priority: 92,
  },
  {
    place_name: 'Globe Life Field',
    place_data: {
      id: 'globe-life', name: 'Globe Life Field', category: 'stadium',
      description: 'Home of the Texas Rangers with retractable roof and modern amenities.',
      location: { latitude: 32.7513, longitude: -97.0827, address: '734 Stadium Dr, Arlington, TX 76011', city: 'Dallas', state: 'TX' },
      rating: 4.5, reviewsCount: 18000, priceRange: 3,
    },
    categories: ['Sports'],
    age_brackets: ['18-24', '25-34', '35-44', '45+'],
    time_of_day: ['afternoon', 'evening'],
    curated_explanation: 'Home of the Rangers — 4.5★ with 18K reviews. Climate-controlled baseball perfection.',
    priority: 85,
  },
  {
    place_name: 'FC Dallas - Toyota Stadium',
    place_data: {
      id: 'toyota-stadium', name: 'Toyota Stadium', category: 'stadium',
      description: 'Home of FC Dallas MLS team with soccer-specific design and great sightlines.',
      location: { latitude: 33.1543, longitude: -96.8349, address: '9200 World Cup Way, Frisco, TX 75033', city: 'Dallas', state: 'TX' },
      rating: 4.3, reviewsCount: 5500, priceRange: 2,
    },
    categories: ['Sports'],
    age_brackets: ['18-24', '25-34', '35-44'],
    time_of_day: ['afternoon', 'evening'],
    curated_explanation: 'MLS soccer atmosphere — 4.3★. Affordable tickets, great sightlines, and real match day energy.',
    priority: 78,
  },

  // ============================================================================
  // WELLNESS (3)
  // ============================================================================
  {
    place_name: 'Spa Nordstrom at NorthPark',
    place_data: {
      id: 'spa-nordstrom', name: 'Spa Nordstrom', category: 'spa',
      description: 'Luxurious spa inside NorthPark Center with massage, facials, and beauty services.',
      location: { latitude: 32.8686, longitude: -96.7725, address: '8687 N Central Expy, Dallas, TX 75225', city: 'Dallas', state: 'TX' },
      rating: 4.4, reviewsCount: 500, priceRange: 3,
    },
    categories: ['Wellness'],
    age_brackets: ['25-34', '35-44', '45+'],
    time_of_day: ['morning', 'afternoon'],
    curated_explanation: 'Luxury spa in NorthPark — 4.4★. Massages, facials, and pampering between shopping trips.',
    priority: 80,
  },
  {
    place_name: 'The Ritz-Carlton Spa Dallas',
    place_data: {
      id: 'ritz-spa', name: 'The Ritz-Carlton Spa', category: 'spa',
      description: 'Five-star spa experience with signature treatments and relaxation lounge.',
      location: { latitude: 32.7990, longitude: -96.8038, address: '2121 McKinney Ave, Dallas, TX 75201', city: 'Dallas', state: 'TX' },
      rating: 4.5, reviewsCount: 300, priceRange: 3,
    },
    categories: ['Wellness'],
    age_brackets: ['35-44', '45+'],
    time_of_day: ['morning', 'afternoon'],
    curated_explanation: 'Five-star spa experience — 4.5★. Signature treatments and total relaxation in the heart of Uptown.',
    priority: 78,
  },
  {
    place_name: 'Russian & Turkish Baths Dallas',
    place_data: {
      id: 'russian-baths', name: 'King Spa & Sauna', category: 'spa',
      description: 'Korean-style jimjilbang spa with saunas, pools, and overnight stays.',
      location: { latitude: 32.9271, longitude: -96.8932, address: '2154 Royal Ln, Dallas, TX 75229', city: 'Dallas', state: 'TX' },
      rating: 4.2, reviewsCount: 3000, priceRange: 2,
    },
    categories: ['Wellness', 'Fitness'],
    age_brackets: ['18-24', '25-34', '35-44', '45+'],
    time_of_day: ['morning', 'afternoon', 'evening'],
    curated_explanation: 'Korean-style spa with saunas, pools, and overnight stays — 4.2★. Full day of relaxation for under $40.',
    priority: 85,
  },
];

/**
 * Seed curated Dallas picks into the database.
 * Upserts by place_name + city to avoid duplicates on re-run.
 */
export async function seedDallasCuratedPicks() {
  // Dynamic import for environments where supabase may not be available
  const { supabase } = await import('@/lib/supabase');

  console.log(`Seeding ${DALLAS_PICKS.length} curated Dallas picks...`);

  let inserted = 0;
  let errors = 0;

  for (const pick of DALLAS_PICKS) {
    const { error } = await supabase
      .from('curated_recommendations')
      .upsert(
        {
          city: 'Dallas',
          state: 'TX',
          place_name: pick.place_name,
          place_data: pick.place_data,
          categories: pick.categories,
          age_brackets: pick.age_brackets,
          time_of_day: pick.time_of_day,
          curated_explanation: pick.curated_explanation,
          priority: pick.priority,
          is_active: true,
        },
        { onConflict: 'id' } // Each has unique gen_random_uuid()
      );

    if (error) {
      console.error(`Error inserting ${pick.place_name}:`, error.message);
      errors++;
    } else {
      inserted++;
    }
  }

  console.log(`Done: ${inserted} inserted, ${errors} errors out of ${DALLAS_PICKS.length} picks.`);
  return { inserted, errors, total: DALLAS_PICKS.length };
}

// Export picks for testing
export { DALLAS_PICKS };
