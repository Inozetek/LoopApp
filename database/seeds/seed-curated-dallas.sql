-- =============================================================================
-- Seed: Curated Dallas Recommendations
-- 53 hand-picked Dallas places across all interest categories.
--
-- This script inserts curated activity recommendations for Dallas, TX into
-- the curated_recommendations table. Uses a single INSERT with multiple
-- VALUES rows for efficiency.
--
-- Safe to re-run: will fail on duplicate UUIDs (each row gets a new UUID).
-- To re-seed, DELETE FROM curated_recommendations WHERE city = 'Dallas' first.
-- =============================================================================

INSERT INTO curated_recommendations (
  city,
  state,
  place_name,
  place_data,
  categories,
  age_brackets,
  time_of_day,
  curated_explanation,
  priority,
  curator,
  is_active
) VALUES

-- ============================================================================
-- DINING (10)
-- ============================================================================

-- 1. Pecan Lodge
(
  'Dallas',
  'TX',
  'Pecan Lodge',
  '{"id":"pecan-lodge","name":"Pecan Lodge","category":"restaurant","description":"Iconic Texas BBQ in Deep Ellum. Lines form early for a reason.","location":{"latitude":32.7838,"longitude":-96.7846,"address":"2702 Main St, Dallas, TX 75226","city":"Dallas","state":"TX"},"rating":4.6,"reviewsCount":12500,"priceRange":2}'::jsonb,
  ARRAY['Dining'],
  ARRAY['18-24','25-34','35-44','45+'],
  ARRAY['afternoon','evening'],
  'Deep Ellum legend — 4.6★ with 12K+ reviews. The brisket and hot links are worth every minute in line.',
  95,
  'loop_team',
  true
),

-- 2. Uchi Dallas
(
  'Dallas',
  'TX',
  'Uchi Dallas',
  '{"id":"uchi-dallas","name":"Uchi Dallas","category":"japanese_restaurant","description":"James Beard-nominated Japanese farmhouse dining with innovative sushi.","location":{"latitude":32.8024,"longitude":-96.8038,"address":"2817 Maple Ave, Dallas, TX 75201","city":"Dallas","state":"TX"},"rating":4.7,"reviewsCount":3800,"priceRange":3}'::jsonb,
  ARRAY['Dining'],
  ARRAY['25-34','35-44','45+'],
  ARRAY['evening'],
  'James Beard-nominated sushi — 4.7★ upscale Japanese in Uptown. The wagyu sashimi is unforgettable.',
  90,
  'loop_team',
  true
),

-- 3. Cane Rosso
(
  'Dallas',
  'TX',
  'Cane Rosso',
  '{"id":"cane-rosso","name":"Cane Rosso","category":"italian_restaurant","description":"Neapolitan-style pizza with a wood-fired oven and craft cocktails.","location":{"latitude":32.7856,"longitude":-96.7836,"address":"2612 Commerce St, Dallas, TX 75226","city":"Dallas","state":"TX"},"rating":4.5,"reviewsCount":5200,"priceRange":2}'::jsonb,
  ARRAY['Dining'],
  ARRAY['18-24','25-34','35-44'],
  ARRAY['afternoon','evening'],
  'Deep Ellum''s best pizza — 4.5★ wood-fired Neapolitan pies. The Honey Bastard is a must-try.',
  85,
  'loop_team',
  true
),

-- 4. Loro Asian Smokehouse & Bar
(
  'Dallas',
  'TX',
  'Loro Asian Smokehouse & Bar',
  '{"id":"loro-dallas","name":"Loro Asian Smokehouse & Bar","category":"restaurant","description":"Fusion of Texas BBQ and Southeast Asian flavors from Uchi and Franklin BBQ teams.","location":{"latitude":32.8152,"longitude":-96.8022,"address":"3526 Oak Lawn Ave, Dallas, TX 75219","city":"Dallas","state":"TX"},"rating":4.5,"reviewsCount":2900,"priceRange":2}'::jsonb,
  ARRAY['Dining'],
  ARRAY['25-34','35-44'],
  ARRAY['afternoon','evening'],
  'BBQ meets Thai from the Uchi + Franklin Barbecue teams — 4.5★. The brisket pad thai is genius.',
  88,
  'loop_team',
  true
),

-- 5. Meso Maya Comida y Copas
(
  'Dallas',
  'TX',
  'Meso Maya Comida y Copas',
  '{"id":"meso-maya","name":"Meso Maya Comida y Copas","category":"mexican_restaurant","description":"Interior Mexican cuisine beyond Tex-Mex, with moles and chiles from Oaxaca.","location":{"latitude":32.7869,"longitude":-96.7986,"address":"1611 McKinney Ave, Dallas, TX 75202","city":"Dallas","state":"TX"},"rating":4.5,"reviewsCount":4100,"priceRange":2}'::jsonb,
  ARRAY['Dining'],
  ARRAY['25-34','35-44','45+'],
  ARRAY['afternoon','evening'],
  'Interior Mexican beyond Tex-Mex — 4.5★. The mole negro and mezcal cocktails transport you to Oaxaca.',
  82,
  'loop_team',
  true
),

