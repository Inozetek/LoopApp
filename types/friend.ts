// Types for friends and social features

export interface Friend {
  id: string;
  name: string;
  email: string;
  profilePictureUrl?: string;
  loopScore: number;
  streakDays: number;
  isOnline: boolean;
  lastActiveAt: Date;
  friendsSince: Date;
  mutualFriends: number;
  sharedInterests: string[];
  canViewLoop: boolean;
  canInviteToActivities: boolean;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromUser: {
    id: string;
    name: string;
    email: string;
    profilePictureUrl?: string;
    loopScore: number;
    mutualFriends: number;
  };
  status: 'pending' | 'accepted' | 'declined' | 'blocked';
  createdAt: Date;
}

export interface SuggestedFriend {
  id: string;
  name: string;
  email: string;
  profilePictureUrl?: string;
  loopScore: number;
  mutualFriends: number;
  sharedInterests: string[];
  matchScore: number; // 0-100
  reason: string; // "3 mutual friends" or "Both love hiking"
}

export interface LoopScoreBreakdown {
  total: number;
  tasksCompleted: number;
  recommendationsAccepted: number;
  feedbackGiven: number;
  groupActivitiesAttended: number;
  streakBonus: number;
  badges: Badge[];
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: Date;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface FriendProfile {
  id: string;
  name: string;
  email: string;
  profilePictureUrl?: string;
  bio?: string;
  loopScore: number;
  loopScoreBreakdown: LoopScoreBreakdown;
  streakDays: number;
  interests: string[];
  sharedInterests: string[];
  friendsSince: Date;
  mutualFriends: number;
  canViewLoop: boolean;
  todayActivities?: {
    id: string;
    title: string;
    time: string;
    location: string;
    category: string;
  }[];
}

export type FriendSearchResult = {
  id: string;
  name: string;
  email: string;
  profilePictureUrl?: string;
  loopScore: number;
  mutualFriends: number;
  isFriend: boolean;
  hasPendingRequest: boolean;
};
