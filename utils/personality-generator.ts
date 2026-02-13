/**
 * AI Personality Generator
 *
 * Pure function that generates a personality summary from user data.
 * No API calls - uses template-based generation for ~80+ unique combinations.
 *
 * Output:
 *   title:    "The {Modifier} {Archetype}" (e.g. "The Night Owl Foodie")
 *   subtitle: Template sentence
 *   traits:   First 3 interests as pill labels
 */

export interface PersonalityInput {
  interests: string[];
  aiProfile: {
    budget_level?: number;
    preferred_distance_miles?: number;
    time_preferences?: string[];
    favorite_categories?: string[];
    distance_tolerance?: string;
  } | null;
  feedbackCount: number;
  streakDays: number;
  loopScore: number;
}

export interface PersonalitySummary {
  title: string;
  subtitle: string;
  traits: string[];
}

// ---- Interest-to-group mapping ----

const INTEREST_GROUP_MAP: Record<string, string> = {
  // Food
  'Dining': 'Food',
  'Coffee & Cafes': 'Food',
  'Bars & Nightlife': 'Food',
  'Desserts & Treats': 'Food',
  'dining': 'Food',
  'coffee': 'Food',
  'bars': 'Food',
  'desserts': 'Food',

  // Entertainment
  'Live Music': 'Entertainment',
  'Movies & Cinema': 'Entertainment',
  'Comedy & Theater': 'Entertainment',
  'Gaming': 'Entertainment',
  'live music': 'Entertainment',
  'movies': 'Entertainment',
  'comedy': 'Entertainment',
  'gaming': 'Entertainment',
  'live_music': 'Entertainment',

  // Fitness
  'Fitness & Gym': 'Fitness',
  'Outdoor Sports': 'Fitness',
  'Yoga & Mindfulness': 'Fitness',
  'fitness': 'Fitness',
  'outdoor sports': 'Fitness',
  'yoga': 'Fitness',

  // Outdoor
  'Parks & Nature': 'Outdoor',
  'Hiking & Trails': 'Outdoor',
  'parks': 'Outdoor',
  'hiking': 'Outdoor',

  // Arts
  'Museums & Art': 'Arts',
  'Photography': 'Arts',
  'museums': 'Arts',
  'art': 'Arts',
  'photography': 'Arts',

  // Shopping
  'Shopping': 'Shopping',
  'Beauty & Spa': 'Shopping',
  'shopping': 'Shopping',
  'beauty': 'Shopping',

  // Music (distinct from Entertainment for archetype)
  'music': 'Music',
  'concerts': 'Music',
};

// ---- Archetype from dominant interest group ----

const GROUP_ARCHETYPE: Record<string, string> = {
  Food: 'Foodie',
  Entertainment: 'Culture Buff',
  Fitness: 'Fitness Fanatic',
  Outdoor: 'Adventure Seeker',
  Arts: 'Creative Soul',
  Shopping: 'Trend Hunter',
  Music: 'Music Lover',
};

function getDominantGroup(interests: string[]): string {
  const counts: Record<string, number> = {};

  for (const interest of interests) {
    const group = INTEREST_GROUP_MAP[interest] || INTEREST_GROUP_MAP[interest.toLowerCase()];
    if (group) {
      counts[group] = (counts[group] || 0) + 1;
    }
  }

  let maxGroup = '';
  let maxCount = 0;
  for (const [group, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      maxGroup = group;
    }
  }

  return maxGroup || 'Mixed';
}

export function getArchetype(interests: string[]): string {
  const group = getDominantGroup(interests);
  return GROUP_ARCHETYPE[group] || 'Explorer';
}

// ---- Modifier (first match wins) ----

export function getModifier(input: PersonalityInput): string {
  const timePrefs = input.aiProfile?.time_preferences || [];
  const budgetLevel = input.aiProfile?.budget_level ?? 2;
  const distanceTolerance = input.aiProfile?.distance_tolerance || 'medium';

  if (timePrefs.includes('evening') || timePrefs.includes('night')) return 'Night Owl';
  if (timePrefs.includes('morning')) return 'Early Bird';
  if (input.streakDays >= 7) return 'Dedicated';
  if (budgetLevel <= 1) return 'Budget-Savvy';
  if (budgetLevel >= 3) return 'Premium';
  if (distanceTolerance === 'low') return 'Local';
  if (input.feedbackCount >= 20) return 'Seasoned';
  if (input.loopScore >= 400) return 'Legendary';
  return 'Weekend';
}

// ---- Subtitle templates ----