-- 6. The Rustic
(
  'Dallas',
  'TX',
  'The Rustic',
  '{"id":"the-rustic","name":"The Rustic","category":"restaurant","description":"Texas comfort food with live music, a massive patio, and weekend brunch.","location":{"latitude":32.7989,"longitude":-96.8044,"address":"3656 Howell St, Dallas, TX 75204","city":"Dallas","state":"TX"},"rating":4.3,"reviewsCount":7500,"priceRange":2}'::jsonb,
  ARRAY['Dining','Live Music'],
  ARRAY['18-24','25-34','35-44'],
  ARRAY['afternoon','evening'],
  'Live music + Texas comfort food on a huge patio — 4.3★ with 7.5K reviews. Perfect for groups.',
  80,
  'loop_team',
  true
),

-- 7. Terry Black's Barbecue
(
  'Dallas',
  'TX',
  'Terry Black''s Barbecue',
  '{"id":"terry-blacks","name":"Terry Black''s Barbecue","category":"restaurant","description":"Austin BBQ dynasty brings legendary brisket to Deep Ellum.","location":{"latitude":32.7835,"longitude":-96.7818,"address":"3025 Main St, Dallas, TX 75226","city":"Dallas","state":"TX"},"rating":4.5,"reviewsCount":6200,"priceRange":2}'::jsonb,
  ARRAY['Dining'],
  ARRAY['18-24','25-34','35-44','45+'],
  ARRAY['afternoon','evening'],
  'Austin BBQ royalty in Deep Ellum — 4.5★ with 6K+ reviews. Brisket that rivals the original.',
  87,
  'loop_team',
  true
),

-- 8. Nobu Dallas
(
  'Dallas',
  'TX',
  'Nobu Dallas',
  '{"id":"nobu-dallas","name":"Nobu Dallas","category":"japanese_restaurant","description":"World-famous Japanese-Peruvian fusion in the Crescent Hotel.","location":{"latitude":32.7999,"longitude":-96.8028,"address":"400 Crescent Ct, Dallas, TX 75201","city":"Dallas","state":"TX"},"rating":4.4,"reviewsCount":2100,"priceRange":3}'::jsonb,
  ARRAY['Dining'],
  ARRAY['25-34','35-44','45+'],
  ARRAY['evening'],
  'World-famous Japanese-Peruvian fusion — 4.4★. The black cod miso is iconic for a reason.',
  83,
  'loop_team',
  true
),

-- 9. Velvet Taco
(
  'Dallas',
  'TX',
  'Velvet Taco',
  '{"id":"velvet-taco","name":"Velvet Taco","category":"mexican_restaurant","description":"Creative globally-inspired tacos with a rotating weekly taco feature.","location":{"latitude":32.8122,"longitude":-96.7963,"address":"3012 N Henderson Ave, Dallas, TX 75206","city":"Dallas","state":"TX"},"rating":4.4,"reviewsCount":5800,"priceRange":1}'::jsonb,
  ARRAY['Dining'],
  ARRAY['18-24','25-34'],
  ARRAY['afternoon','evening','night'],
  'Creative tacos with global twists — 4.4★ at just $. The WTF (Weekly Taco Feature) is always wild.',
  78,
  'loop_team',
  true
),

-- 10. Filament at Deep Ellum
(
  'Dallas',
  'TX',
  'Filament at Deep Ellum',
  '{"id":"filament","name":"Filament","category":"restaurant","description":"Upscale New American in a converted 1920s Ford assembly plant.","location":{"latitude":32.784,"longitude":-96.783,"address":"2626 Main St, Dallas, TX 75226","city":"Dallas","state":"TX"},"rating":4.4,"reviewsCount":1800,"priceRange":3}'::jsonb,
  ARRAY['Dining'],
  ARRAY['25-34','35-44','45+'],
  ARRAY['evening'],
  'Upscale dining in a converted 1920s Ford plant — 4.4★. Industrial chic meets refined New American.',
  75,
  'loop_team',
  true
),

-- ============================================================================
-- COFFEE & CAFES (6)
-- ============================================================================

-- 11. Houndstooth Coffee
(
  'Dallas',
  'TX',
  'Houndstooth Coffee',
  '{"id":"houndstooth","name":"Houndstooth Coffee","category":"cafe","description":"Specialty coffee roaster with minimalist design and expert baristas.","location":{"latitude":32.8189,"longitude":-96.7999,"address":"1900 N Henderson Ave, Dallas, TX 75206","city":"Dallas","state":"TX"},"rating":4.6,"reviewsCount":1200,"priceRange":2}'::jsonb,
  ARRAY['Coffee & Cafes'],
  ARRAY['18-24','25-34','35-44'],
  ARRAY['morning','afternoon'],
  'Dallas''s best specialty coffee — 4.6★. Single-origin pour-overs and a clean, focused workspace.',
  90,
  'loop_team',
  true
),

-- 12. Weekend Coffee
(
  'Dallas',
  'TX',
  'Weekend Coffee',
  '{"id":"weekend-coffee","name":"Weekend Coffee","category":"cafe","description":"Cozy neighborhood cafe with house-roasted beans and fresh pastries.","location":{"latitude":32.7867,"longitude":-96.7789,"address":"1515 Elm St, Dallas, TX 75201","city":"Dallas","state":"TX"},"rating":4.7,"reviewsCount":600,"priceRange":1}'::jsonb,
  ARRAY['Coffee & Cafes'],
  ARRAY['18-24','25-34'],
  ARRAY['morning','afternoon'],
  'Hidden gem — 4.7★. House-roasted beans, fresh pastries, and the coziest vibe in Dallas.',
  85,
  'loop_team',
  true
),

