import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ SUPABASE_URL または SUPABASE_KEY が設定されていません。データベース機能は動作しません。');
}

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

/**
 * イベントを作成する
 */
export async function createEvent(title, eventDate, location, description) {
  if (!supabase) throw new Error('Supabaseが初期化されていません');
  
  const { data, error } = await supabase
    .from('events')
    .insert([{ title, event_date: eventDate, location, description }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * イベントのメッセージIDを更新する（パネルが送信された後に呼ばれる）
 */
export async function updateEventMessageId(eventId, messageId) {
  if (!supabase) return;
  
  const { error } = await supabase
    .from('events')
    .update({ message_id: messageId })
    .eq('id', eventId);

  if (error) throw error;
}

/**
 * 出欠状況をUpsertする
 */
export async function upsertAttendance(eventId, userId, status, comment = null) {
  if (!supabase) throw new Error('Supabaseが初期化されていません');
  
  const payload = {
    event_id: eventId,
    user_id: userId,
    status: status,
    updated_at: new Date().toISOString()
  };
  
  if (comment !== null) {
    payload.comment = comment;
  }
  
  // user_id と event_id でユニークなレコードをUpsertする
  // (Supabase側のテーブルで event_id + user_id にUnique制約が設定されている必要があります)
  const { data, error } = await supabase
    .from('attendance')
    .upsert(payload, { onConflict: 'event_id, user_id' })
    .select();

  if (error) throw error;
  return data;
}

/**
 * コメントを更新する
 */
export async function updateComment(eventId, userId, comment) {
  if (!supabase) throw new Error('Supabaseが初期化されていません');
  
  const { data, error } = await supabase
    .from('attendance')
    .update({ comment: comment, updated_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .select();

  if (error) throw error;
  return data;
}

/**
 * イベントとその出欠状況を全て取得する
 */
export async function getEventWithAttendance(eventId) {
  if (!supabase) throw new Error('Supabaseが初期化されていません');
  
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (eventError) throw eventError;

  const { data: attendances, error: attError } = await supabase
    .from('attendance')
    .select('*')
    .eq('event_id', eventId);

  if (attError) throw attError;

  return { event, attendances };
}

/**
 * 進行中（または全て）のイベント一覧を取得する
 */
export async function getActiveEvents() {
  if (!supabase) throw new Error('Supabaseが初期化されていません');
  
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(25);

  if (error) throw error;
  return data;
}