const SUBTITLE_TEMPLATES: Record<string, Record<string, string>> = {
  'Night Owl': {
    Foodie: 'Lives for late-night bites and hidden gems',
    'Culture Buff': 'Catches every late show and midnight premiere',
    'Fitness Fanatic': 'Hits the gym when the city sleeps',
    'Adventure Seeker': 'Explores under the stars',
    'Creative Soul': 'Finds inspiration in the quiet hours',
    'Trend Hunter': 'Shops the after-hours sales',
    'Music Lover': 'Chases live sets until closing time',
    Explorer: 'Comes alive when the sun goes down',
  },
  'Early Bird': {
    Foodie: 'First in line at every brunch spot',
    'Culture Buff': 'Catches the morning matinee before anyone else',
    'Fitness Fanatic': 'Sunrise workouts are non-negotiable',
    'Adventure Seeker': 'Hits the trail at dawn',
    'Creative Soul': 'Creates best work before coffee cools',
    'Trend Hunter': 'Gets the deals before they are gone',
    'Music Lover': 'Morning playlists set the vibe for the day',
    Explorer: 'Gets more done before 9am than most do all day',
  },
  Dedicated: {
    Foodie: 'Never misses a meal worth savoring',
    'Culture Buff': 'Shows up every single day for the culture',
    'Fitness Fanatic': 'Streak game is unmatched',
    'Adventure Seeker': 'Keeps the adventure streak alive',
    'Creative Soul': 'Creates something new every day',
    'Trend Hunter': 'Stays on top of every trend',
    'Music Lover': 'Listens, discovers, repeats daily',
    Explorer: 'Exploring is a daily habit',
  },
  'Budget-Savvy': {
    Foodie: 'Finds the best eats without breaking the bank',
    'Culture Buff': 'Proves great experiences do not need big budgets',
    'Fitness Fanatic': 'Stays fit on a shoestring',
    'Adventure Seeker': 'Adventures on a budget, memories for free',
    'Creative Soul': 'Creativity costs nothing',
    'Trend Hunter': 'Master of the deal hunt',
    'Music Lover': 'Finds free shows and open mics',
    Explorer: 'Discovers hidden gems that cost nothing',
  },
  Premium: {
    Foodie: 'Only the finest dining will do',
    'Culture Buff': 'VIP experiences are the only way',
    'Fitness Fanatic': 'Trains with the best equipment and coaches',
    'Adventure Seeker': 'Goes big on every adventure',
    'Creative Soul': 'Invests in premium creative tools',
    'Trend Hunter': 'First to grab the latest drops',
    'Music Lover': 'Front row seats or nothing',
    Explorer: 'Explores in style, no compromises',
  },
  Local: {
    Foodie: 'Knows every neighborhood spot by name',
    'Culture Buff': 'Champion of the local scene',
    'Fitness Fanatic': 'The neighborhood gym is home base',
    'Adventure Seeker': 'Proves adventure is just around the corner',
    'Creative Soul': 'Draws inspiration from the block',
    'Trend Hunter': 'Supports local boutiques first',
    'Music Lover': 'Roots for the local music scene',
    Explorer: 'Finds wonder within walking distance',
  },
  Seasoned: {
    Foodie: 'Has reviewed it all and knows what is good',
    'Culture Buff': 'Seen enough to be a true critic',
    'Fitness Fanatic': 'Seasoned veteran of every workout',
    'Adventure Seeker': 'A well-traveled path-finder',
    'Creative Soul': 'Years of experience fuel the craft',
    'Trend Hunter': 'Knows a trend before it trends',
    'Music Lover': 'Has the playlists to prove it',
    Explorer: 'Experience makes every outing count',
  },
  Legendary: {
    Foodie: 'A culinary legend in the making',
    'Culture Buff': 'Walking cultural encyclopedia',
    'Fitness Fanatic': 'Legendary dedication to the grind',
    'Adventure Seeker': 'Tales of adventure precede them',
    'Creative Soul': 'A legend of the creative world',
    'Trend Hunter': 'Legendary taste, impeccable style',
    'Music Lover': 'A living legend of the music scene',
    Explorer: 'A legend who never stops exploring',
  },
  Weekend: {
    Foodie: 'Weekends are made for discovering new flavors',
    'Culture Buff': 'Weekend warrior of arts and culture',
    'Fitness Fanatic': 'Weekend warrior who crushes workouts',
    'Adventure Seeker': 'Lives for weekend adventures',
    'Creative Soul': 'Weekends are for creating and dreaming',
    'Trend Hunter': 'Weekend shopping sprees are a lifestyle',
    'Music Lover': 'Weekend festival-goer at heart',
    Explorer: 'Makes the most of every weekend',
  },
};

function getSubtitle(modifier: string, archetype: string): string {
  const modTemplates = SUBTITLE_TEMPLATES[modifier];
  if (modTemplates) {
    return modTemplates[archetype] || modTemplates['Explorer'] || 'Always discovering something new';
  }
  return 'Always discovering something new';
}

// ---- Main export ----

export function generatePersonalitySummary(input: PersonalityInput): PersonalitySummary {
  const modifier = getModifier(input);
  const archetype = getArchetype(input.interests);
  const title = `The ${modifier} ${archetype}`;
  const subtitle = getSubtitle(modifier, archetype);
  const traits = input.interests.slice(0, 3);

  return { title, subtitle, traits };
}

// ---- Tier helpers (used by profile-stats-bar) ----

export interface LoopTier {
  label: string;
  minScore: number;
  maxScore: number;
}

export const LOOP_TIERS: LoopTier[] = [
  { label: 'Newcomer', minScore: 0, maxScore: 50 },
  { label: 'Explorer', minScore: 50, maxScore: 150 },
  { label: 'Adventurer', minScore: 150, maxScore: 400 },
  { label: 'Trailblazer', minScore: 400, maxScore: 800 },
  { label: 'Legend', minScore: 800, maxScore: Infinity },
];

export function getCurrentTier(score: number): LoopTier {
  for (const tier of LOOP_TIERS) {
    if (score < tier.maxScore) return tier;
  }
  return LOOP_TIERS[LOOP_TIERS.length - 1];
}

export function getNextTier(score: number): LoopTier | null {
  const currentIdx = LOOP_TIERS.findIndex(t => score < t.maxScore);
  if (currentIdx < 0 || currentIdx >= LOOP_TIERS.length - 1) return null;
  return LOOP_TIERS[currentIdx + 1];
}

export function getTierProgress(score: number): number {
  const tier = getCurrentTier(score);
  if (tier.maxScore === Infinity) return 1;
  const range = tier.maxScore - tier.minScore;
  return Math.min(1, (score - tier.minScore) / range);
}