-- 13. La La Land Kind Cafe
(
  'Dallas',
  'TX',
  'La La Land Kind Cafe',
  '{"id":"la-la-land","name":"La La Land Kind Cafe","category":"cafe","description":"Social enterprise cafe employing transitional-age youth from foster care.","location":{"latitude":32.7844,"longitude":-96.785,"address":"2630 Main St, Dallas, TX 75226","city":"Dallas","state":"TX"},"rating":4.6,"reviewsCount":2400,"priceRange":1}'::jsonb,
  ARRAY['Coffee & Cafes'],
  ARRAY['18-24','25-34','35-44'],
  ARRAY['morning','afternoon'],
  'Great coffee with a greater mission — 4.6★ Deep Ellum cafe employing youth from foster care.',
  88,
  'loop_team',
  true
),

-- 14. Ascension Coffee
(
  'Dallas',
  'TX',
  'Ascension Coffee',
  '{"id":"ascension","name":"Ascension Coffee","category":"cafe","description":"Upscale coffee and brunch spot with a beautiful Design District location.","location":{"latitude":32.7918,"longitude":-96.8198,"address":"1621 Oak Lawn Ave, Dallas, TX 75207","city":"Dallas","state":"TX"},"rating":4.4,"reviewsCount":3100,"priceRange":2}'::jsonb,
  ARRAY['Coffee & Cafes','Dining'],
  ARRAY['25-34','35-44','45+'],
  ARRAY['morning','afternoon'],
  'Design District elegance — 4.4★. Craft coffee, stunning brunch, and Instagram-worthy interiors.',
  82,
  'loop_team',
  true
),

-- 15. Davis Street Espresso
(
  'Dallas',
  'TX',
  'Davis Street Espresso',
  '{"id":"davis-street","name":"Davis Street Espresso","category":"cafe","description":"Oak Cliff staple with direct-trade espresso and community vibe.","location":{"latitude":32.7475,"longitude":-96.8269,"address":"819 W Davis St, Dallas, TX 75208","city":"Dallas","state":"TX"},"rating":4.5,"reviewsCount":900,"priceRange":1}'::jsonb,
  ARRAY['Coffee & Cafes'],
  ARRAY['18-24','25-34','35-44'],
  ARRAY['morning','afternoon'],
  'Oak Cliff staple — 4.5★ direct-trade espresso with real neighborhood character.',
  80,
  'loop_team',
  true
),

-- 16. Opening Bell Coffee
(
  'Dallas',
  'TX',
  'Opening Bell Coffee',
  '{"id":"opening-bell","name":"Opening Bell Coffee","category":"cafe","description":"Non-profit coffee shop in a converted 1903 church. Live music and community events.","location":{"latitude":32.7532,"longitude":-96.8305,"address":"1409 S Lamar St, Dallas, TX 75215","city":"Dallas","state":"TX"},"rating":4.5,"reviewsCount":1100,"priceRange":1}'::jsonb,
  ARRAY['Coffee & Cafes','Live Music'],
  ARRAY['18-24','25-34','35-44'],
  ARRAY['morning','afternoon','evening'],
  'Non-profit cafe in a 1903 church — 4.5★. Live music, community events, and soul-warming coffee.',
  78,
  'loop_team',
  true
),

-- ============================================================================
-- BARS & NIGHTLIFE (5)
-- ============================================================================

-- 17. Midnight Rambler
(
  'Dallas',
  'TX',
  'Midnight Rambler',
  '{"id":"midnight-rambler","name":"Midnight Rambler","category":"bar","description":"Subterranean cocktail bar beneath The Joule hotel. Sophisticated speakeasy vibes.","location":{"latitude":32.7816,"longitude":-96.7981,"address":"1530 Main St, Dallas, TX 75201","city":"Dallas","state":"TX"},"rating":4.5,"reviewsCount":1900,"priceRange":3}'::jsonb,
  ARRAY['Bars & Nightlife'],
  ARRAY['25-34','35-44'],
  ARRAY['evening','night'],
  'Underground speakeasy beneath The Joule — 4.5★. Some of the best cocktails in Texas, period.',
  92,
  'loop_team',
  true
),

-- 18. Deep Ellum Brewing Company
(
  'Dallas',
  'TX',
  'Deep Ellum Brewing Company',
  '{"id":"deep-ellum-brewing","name":"Deep Ellum Brewing Company","category":"brewery","description":"Dallas-born craft brewery with taproom, food trucks, and live music.","location":{"latitude":32.78,"longitude":-96.775,"address":"2823 St Louis St, Dallas, TX 75226","city":"Dallas","state":"TX"},"rating":4.5,"reviewsCount":3200,"priceRange":2}'::jsonb,
  ARRAY['Bars & Nightlife'],
  ARRAY['18-24','25-34','35-44'],
  ARRAY['afternoon','evening','night'],
  'Dallas-born craft brewery — 4.5★. Great taproom, rotating food trucks, and weekend live music.',
  85,
  'loop_team',
  true
),

