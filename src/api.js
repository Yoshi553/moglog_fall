import { supabase } from "./supabase";

const BUCKET = "post-images";

const publicUrl = (path) =>
  supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

const getMe = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not logged in");
  return user;
};

// DBの1行を、UIが使っている投稿の形に変換する
const toPost = (row, savedIds) => {
  const a = row.author || {};
  return {
    id: row.id,
    userId: a.user_code,
    name: a.display_name || "ユーザー",
    avatar: (a.display_name || "も")[0],
    rating: Number(row.rating),
    image: publicUrl(row.image_path),
    imagePath: row.image_path,
    location: row.shop_name || "場所未設定",
    city: row.city || "",
    comment: row.comment || "",
    comments: [...(row.comments || [])]
      .sort((x, y) => new Date(x.created_at) - new Date(y.created_at))
      .map((c) => ({
        name: c.commenter?.display_name || "ユーザー",
        text: c.body,
      })),
    saved: savedIds.has(row.id),
    gps:
      row.latitude != null && row.longitude != null
        ? { latitude: row.latitude, longitude: row.longitude }
        : null,
    profile: {
      favoriteFoods: a.favorite_foods || "",
      辛さ: a.spicy_pref ?? 2,
      甘さ: a.sweet_pref ?? 2,
      濃さ: a.strength_pref ?? 2,
    },
  };
};

// 投稿一覧（投稿者・コメント・自分の保存状態つき）
export async function fetchPosts() {
  const me = await getMe();

  const { data, error } = await supabase
    .from("posts")
    .select(
      `id, image_path, shop_name, city, latitude, longitude, rating, comment, created_at,
       author:profiles!user_id(user_code, display_name, favorite_foods, spicy_pref, sweet_pref, strength_pref),
       comments(id, body, created_at, commenter:profiles!user_id(display_name))`,
    )
    .order("created_at", { ascending: false });
  if (error) throw error;

  const { data: saves, error: sError } = await supabase
    .from("saved_posts")
    .select("post_id")
    .eq("user_id", me.id);
  if (sError) throw sError;

  const savedIds = new Set(saves.map((s) => s.post_id));
  return data.map((row) => toPost(row, savedIds));
}

// 投稿作成（写真アップロード → postsに保存）
export async function createPostRemote(post) {
  const me = await getMe();

  const blob = await (await fetch(post.image)).blob(); // data URL → Blob
  const path = `${me.id}/${Date.now()}.jpg`;

  const { error: upError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/jpeg" });
  if (upError) throw upError;

  const { error } = await supabase.from("posts").insert({
    user_id: me.id,
    image_path: path,
    shop_name: post.location && post.location !== "場所未設定" ? post.location : null,
    city: post.city || null,
    latitude: post.gps?.latitude ?? null,
    longitude: post.gps?.longitude ?? null,
    rating: post.rating,
    comment: post.comment || null,
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]); // 失敗時は写真も消す
    throw error;
  }
}

// 保存 / 保存解除（nextSaved: 保存状態にしたいか）
export async function toggleSaveRemote(postId, nextSaved) {
  const me = await getMe();
  if (nextSaved) {
    const { error } = await supabase
      .from("saved_posts")
      .insert({ user_id: me.id, post_id: postId });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("saved_posts")
      .delete()
      .eq("user_id", me.id)
      .eq("post_id", postId);
    if (error) throw error;
  }
}

// コメント追加
export async function addCommentRemote(postId, text) {
  const me = await getMe();
  const { error } = await supabase
    .from("comments")
    .insert({ post_id: postId, user_id: me.id, body: text });
  if (error) throw error;
}

// 投稿削除（行と写真の両方）
export async function deletePostRemote(post) {
  const { error } = await supabase.from("posts").delete().eq("id", post.id);
  if (error) throw error;
  await supabase.storage.from(BUCKET).remove([post.imagePath]);
}

// ---------- フォロー関係 ----------

// 自分がフォローしている人（承認済み）
export async function fetchFollowing() {
  const me = await getMe();
  const { data, error } = await supabase
    .from("follows")
    .select("followee:profiles!followee_id(id, display_name)")
    .eq("follower_id", me.id)
    .eq("status", "accepted")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((r) => ({ id: r.followee.id, name: r.followee.display_name }));
}

// 自分をフォローしている人（承認済み）
export async function fetchFollowers() {
  const me = await getMe();
  const { data, error } = await supabase
    .from("follows")
    .select("follower:profiles!follower_id(id, display_name)")
    .eq("followee_id", me.id)
    .eq("status", "accepted")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((r) => ({ id: r.follower.id, name: r.follower.display_name }));
}

// 自分に届いている申請
export async function fetchRequests() {
  const me = await getMe();
  const { data, error } = await supabase
    .from("follows")
    .select("follower:profiles!follower_id(id, display_name, user_code)")
    .eq("followee_id", me.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((r) => ({
    id: r.follower.id,
    name: r.follower.display_name,
    userId: r.follower.user_code,
  }));
}

// ユーザーIDで友達申請を送る（画面に出すメッセージを返す）
export async function sendFollowRequest(userCode) {
  const me = await getMe();
  const code = userCode.trim().toUpperCase();
  if (!code) return "ユーザーIDを入力してください";

  const { data: target, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("user_code", code)
    .maybeSingle();
  if (error) throw error;
  if (!target) return "そのユーザーが見つかりません";
  if (target.id === me.id) return "自分自身には申請できません";

  const { error: iError } = await supabase
    .from("follows")
    .insert({ follower_id: me.id, followee_id: target.id });
  if (iError) {
    if (iError.code === "23505") return "すでに申請済み、またはフォロー中です";
    throw iError;
  }
  return `${target.display_name}さんに友達申請を送りました`;
}

// 申請への返答（許可 = accepted に更新、拒否 = 行を削除）
export async function answerRequestRemote(followerId, accepted) {
  const me = await getMe();
  if (accepted) {
    const { error } = await supabase
      .from("follows")
      .update({ status: "accepted" })
      .eq("follower_id", followerId)
      .eq("followee_id", me.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", followerId)
      .eq("followee_id", me.id);
    if (error) throw error;
  }
}

// フォロー解除
export async function unfollowRemote(followeeId) {
  const me = await getMe();
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", me.id)
    .eq("followee_id", followeeId);
  if (error) throw error;
}

// フォロワーを削除
export async function removeFollowerRemote(followerId) {
  const me = await getMe();
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("followee_id", me.id);
  if (error) throw error;
}

// マイページの数字（フォロー数・フォロワー数）
export async function fetchCounts() {
  const me = await getMe();
  const { data, error } = await supabase
    .from("profile_counts")
    .select("following_count, follower_count")
    .eq("user_id", me.id)
    .single();
  if (error) throw error;
  return { following: data.following_count, followers: data.follower_count };
}