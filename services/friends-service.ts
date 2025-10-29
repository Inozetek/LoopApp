// Mock Friends Service (will be replaced with Supabase in production)

import { Friend, FriendRequest, SuggestedFriend, FriendProfile, FriendSearchResult } from '@/types/friend';

// Mock data
const MOCK_FRIENDS: Friend[] = [
  {
    id: '1',
    name: 'Alex Rivera',
    email: 'alex@example.com',
    profilePictureUrl: 'https://i.pravatar.cc/150?img=1',
    loopScore: 2847,
    streakDays: 14,
    isOnline: true,
    lastActiveAt: new Date(),
    friendsSince: new Date('2024-01-15'),
    mutualFriends: 8,
    sharedInterests: ['coffee', 'live_music', 'hiking'],
    canViewLoop: true,
    canInviteToActivities: true,
  },
  {
    id: '2',
    name: 'Jordan Chen',
    email: 'jordan@example.com',
    profilePictureUrl: 'https://i.pravatar.cc/150?img=2',
    loopScore: 3421,
    streakDays: 28,
    isOnline: true,
    lastActiveAt: new Date(Date.now() - 5 * 60 * 1000), // 5 mins ago
    friendsSince: new Date('2023-11-20'),
    mutualFriends: 12,
    sharedInterests: ['fitness', 'dining', 'bars'],
    canViewLoop: true,
    canInviteToActivities: true,
  },
  {
    id: '3',
    name: 'Taylor Morgan',
    email: 'taylor@example.com',
    profilePictureUrl: 'https://i.pravatar.cc/150?img=3',
    loopScore: 1892,
    streakDays: 7,
    isOnline: false,
    lastActiveAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    friendsSince: new Date('2024-02-01'),
    mutualFriends: 5,
    sharedInterests: ['arts', 'culture', 'coffee'],
    canViewLoop: true,
    canInviteToActivities: true,
  },
  {
    id: '4',
    name: 'Sam Martinez',
    email: 'sam@example.com',
    profilePictureUrl: 'https://i.pravatar.cc/150?img=4',
    loopScore: 4156,
    streakDays: 42,
    isOnline: false,
    lastActiveAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
    friendsSince: new Date('2023-08-10'),
    mutualFriends: 15,
    sharedInterests: ['outdoor', 'fitness', 'sports'],
    canViewLoop: true,
    canInviteToActivities: true,
  },
  {
    id: '5',
    name: 'Casey Williams',
    email: 'casey@example.com',
    profilePictureUrl: 'https://i.pravatar.cc/150?img=5',
    loopScore: 2134,
    streakDays: 21,
    isOnline: false,
    lastActiveAt: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
    friendsSince: new Date('2024-01-05'),
    mutualFriends: 6,
    sharedInterests: ['nightlife', 'entertainment', 'dining'],
    canViewLoop: true,
    canInviteToActivities: true,
  },
  {
    id: '6',
    name: 'Riley Johnson',
    email: 'riley@example.com',
    profilePictureUrl: 'https://i.pravatar.cc/150?img=6',
    loopScore: 3782,
    streakDays: 35,
    isOnline: false,
    lastActiveAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    friendsSince: new Date('2023-09-15'),
    mutualFriends: 11,
    sharedInterests: ['travel', 'culture', 'dining'],
    canViewLoop: false,
    canInviteToActivities: true,
  },
];

const MOCK_PENDING_REQUESTS: FriendRequest[] = [
  {
    id: 'req1',
    fromUserId: 'user7',
    toUserId: 'current',
    fromUser: {
      id: 'user7',
      name: 'Morgan Blake',
      email: 'morgan@example.com',
      profilePictureUrl: 'https://i.pravatar.cc/150?img=7',
      loopScore: 1567,
      mutualFriends: 3,
    },
    status: 'pending',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
  },
  {
    id: 'req2',
    fromUserId: 'user8',
    toUserId: 'current',
    fromUser: {
      id: 'user8',
      name: 'Avery Davis',
      email: 'avery@example.com',
      profilePictureUrl: 'https://i.pravatar.cc/150?img=8',
      loopScore: 2341,
      mutualFriends: 7,
    },
    status: 'pending',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
  },
];

const MOCK_SUGGESTED_FRIENDS: SuggestedFriend[] = [
  {
    id: 'sug1',
    name: 'Cameron Lee',
    email: 'cameron@example.com',
    profilePictureUrl: 'https://i.pravatar.cc/150?img=9',
    loopScore: 2890,
    mutualFriends: 5,
    sharedInterests: ['coffee', 'fitness', 'live_music'],
    matchScore: 87,
    reason: '5 mutual friends • Both love coffee',
  },
  {
    id: 'sug2',
    name: 'Drew Parker',
    email: 'drew@example.com',
    profilePictureUrl: 'https://i.pravatar.cc/150?img=10',
    loopScore: 1987,
    mutualFriends: 4,
    sharedInterests: ['hiking', 'outdoor', 'fitness'],
    matchScore: 82,
    reason: '4 mutual friends • Similar interests',
  },
  {
    id: 'sug3',
    name: 'Quinn Taylor',
    email: 'quinn@example.com',
    profilePictureUrl: 'https://i.pravatar.cc/150?img=11',
    loopScore: 3245,
    mutualFriends: 8,
    sharedInterests: ['dining', 'bars', 'nightlife'],
    matchScore: 79,
    reason: '8 mutual friends',
  },
];