-- 19. The Adolphus Rooftop
(
  'Dallas',
  'TX',
  'The Adolphus Rooftop',
  '{"id":"adolphus-rooftop","name":"The Adolphus Rooftop","category":"bar","description":"Rooftop pool and cocktail bar atop the historic Adolphus Hotel with skyline views.","location":{"latitude":32.7807,"longitude":-96.7971,"address":"1321 Commerce St, Dallas, TX 75202","city":"Dallas","state":"TX"},"rating":4.3,"reviewsCount":1500,"priceRange":3}'::jsonb,
  ARRAY['Bars & Nightlife'],
  ARRAY['25-34','35-44','45+'],
  ARRAY['evening','night'],
  'Dallas skyline views from a historic rooftop — 4.3★. The sunset cocktails here are unbeatable.',
  88,
  'loop_team',
  true
),

-- 20. Bitter Sisters Brewing
(
  'Dallas',
  'TX',
  'Bitter Sisters Brewing',
  '{"id":"bitter-sisters","name":"Bitter Sisters Brewing","category":"brewery","description":"Women-owned craft brewery in Addison with creative seasonal brews.","location":{"latitude":32.9592,"longitude":-96.8332,"address":"14424 Midway Rd, Addison, TX 75001","city":"Dallas","state":"TX"},"rating":4.4,"reviewsCount":800,"priceRange":1}'::jsonb,
  ARRAY['Bars & Nightlife'],
  ARRAY['25-34','35-44'],
  ARRAY['afternoon','evening'],
  'Women-owned craft brewery — 4.4★. Creative seasonal brews and a welcoming taproom vibe.',
  75,
  'loop_team',
  true
),

-- 21. Cidercade Dallas
(
  'Dallas',
  'TX',
  'Cidercade Dallas',
  '{"id":"cidercade","name":"Cidercade Dallas","category":"bar","description":"150+ free-play arcade games with craft ciders. Gaming meets drinking.","location":{"latitude":32.7757,"longitude":-96.8113,"address":"2777 Irving Blvd, Dallas, TX 75207","city":"Dallas","state":"TX"},"rating":4.6,"reviewsCount":4500,"priceRange":1}'::jsonb,
  ARRAY['Bars & Nightlife','Entertainment'],
  ARRAY['18-24','25-34'],
  ARRAY['evening','night'],
  '150+ free-play arcade games with craft ciders — 4.6★. The most fun you can have for $12 admission.',
  90,
  'loop_team',
  true
),

-- ============================================================================
-- ENTERTAINMENT (5)
-- ============================================================================

-- 22. Alamo Drafthouse Cinema
(
  'Dallas',
  'TX',
  'Alamo Drafthouse Cinema',
  '{"id":"alamo-drafthouse","name":"Alamo Drafthouse Cinema","category":"movie_theater","description":"Dine-in cinema with craft beer, food service, and strict no-talking policy.","location":{"latitude":32.7788,"longitude":-96.8016,"address":"1005 S Lamar St, Dallas, TX 75215","city":"Dallas","state":"TX"},"rating":4.4,"reviewsCount":3800,"priceRange":2}'::jsonb,
  ARRAY['Entertainment','Movies'],
  ARRAY['18-24','25-34','35-44'],
  ARRAY['afternoon','evening','night'],
  'The ultimate movie experience — 4.4★. Dine-in cinema with strict no-talking policy. Movie lovers'' paradise.',
  88,
  'loop_team',
  true
),

-- 23. TopGolf Dallas
(
  'Dallas',
  'TX',
  'TopGolf Dallas',
  '{"id":"topgolf-dallas","name":"TopGolf Dallas","category":"entertainment","description":"High-tech driving range with food, drinks, and games.","location":{"latitude":32.8542,"longitude":-96.8517,"address":"8787 Park Ln, Dallas, TX 75231","city":"Dallas","state":"TX"},"rating":4.3,"reviewsCount":9200,"priceRange":2}'::jsonb,
  ARRAY['Entertainment','Sports'],
  ARRAY['18-24','25-34','35-44'],
  ARRAY['afternoon','evening'],
  'Even non-golfers love it — 4.3★ with 9K+ reviews. Perfect group activity with food, drinks, and competition.',
  85,
  'loop_team',
  true
),

-- 24. SODA Bar & Arcade
(
  'Dallas',
  'TX',
  'SODA Bar & Arcade',
  '{"id":"soda-bar","name":"SODA Bar & Arcade","category":"arcade","description":"Retro arcade bar in Deep Ellum with classic games and craft cocktails.","location":{"latitude":32.7843,"longitude":-96.7835,"address":"2618 Main St, Dallas, TX 75226","city":"Dallas","state":"TX"},"rating":4.2,"reviewsCount":500,"priceRange":2}'::jsonb,
  ARRAY['Entertainment','Bars & Nightlife'],
  ARRAY['18-24','25-34'],
  ARRAY['evening','night'],
  'Retro arcade meets cocktail bar in Deep Ellum — 4.2★. Pac-Man + craft cocktails = perfect date night.',
  78,
  'loop_team',
  true
),

-- 25. Texas Live!
(
  'Dallas',
  'TX',
  'Texas Live!',
  '{"id":"texas-live","name":"Texas Live!","category":"entertainment","description":"Entertainment complex near AT&T Stadium with multiple venues, restaurants, and live events.","location":{"latitude":32.7474,"longitude":-97.0935,"address":"1650 E Randol Mill Rd, Arlington, TX 76011","city":"Dallas","state":"TX"},"rating":4.2,"reviewsCount":6100,"priceRange":2}'::jsonb,
  ARRAY['Entertainment','Dining','Sports'],
  ARRAY['18-24','25-34','35-44'],
  ARRAY['afternoon','evening','night'],
  'Entertainment complex near AT&T Stadium — 4.2★. Multiple venues, game day energy, and always something happening.',
  75,
  'loop_team',
  true
),

