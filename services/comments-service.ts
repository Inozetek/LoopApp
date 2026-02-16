/**
 * Comments Service
 *
 * CRUD for Loop community comments on places.
 * Google reviews are fetched on-demand via google-places.ts (never cached per TOS).
 */

import { supabase } from '@/lib/supabase';

export interface Comment {
  id: string;
  userId: string;
  placeId: string;
  text: string;
  rating: number | null;
  helpfulCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  /** Joined from users table */
  userName?: string;
  userAvatar?: string;
}

export async function getComments(
  placeId: string,
  limit = 20,
  offset = 0,
): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select(`
      id,
      user_id,
      place_id,
      text,
      rating,
      helpful_count,
      status,
      created_at,
      updated_at,
      users:user_id (name, profile_picture_url)
    `)
    .eq('place_id', placeId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching comments:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    placeId: row.place_id,
    text: row.text,
    rating: row.rating,
    helpfulCount: row.helpful_count,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userName: row.users?.name ?? 'Loop User',
    userAvatar: row.users?.profile_picture_url ?? null,
  }));
}

export async function getCommentCount(placeId: string): Promise<number> {
  const { count, error } = await supabase
    .from('comments')
    .select('id', { count: 'exact', head: true })
    .eq('place_id', placeId)
    .eq('status', 'active');

  if (error) {
    console.error('Error fetching comment count:', error);
    return 0;
  }

  return count ?? 0;
}

export async function postComment(
  userId: string,
  placeId: string,
  text: string,
  rating?: number,
): Promise<Comment | null> {
  const { data, error } = await supabase
    .from('comments')
    .insert({
      user_id: userId,
      place_id: placeId,
      text: text.trim(),
      rating: rating ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error posting comment:', error);
    return null;
  }

  return {
    id: data.id,
    userId: data.user_id,
    placeId: data.place_id,
    text: data.text,
    rating: data.rating,
    helpfulCount: data.helpful_count,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function deleteComment(
  commentId: string,
  userId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting comment:', error);
    return false;
  }

  return true;
}

export async function markHelpful(commentId: string): Promise<boolean> {
  const { error } = await supabase.rpc('increment_helpful_count', {
    comment_id: commentId,
  });

  if (error) {
    // Fallback: direct update if RPC not available
    const { error: updateError } = await supabase
      .from('comments')
      .update({ helpful_count: supabase.rpc ? undefined : 1 })
      .eq('id', commentId);

    if (updateError) {
      console.error('Error marking helpful:', updateError);
      return false;
    }
  }

  return true;
}
