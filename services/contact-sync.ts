/**
 * Contact Sync Service
 *
 * Handles contact synchronization for friend discovery and referral invites:
 * - Request contacts permission
 * - Import phone contacts with privacy (SHA-256 hashing)
 * - Match contacts with Loop users
 * - Send referral invites via SMS/Email
 */

import * as Contacts from 'expo-contacts';
import * as SMS from 'expo-sms';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { generateReferralLink, generateInviteMessage } from './referral-service';
import type { Contact } from '@/types/user';

// Hash function for privacy
async function hashContact(value: string): Promise<string> {
  // SHA-256 hash using Web Crypto API
  const encoder = new TextEncoder();
  const data = encoder.encode(value.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Request contacts permission from user
 */
export async function requestContactsPermission(): Promise<boolean> {
  try {
    const { status } = await Contacts.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting contacts permission:', error);
    return false;
  }
}

/**
 * Check if contacts permission is already granted
 */
export async function checkContactsPermission(): Promise<boolean> {
  try {
    const { status } = await Contacts.getPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error checking contacts permission:', error);
    return false;
  }
}

/**
 * Import all contacts from device
 */
export async function importDeviceContacts(): Promise<{
  success: boolean;
  contacts: Contact[];
  loopUsers: Contact[];
  nonLoopUsers: Contact[];
}> {
  try {
    // Check permission
    const hasPermission = await checkContactsPermission();
    if (!hasPermission) {
      const granted = await requestContactsPermission();
      if (!granted) {
        return {
          success: false,
          contacts: [],
          loopUsers: [],
          nonLoopUsers: [],
        };
      }
    }

    // Fetch all contacts
    const { data } = await Contacts.getContactsAsync({
      fields: [
        Contacts.Fields.Name,
        Contacts.Fields.PhoneNumbers,
        Contacts.Fields.Emails,
      ],
    });

    if (!data) {
      return {
        success: false,
        contacts: [],
        loopUsers: [],
        nonLoopUsers: [],
      };
    }

    // Process contacts and hash identifiers
    const processedContacts: Contact[] = [];
    const hashedPhones: string[] = [];
    const hashedEmails: string[] = [];

    for (const contact of data) {
      const name =
        contact.name ||
        contact.firstName ||
        contact.lastName ||
        'Unknown';

      // Get first phone number
      const phoneNumber = contact.phoneNumbers?.[0]?.number;
      const email = contact.emails?.[0]?.email;

      if (!phoneNumber && !email) continue; // Skip contacts without contact info

      const processedContact: Contact = {
        id: contact.id,
        name,
        phone_number: phoneNumber,
        email,
        is_loop_user: false,
      };

      processedContacts.push(processedContact);

      // Hash for privacy-preserving lookup
      if (phoneNumber) {
        const hashed = await hashContact(phoneNumber);
        hashedPhones.push(hashed);
      }
      if (email) {
        const hashed = await hashContact(email);
        hashedEmails.push(hashed);
      }
    }

    // Query database to find Loop users
    // Note: This requires a database function that checks hashed values
    const { data: matchedUsers, error } = await supabase.rpc(
      'find_users_by_hashed_contacts',
      {
        p_hashed_phones: hashedPhones,
        p_hashed_emails: hashedEmails,
      }
    );

    if (error) {
      console.error('Error finding Loop users:', error);
      // Continue with non-matched contacts
    }

    // Mark contacts that are Loop users
    const loopUserIds = new Set(
      (matchedUsers || []).map((u: any) => u.contact_hash)
    );

    const loopUsers: Contact[] = [];
    const nonLoopUsers: Contact[] = [];

    for (const contact of processedContacts) {
      let isLoopUser = false;

      if (contact.phone_number) {
        const hash = await hashContact(contact.phone_number);
        if (loopUserIds.has(hash)) {
          isLoopUser = true;
          // Find the user ID from matched results
          const matched = matchedUsers?.find((u: any) => u.contact_hash === hash);
          if (matched) {
            contact.loop_user_id = matched.user_id;
          }
        }
      }

      if (!isLoopUser && contact.email) {
        const hash = await hashContact(contact.email);
        if (loopUserIds.has(hash)) {
          isLoopUser = true;
          const matched = matchedUsers?.find((u: any) => u.contact_hash === hash);
          if (matched) {
            contact.loop_user_id = matched.user_id;
          }
        }
      }

      contact.is_loop_user = isLoopUser;

      if (isLoopUser) {
        loopUsers.push(contact);
      } else {
        nonLoopUsers.push(contact);
      }
    }

    return {
      success: true,
      contacts: processedContacts,
      loopUsers,
      nonLoopUsers,
    };
  } catch (error) {
    console.error('Error importing contacts:', error);
    return {
      success: false,
      contacts: [],
      loopUsers: [],
      nonLoopUsers: [],
    };
  }
}

/**
 * Send friend request to a Loop user
 */
export async function sendFriendRequest(
  userId: string,
  friendId: string
): Promise<boolean> {
  try {
    const { error } = await supabase.from('friendships').insert({
      user_id: userId,
      friend_id: friendId,
      status: 'pending',
    });

    if (error) {
      console.error('Error sending friend request:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in sendFriendRequest:', error);
    return false;
  }
}

/**
 * Send referral invite via SMS
 */
export async function sendSMSInvite(
  phoneNumber: string,
  referrerName: string,
  referralCode: string
): Promise<{
  success: boolean;
  method: 'sms' | 'fallback';
}> {
  try {
    // Check if SMS is available on device
    const isAvailable = await SMS.isAvailableAsync();

    if (isAvailable) {
      const referralLink = generateReferralLink(referralCode);
      const message = generateInviteMessage(referrerName, referralLink);

      await SMS.sendSMSAsync([phoneNumber], message);

      return { success: true, method: 'sms' };
    } else {
      // Fallback: Open SMS app with pre-filled message
      const referralLink = generateReferralLink(referralCode);
      const message = generateInviteMessage(referrerName, referralLink);
      const smsUrl = Platform.select({
        ios: `sms:${phoneNumber}&body=${encodeURIComponent(message)}`,
        android: `sms:${phoneNumber}?body=${encodeURIComponent(message)}`,
      });

      if (smsUrl) {
        await Linking.openURL(smsUrl);
      }

      return { success: true, method: 'fallback' };
    }
  } catch (error) {
    console.error('Error sending SMS invite:', error);
    return { success: false, method: 'fallback' };
  }
}

/**
 * Send referral invite via Email
 */
export async function sendEmailInvite(
  email: string,
  referrerName: string,
  referralCode: string
): Promise<boolean> {
  try {
    const referralLink = generateReferralLink(referralCode);
    const subject = `${referrerName} invited you to Loop`;
    const body = `${generateInviteMessage(referrerName, referralLink)}

Loop helps you discover amazing activities and plan your day effortlessly.

Tap the link to join and we both get 1 month free Premium!`;

    const emailUrl = `mailto:${email}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    await Linking.openURL(emailUrl);

    return true;
  } catch (error) {
    console.error('Error sending email invite:', error);
    return false;
  }
}

/**
 * Track referral invitation in database
 */
export async function trackReferralInvitation(
  referrerUserId: string,
  referralCode: string,
  inviteData: {
    email?: string;
    phone?: string;
    method: 'sms' | 'email' | 'link' | 'contact_sync';
  }
): Promise<boolean> {
  try {
    const { error } = await supabase.from('referrals').insert({
      referrer_user_id: referrerUserId,
      referral_code: referralCode,
      referred_email: inviteData.email,
      referred_phone: inviteData.phone,
      invite_method: inviteData.method,
      status: 'pending',
    });

    if (error) {
      console.error('Error tracking referral invitation:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in trackReferralInvitation:', error);
    return false;
  }
}

/**
 * Get user's contact sync status
 */
export async function getContactSyncStatus(
  userId: string
): Promise<{
  hasPermission: boolean;
  lastSyncedAt: Date | null;
  totalContacts: number;
  loopUsersFound: number;
}> {
  try {
    const hasPermission = await checkContactsPermission();

    // Get sync metadata from user profile (if stored)
    const { data: user, error } = await supabase
      .from('users')
      .select('preferences')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return {
        hasPermission,
        lastSyncedAt: null,
        totalContacts: 0,
        loopUsersFound: 0,
      };
    }

    const contactSync = (user.preferences as any)?.contact_sync;

    return {
      hasPermission,
      lastSyncedAt: contactSync?.last_synced_at
        ? new Date(contactSync.last_synced_at)
        : null,
      totalContacts: contactSync?.total_contacts || 0,
      loopUsersFound: contactSync?.loop_users_found || 0,
    };
  } catch (error) {
    console.error('Error in getContactSyncStatus:', error);
    return {
      hasPermission: false,
      lastSyncedAt: null,
      totalContacts: 0,
      loopUsersFound: 0,
    };
  }
}

/**
 * Update contact sync metadata in user profile
 */
export async function updateContactSyncMetadata(
  userId: string,
  metadata: {
    total_contacts: number;
    loop_users_found: number;
  }
): Promise<boolean> {
  try {
    // Get current preferences
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('preferences')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error('Error fetching user preferences:', fetchError);
      return false;
    }

    const preferences = user?.preferences || {};
    const updatedPreferences = {
      ...preferences,
      contact_sync: {
        last_synced_at: new Date().toISOString(),
        total_contacts: metadata.total_contacts,
        loop_users_found: metadata.loop_users_found,
      },
    };

    const { error } = await supabase
      .from('users')
      .update({ preferences: updatedPreferences })
      .eq('id', userId);

    if (error) {
      console.error('Error updating contact sync metadata:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in updateContactSyncMetadata:', error);
    return false;
  }
}

/**
 * Bulk send invites to multiple contacts
 */
export async function bulkSendInvites(
  contacts: Contact[],
  referrerName: string,
  referrerUserId: string,
  referralCode: string
): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const contact of contacts) {
    try {
      let sent = false;

      // Try SMS first if phone available
      if (contact.phone_number) {
        const smsResult = await sendSMSInvite(
          contact.phone_number,
          referrerName,
          referralCode
        );
        sent = smsResult.success;

        if (sent) {
          await trackReferralInvitation(referrerUserId, referralCode, {
            phone: contact.phone_number,
            method: 'contact_sync',
          });
        }
      }

      // Try email if SMS failed or no phone
      if (!sent && contact.email) {
        sent = await sendEmailInvite(contact.email, referrerName, referralCode);

        if (sent) {
          await trackReferralInvitation(referrerUserId, referralCode, {
            email: contact.email,
            method: 'contact_sync',
          });
        }
      }

      if (sent) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push(
          `Failed to send invite to ${contact.name} (no valid contact method)`
        );
      }
    } catch (error) {
      results.failed++;
      results.errors.push(`Error inviting ${contact.name}: ${error}`);
    }
  }

  return results;
}