-- 26. Comedy Arena
(
  'Dallas',
  'TX',
  'Comedy Arena',
  '{"id":"comedy-arena","name":"Dallas Comedy Club","category":"comedy_club","description":"Local improv and stand-up comedy club with nightly shows.","location":{"latitude":32.7844,"longitude":-96.7844,"address":"3036 Elm St, Dallas, TX 75226","city":"Dallas","state":"TX"},"rating":4.6,"reviewsCount":800,"priceRange":1}'::jsonb,
  ARRAY['Entertainment'],
  ARRAY['18-24','25-34','35-44'],
  ARRAY['evening','night'],
  'Improv & stand-up in Deep Ellum — 4.6★. Affordable shows with genuine laughs. Great date night idea.',
  82,
  'loop_team',
  true
),

-- ============================================================================
-- OUTDOOR ACTIVITIES (4)
-- ============================================================================

-- 27. White Rock Lake Park
(
  'Dallas',
  'TX',
  'White Rock Lake Park',
  '{"id":"white-rock-lake","name":"White Rock Lake Park","category":"park","description":"Urban lake park with 9-mile trail, kayaking, and skyline views.","location":{"latitude":32.823,"longitude":-96.727,"address":"8300 E Lawther Dr, Dallas, TX 75218","city":"Dallas","state":"TX"},"rating":4.7,"reviewsCount":15000,"priceRange":0}'::jsonb,
  ARRAY['Outdoor Activities'],
  ARRAY['18-24','25-34','35-44','45+'],
  ARRAY['morning','afternoon'],
  'Dallas''s crown jewel park — 4.7★ with 15K reviews. 9-mile trail, kayaking, and stunning skyline views. Free.',
  95,
  'loop_team',
  true
),

-- 28. Katy Trail
(
  'Dallas',
  'TX',
  'Katy Trail',
  '{"id":"katy-trail","name":"Katy Trail","category":"hiking_area","description":"3.5-mile converted rail trail through Uptown. Dallas''s most popular running/biking path.","location":{"latitude":32.8084,"longitude":-96.8063,"address":"3601 Turtle Creek Blvd, Dallas, TX 75219","city":"Dallas","state":"TX"},"rating":4.7,"reviewsCount":8500,"priceRange":0}'::jsonb,
  ARRAY['Outdoor Activities','Fitness'],
  ARRAY['18-24','25-34','35-44','45+'],
  ARRAY['morning','afternoon'],
  'Dallas''s favorite trail — 4.7★. 3.5 miles through Uptown for running, biking, or dog walking. Free.',
  92,
  'loop_team',
  true
),

-- 29. Klyde Warren Park
(
  'Dallas',
  'TX',
  'Klyde Warren Park',
  '{"id":"klyde-warren","name":"Klyde Warren Park","category":"park","description":"Urban deck park built over a freeway with food trucks, yoga, and events.","location":{"latitude":32.7892,"longitude":-96.8014,"address":"2012 Woodall Rodgers Fwy, Dallas, TX 75201","city":"Dallas","state":"TX"},"rating":4.7,"reviewsCount":18000,"priceRange":0}'::jsonb,
  ARRAY['Outdoor Activities'],
  ARRAY['18-24','25-34','35-44','45+'],
  ARRAY['morning','afternoon','evening'],
  'Park built over a freeway — 4.7★ with 18K reviews. Free yoga, food trucks, games, and people-watching.',
  93,
  'loop_team',
  true
),

-- 30. Trinity River Audubon Center
(
  'Dallas',
  'TX',
  'Trinity River Audubon Center',
  '{"id":"trinity-audubon","name":"Trinity River Audubon Center","category":"nature_reserve","description":"120 acres of wetlands with hiking trails and birdwatching just minutes from downtown.","location":{"latitude":32.6961,"longitude":-96.7437,"address":"6500 Great Trinity Forest Way, Dallas, TX 75217","city":"Dallas","state":"TX"},"rating":4.6,"reviewsCount":1200,"priceRange":0}'::jsonb,
  ARRAY['Outdoor Activities'],
  ARRAY['25-34','35-44','45+'],
  ARRAY['morning','afternoon'],
  '120 acres of nature minutes from downtown — 4.6★. Stunning wetland trails and birdwatching. A local secret.',
  80,
  'loop_team',
  true
),

-- ============================================================================
-- FITNESS (4)
-- ============================================================================

-- 31. Equinox Highland Park
(
  'Dallas',
  'TX',
  'Equinox Highland Park',
  '{"id":"equinox-hp","name":"Equinox Highland Park","category":"gym","description":"Luxury fitness club with state-of-the-art equipment and group classes.","location":{"latitude":32.8335,"longitude":-96.803,"address":"4023 Oak Lawn Ave, Dallas, TX 75219","city":"Dallas","state":"TX"},"rating":4.3,"reviewsCount":600,"priceRange":3}'::jsonb,
  ARRAY['Fitness'],
  ARRAY['25-34','35-44'],
  ARRAY['morning','afternoon','evening'],
  'Premium fitness experience — 4.3★. Top-tier equipment, spa, and group classes in Highland Park.',
  80,
  'loop_team',
  true
),