// Service functions
export function getMockFriends(): Friend[] {
  return MOCK_FRIENDS;
}

export function getMockPendingRequests(): FriendRequest[] {
  return MOCK_PENDING_REQUESTS;
}

export function getMockSuggestedFriends(): SuggestedFriend[] {
  return MOCK_SUGGESTED_FRIENDS;
}

export async function searchFriends(query: string): Promise<FriendSearchResult[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300));

  const lowerQuery = query.toLowerCase();

  // Search through mock friends
  const results: FriendSearchResult[] = [
    {
      id: 'search1',
      name: 'Jamie Anderson',
      email: 'jamie.anderson@example.com',
      profilePictureUrl: 'https://i.pravatar.cc/150?img=12',
      loopScore: 2567,
      mutualFriends: 2,
      isFriend: false,
      hasPendingRequest: false,
    },
    {
      id: 'search2',
      name: 'Chris Taylor',
      email: 'chris.taylor@example.com',
      profilePictureUrl: 'https://i.pravatar.cc/150?img=13',
      loopScore: 3102,
      mutualFriends: 6,
      isFriend: false,
      hasPendingRequest: true,
    },
  ].filter(
    user =>
      user.name.toLowerCase().includes(lowerQuery) ||
      user.email.toLowerCase().includes(lowerQuery)
  );

  return results;
}

export async function sendFriendRequest(userId: string): Promise<void> {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('Friend request sent to user:', userId);
}

export async function acceptFriendRequest(requestId: string): Promise<void> {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('Friend request accepted:', requestId);
}

export async function declineFriendRequest(requestId: string): Promise<void> {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('Friend request declined:', requestId);
}

export async function removeFriend(friendId: string): Promise<void> {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('Friend removed:', friendId);
}

export async function getFriendProfile(friendId: string): Promise<FriendProfile> {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 500));

  const friend = MOCK_FRIENDS.find(f => f.id === friendId);

  if (!friend) {
    throw new Error('Friend not found');
  }

  return {
    id: friend.id,
    name: friend.name,
    email: friend.email,
    profilePictureUrl: friend.profilePictureUrl,
    bio: 'Living life one Loop at a time! Always down for coffee, hiking, or discovering new spots.',
    loopScore: friend.loopScore,
    loopScoreBreakdown: {
      total: friend.loopScore,
      tasksCompleted: 142,
      recommendationsAccepted: 89,
      feedbackGiven: 67,
      groupActivitiesAttended: 34,
      streakBonus: friend.streakDays * 20,
      badges: [
        {
          id: 'badge1',
          name: 'Early Bird',
          description: 'Complete 10 morning activities',
          icon: '🌅',
          earnedAt: new Date('2024-01-20'),
          rarity: 'common',
        },
        {
          id: 'badge2',
          name: 'Social Butterfly',
          description: 'Attend 25 group activities',
          icon: '🦋',
          earnedAt: new Date('2024-02-15'),
          rarity: 'rare',
        },
      ],
    },
    streakDays: friend.streakDays,
    interests: ['coffee', 'live_music', 'hiking', 'dining', 'fitness'],
    sharedInterests: friend.sharedInterests,
    friendsSince: friend.friendsSince,
    mutualFriends: friend.mutualFriends,
    canViewLoop: friend.canViewLoop,
    todayActivities: friend.canViewLoop
      ? [
          {
            id: 'act1',
            title: 'Morning Coffee',
            time: '8:00 AM',
            location: 'Blue Bottle Coffee',
            category: 'coffee',
          },
          {
            id: 'act2',
            title: 'Lunch Meeting',
            time: '12:30 PM',
            location: 'Downtown Bistro',
            category: 'dining',
          },
          {
            id: 'act3',
            title: 'Evening Workout',
            time: '6:00 PM',
            location: 'Fitness First Gym',
            category: 'fitness',
          },
        ]
      : undefined,
  };
}

export function getActivityStatusText(lastActiveAt: Date): string {
  const now = Date.now();
  const diff = now - lastActiveAt.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Online now';
  if (minutes < 5) return 'Active now';
  if (minutes < 60) return `Active ${minutes}m ago`;
  if (hours < 24) return `Active ${hours}h ago`;
  if (days === 1) return 'Active yesterday';
  if (days < 7) return `Active ${days}d ago`;
  return 'Active recently';
}