-- 32. Sunstone Yoga
(
  'Dallas',
  'TX',
  'Sunstone Yoga',
  '{"id":"sunstone-yoga","name":"Sunstone Yoga","category":"yoga_studio","description":"Hot yoga studio with multiple class types from beginner to advanced.","location":{"latitude":32.8201,"longitude":-96.7955,"address":"5600 W Lovers Ln, Dallas, TX 75209","city":"Dallas","state":"TX"},"rating":4.6,"reviewsCount":450,"priceRange":2}'::jsonb,
  ARRAY['Fitness','Wellness'],
  ARRAY['18-24','25-34','35-44','45+'],
  ARRAY['morning','afternoon','evening'],
  'Hot yoga haven — 4.6★. Multiple class styles from gentle flow to power yoga. Great for beginners.',
  82,
  'loop_team',
  true
),

-- 33. Peloton Studios Dallas
(
  'Dallas',
  'TX',
  'Peloton Studios Dallas',
  '{"id":"peloton-dallas","name":"Peloton Studios Dallas","category":"cycling_studio","description":"Peloton''s second-ever studio location with live classes and retail.","location":{"latitude":32.792,"longitude":-96.805,"address":"2300 N Field St, Dallas, TX 75201","city":"Dallas","state":"TX"},"rating":4.8,"reviewsCount":300,"priceRange":2}'::jsonb,
  ARRAY['Fitness'],
  ARRAY['18-24','25-34','35-44'],
  ARRAY['morning','afternoon'],
  'Peloton''s 2nd-ever studio — 4.8★. Take live classes with real instructors. A bucket-list fitness experience.',
  85,
  'loop_team',
  true
),

-- 34. GRIT Fitness
(
  'Dallas',
  'TX',
  'GRIT Fitness',
  '{"id":"grit-fitness","name":"GRIT Fitness","category":"fitness_center","description":"Women-focused boutique fitness with HIIT, boxing, and barre classes.","location":{"latitude":32.8133,"longitude":-96.7951,"address":"3106 N Henderson Ave, Dallas, TX 75206","city":"Dallas","state":"TX"},"rating":4.8,"reviewsCount":350,"priceRange":2}'::jsonb,
  ARRAY['Fitness'],
  ARRAY['18-24','25-34','35-44'],
  ARRAY['morning','afternoon','evening'],
  'Women-focused boutique fitness — 4.8★. HIIT, boxing, and barre that will push your limits.',
  78,
  'loop_team',
  true
),

-- ============================================================================
-- ARTS & CULTURE (4)
-- ============================================================================

-- 35. Dallas Museum of Art
(
  'Dallas',
  'TX',
  'Dallas Museum of Art',
  '{"id":"dma","name":"Dallas Museum of Art","category":"museum","description":"World-class art museum with free general admission. 24,000+ works spanning 5,000 years.","location":{"latitude":32.7877,"longitude":-96.8009,"address":"1717 N Harwood St, Dallas, TX 75201","city":"Dallas","state":"TX"},"rating":4.6,"reviewsCount":12000,"priceRange":0}'::jsonb,
  ARRAY['Arts & Culture'],
  ARRAY['18-24','25-34','35-44','45+'],
  ARRAY['morning','afternoon'],
  'World-class art, always free — 4.6★ with 12K reviews. 24,000 works spanning 5,000 years of human creativity.',
  93,
  'loop_team',
  true
),

-- 36. Nasher Sculpture Center
(
  'Dallas',
  'TX',
  'Nasher Sculpture Center',
  '{"id":"nasher","name":"Nasher Sculpture Center","category":"art_gallery","description":"Renzo Piano-designed museum with modern sculpture in a stunning garden setting.","location":{"latitude":32.7888,"longitude":-96.8002,"address":"2001 Flora St, Dallas, TX 75201","city":"Dallas","state":"TX"},"rating":4.6,"reviewsCount":5200,"priceRange":2}'::jsonb,
  ARRAY['Arts & Culture'],
  ARRAY['25-34','35-44','45+'],
  ARRAY['morning','afternoon'],
  'Renzo Piano-designed masterpiece — 4.6★. Modern sculpture in a garden that feels like its own artwork.',
  88,
  'loop_team',
  true
),

-- 37. The Sixth Floor Museum
(
  'Dallas',
  'TX',
  'The Sixth Floor Museum',
  '{"id":"sixth-floor","name":"The Sixth Floor Museum at Dealey Plaza","category":"museum","description":"JFK assassination site museum — a powerful historical experience.","location":{"latitude":32.7799,"longitude":-96.8083,"address":"411 Elm St, Dallas, TX 75202","city":"Dallas","state":"TX"},"rating":4.6,"reviewsCount":22000,"priceRange":2}'::jsonb,
  ARRAY['Arts & Culture'],
  ARRAY['18-24','25-34','35-44','45+'],
  ARRAY['morning','afternoon'],
  'Where history happened — 4.6★ with 22K reviews. The JFK assassination site is a must-visit experience.',
  90,
  'loop_team',
  true
),

-- 38. Dallas Contemporary
(
  'Dallas',
  'TX',
  'Dallas Contemporary',
  '{"id":"dallas-contemporary","name":"Dallas Contemporary","category":"art_gallery","description":"Free contemporary art museum with bold, rotating exhibitions.","location":{"latitude":32.7904,"longitude":-96.8136,"address":"161 Glass St, Dallas, TX 75207","city":"Dallas","state":"TX"},"rating":4.4,"reviewsCount":600,"priceRange":0}'::jsonb,
  ARRAY['Arts & Culture'],
  ARRAY['18-24','25-34','35-44'],
  ARRAY['morning','afternoon'],
  'Free contemporary art that pushes boundaries — 4.4★. Bold rotating exhibitions you won''t find elsewhere.',
  78,
  'loop_team',
  true
),

-- ============================================================================
-- SHOPPING (3)
-- ============================================================================

-- 39. NorthPark Center
(
  'Dallas',
  'TX',
  'NorthPark Center',
  '{"id":"northpark","name":"NorthPark Center","category":"shopping_mall","description":"Iconic luxury shopping center with museum-quality art displays throughout.","location":{"latitude":32.8686,"longitude":-96.7725,"address":"8687 N Central Expy, Dallas, TX 75225","city":"Dallas","state":"TX"},"rating":4.6,"reviewsCount":25000,"priceRange":3}'::jsonb,
  ARRAY['Shopping'],
  ARRAY['18-24','25-34','35-44','45+'],
  ARRAY['morning','afternoon','evening'],
  'Dallas''s iconic luxury mall — 4.6★ with 25K reviews. Museum-quality art between Gucci and Nordstrom.',
  88,
  'loop_team',
  true
),

-- 40. Deep Ellum Murals & Shops
(
  'Dallas',
  'TX',
  'Deep Ellum Murals & Shops',
  '{"id":"deep-ellum-shops","name":"Deep Ellum Murals & Shops","category":"shopping_mall","description":"Walkable arts district with indie shops, vintage stores, and world-class street art.","location":{"latitude":32.7843,"longitude":-96.7835,"address":"Main St & Elm St, Dallas, TX 75226","city":"Dallas","state":"TX"},"rating":4.5,"reviewsCount":3500,"priceRange":1}'::jsonb,
  ARRAY['Shopping','Arts & Culture'],
  ARRAY['18-24','25-34'],
  ARRAY['afternoon','evening'],
  'Indie shops, vintage finds, and world-class street art — 4.5★. Deep Ellum is Dallas''s creative heartbeat.',
  85,
  'loop_team',
  true
),

-- 41. Dallas Farmers Market
(
  'Dallas',
  'TX',
  'Dallas Farmers Market',
  '{"id":"farmers-market","name":"Dallas Farmers Market","category":"farmers_market","description":"Year-round open-air market with local produce, artisan goods, and food stalls.","location":{"latitude":32.774,"longitude":-96.795,"address":"920 S Harwood St, Dallas, TX 75201","city":"Dallas","state":"TX"},"rating":4.4,"reviewsCount":7500,"priceRange":1}'::jsonb,
  ARRAY['Shopping','Dining'],
  ARRAY['25-34','35-44','45+'],
  ARRAY['morning','afternoon'],
  'Year-round local market — 4.4★. Fresh produce, artisan goods, and incredible food stalls every weekend.',
  82,
  'loop_team',
  true
),

-- ============================================================================
-- LIVE MUSIC (3)
-- ============================================================================

-- 42. Trees
(
  'Dallas',
  'TX',
  'Trees',
  '{"id":"trees-dallas","name":"Trees","category":"live_music_venue","description":"Legendary Deep Ellum music venue since 1990. Intimate setting for live bands.","location":{"latitude":32.7846,"longitude":-96.785,"address":"2709 Elm St, Dallas, TX 75226","city":"Dallas","state":"TX"},"rating":4.3,"reviewsCount":2500,"priceRange":1}'::jsonb,
  ARRAY['Live Music','Entertainment'],
  ARRAY['18-24','25-34','35-44'],
  ARRAY['evening','night'],
  'Deep Ellum legend since 1990 — 4.3★. Intimate live music venue where every show feels electric.',
  88,
  'loop_team',
  true
),

-- 43. The Kessler Theater
(
  'Dallas',
  'TX',
  'The Kessler Theater',
  '{"id":"kessler","name":"The Kessler Theater","category":"performing_arts_theater","description":"Restored 1940s Art Deco theater hosting indie and folk concerts.","location":{"latitude":32.7424,"longitude":-96.8277,"address":"1230 W Davis St, Dallas, TX 75208","city":"Dallas","state":"TX"},"rating":4.7,"reviewsCount":1800,"priceRange":2}'::jsonb,
  ARRAY['Live Music','Entertainment'],
  ARRAY['25-34','35-44','45+'],
  ARRAY['evening','night'],
  'Restored 1940s Art Deco theater — 4.7★. Intimate indie and folk shows in one of Dallas''s most beautiful venues.',
  90,
  'loop_team',
  true
),

-- 44. Ruins
(
  'Dallas',
  'TX',
  'Ruins',
  '{"id":"ruins-dallas","name":"Ruins","category":"live_music_venue","description":"Eclectic Deep Ellum bar with live DJs, vinyl nights, and an epic patio.","location":{"latitude":32.7844,"longitude":-96.7832,"address":"2653 Commerce St, Dallas, TX 75226","city":"Dallas","state":"TX"},"rating":4.4,"reviewsCount":700,"priceRange":1}'::jsonb,
  ARRAY['Live Music','Bars & Nightlife'],
  ARRAY['18-24','25-34'],
  ARRAY['evening','night'],
  'Deep Ellum''s most eclectic bar — 4.4★. Live DJs, vinyl nights, and a patio that goes until 2am.',
  82,
  'loop_team',
  true
),

-- ============================================================================
-- SPORTS (3)
-- ============================================================================

-- 45. American Airlines Center
(
  'Dallas',
  'TX',
  'American Airlines Center',
  '{"id":"aac","name":"American Airlines Center","category":"stadium","description":"Home of the Dallas Mavericks and Dallas Stars. World-class sports and concert venue.","location":{"latitude":32.7906,"longitude":-96.8103,"address":"2500 Victory Ave, Dallas, TX 75219","city":"Dallas","state":"TX"},"rating":4.6,"reviewsCount":35000,"priceRange":3}'::jsonb,
  ARRAY['Sports','Entertainment'],
  ARRAY['18-24','25-34','35-44','45+'],
  ARRAY['evening','night'],
  'Home of the Mavs & Stars — 4.6★ with 35K reviews. Electric game day atmosphere in Victory Park.',
  92,
  'loop_team',
  true
),

-- 46. Globe Life Field
(
  'Dallas',
  'TX',
  'Globe Life Field',
  '{"id":"globe-life","name":"Globe Life Field","category":"stadium","description":"Home of the Texas Rangers with retractable roof and modern amenities.","location":{"latitude":32.7513,"longitude":-97.0827,"address":"734 Stadium Dr, Arlington, TX 76011","city":"Dallas","state":"TX"},"rating":4.5,"reviewsCount":18000,"priceRange":3}'::jsonb,
  ARRAY['Sports'],
  ARRAY['18-24','25-34','35-44','45+'],
  ARRAY['afternoon','evening'],
  'Home of the Rangers — 4.5★ with 18K reviews. Climate-controlled baseball perfection.',
  85,
  'loop_team',
  true
),

-- 47. FC Dallas - Toyota Stadium
(
  'Dallas',
  'TX',
  'FC Dallas - Toyota Stadium',
  '{"id":"toyota-stadium","name":"Toyota Stadium","category":"stadium","description":"Home of FC Dallas MLS team with soccer-specific design and great sightlines.","location":{"latitude":33.1543,"longitude":-96.8349,"address":"9200 World Cup Way, Frisco, TX 75033","city":"Dallas","state":"TX"},"rating":4.3,"reviewsCount":5500,"priceRange":2}'::jsonb,
  ARRAY['Sports'],
  ARRAY['18-24','25-34','35-44'],
  ARRAY['afternoon','evening'],
  'MLS soccer atmosphere — 4.3★. Affordable tickets, great sightlines, and real match day energy.',
  78,
  'loop_team',
  true
),

-- ============================================================================
-- WELLNESS (3)
-- ============================================================================

-- 48. Spa Nordstrom at NorthPark
(
  'Dallas',
  'TX',
  'Spa Nordstrom at NorthPark',
  '{"id":"spa-nordstrom","name":"Spa Nordstrom","category":"spa","description":"Luxurious spa inside NorthPark Center with massage, facials, and beauty services.","location":{"latitude":32.8686,"longitude":-96.7725,"address":"8687 N Central Expy, Dallas, TX 75225","city":"Dallas","state":"TX"},"rating":4.4,"reviewsCount":500,"priceRange":3}'::jsonb,
  ARRAY['Wellness'],
  ARRAY['25-34','35-44','45+'],
  ARRAY['morning','afternoon'],
  'Luxury spa in NorthPark — 4.4★. Massages, facials, and pampering between shopping trips.',
  80,
  'loop_team',
  true
),

-- 49. The Ritz-Carlton Spa Dallas
(
  'Dallas',
  'TX',
  'The Ritz-Carlton Spa Dallas',
  '{"id":"ritz-spa","name":"The Ritz-Carlton Spa","category":"spa","description":"Five-star spa experience with signature treatments and relaxation lounge.","location":{"latitude":32.799,"longitude":-96.8038,"address":"2121 McKinney Ave, Dallas, TX 75201","city":"Dallas","state":"TX"},"rating":4.5,"reviewsCount":300,"priceRange":3}'::jsonb,
  ARRAY['Wellness'],
  ARRAY['35-44','45+'],
  ARRAY['morning','afternoon'],
  'Five-star spa experience — 4.5★. Signature treatments and total relaxation in the heart of Uptown.',
  78,
  'loop_team',
  true
),

-- 50. Russian & Turkish Baths Dallas
(
  'Dallas',
  'TX',
  'Russian & Turkish Baths Dallas',
  '{"id":"russian-baths","name":"King Spa & Sauna","category":"spa","description":"Korean-style jimjilbang spa with saunas, pools, and overnight stays.","location":{"latitude":32.9271,"longitude":-96.8932,"address":"2154 Royal Ln, Dallas, TX 75229","city":"Dallas","state":"TX"},"rating":4.2,"reviewsCount":3000,"priceRange":2}'::jsonb,
  ARRAY['Wellness','Fitness'],
  ARRAY['18-24','25-34','35-44','45+'],
  ARRAY['morning','afternoon','evening'],
  'Korean-style spa with saunas, pools, and overnight stays — 4.2★. Full day of relaxation for under $40.',
  85,
  'loop_team',
  true
);
