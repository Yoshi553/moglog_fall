/*
 * =====================================================================
 * api.js ― 画面（App.jsx / MyPage.jsx など）とSupabase（データベース）の間をつなぐファイル
 * =====================================================================
 *
 * 【役割】
 * 画面側のコードが、Supabaseへの問い合わせ方（テーブル名・列名・絞り込み条件）を
 * 直接知らなくて済むように、データの「取得・追加・更新・削除」をここへまとめている。
 * 画面側は fetchPosts() や toggleSaveRemote() のような関数名を呼ぶだけでよい。
 *
 * 【扱うテーブルと保存先】
 *   posts        … 投稿（写真のパス、店名、位置情報、星評価、コメント）
 *   comments     … 投稿についたコメント
 *   saved_posts  … ユーザーが保存した投稿
 *   follows      … フォロー関係（pending = 申請中 / accepted = 承認済み）
 *   profiles     … 表示名・好みなどのプロフィール
 *   user_codes   … ユーザーID（MG-xxxx）。本人しか読めない
 *   Storage の post-images バケット … 投稿写真の画像ファイル
 *
 * 【見えるデータの範囲について】
 * 「自分の投稿 + フォロー中の人の投稿だけ見える」という制限は、このファイルではなく
 * Supabase側の権限ルール（RLS）で行っている。そのため fetchPosts() は
 * 条件を付けずに全件を要求しても、許可された投稿しか返ってこない。
 *
 * 【ファイルの構成】
 *   1. 共通の道具（バケット名・URL作成・ログイン中ユーザー取得）
 *   2. 投稿まわり（一覧取得・作成・削除）
 *   3. 保存・コメント
 *   4. フォロー関係（一覧・申請・許可・解除）
 *   5. マイページの人数表示
 */

import { supabase } from "./supabase";

/* ───────────────────────────────────────────────────────────
 * 1. 共通の道具
 * ─────────────────────────────────────────────────────────── */

// 写真を保存しているStorageのバケット名（Supabaseの Storage で作ったもの）
const BUCKET = "post-images";

// 写真の保存パス（例: "ユーザーUUID/1700000000000.jpg"）から、表示用の公開URLを作る
// ネットワーク通信はせず、URLの文字列を組み立てるだけ
const publicUrl = (path) =>
  supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

// 現在ログインしているユーザーを取得する
// ログインしていなければエラーにして、以降の処理（投稿・保存など）を止める
// user.id は Supabase Auth が発行した内部ID（UUID）。ユーザーID（MG-xxxx）とは別物
const getMe = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not logged in");
  return user;
};

/* ───────────────────────────────────────────────────────────
 * 2. 投稿まわり
 * ─────────────────────────────────────────────────────────── */

// DBから取ってきた投稿1件分のデータを、画面（Home.jsx など）が使っている形に変換する
//   row      … fetchPosts で取得した posts の1行（投稿者・コメントも入っている）
//   savedIds … 自分が保存済みの投稿IDの集合（保存ボタンの状態表示に使う）
const toPost = (row, savedIds) => {
  // 投稿者のプロフィール（取得できなかった場合に備えて空オブジェクトを用意）
  const a = row.author || {};
  return {
    id: row.id,
    // 投稿者の内部ID。マイページで「自分の投稿」を絞り込むときに使う
    userId: row.user_id,
    name: a.display_name || "ユーザー",
    // アイコンに表示する、表示名の1文字目
    avatar: (a.display_name || "も")[0],
    // numeric型は文字列で返ることがあるので、数値に直す
    rating: Number(row.rating),
    // 画面で表示する写真のURL
    image: publicUrl(row.image_path),
    // 削除時にStorageのファイルを消すために、元のパスも持っておく
    imagePath: row.image_path,
    location: row.shop_name || "場所未設定",
    city: row.city || "",
    comment: row.comment || "",
    // コメントを古い順に並べ替えて、{名前, 本文} の形に変換する
    comments: [...(row.comments || [])]
      .sort((x, y) => new Date(x.created_at) - new Date(y.created_at))
      .map((c) => ({
        name: c.commenter?.display_name || "ユーザー",
        text: c.body,
      })),
    // 自分が保存した投稿かどうか
    saved: savedIds.has(row.id),
    // 位置情報。緯度・経度の両方があるときだけ設定し、なければ null（地図は出さない）
    gps:
      row.latitude != null && row.longitude != null
        ? { latitude: row.latitude, longitude: row.longitude }
        : null,
    // 投稿者の好み（名前をタップしたときのプロフィール表示に使う）
    // 未設定のときは「普通」を表す 2 を入れる
    profile: {
      favoriteFoods: a.favorite_foods || "",
      辛さ: a.spicy_pref ?? '未設定',
      甘さ: a.sweet_pref ?? '未設定',
      濃さ: a.strength_pref ?? '未設定',
    },
  };
};

// 投稿一覧を取得する（投稿者・コメント・自分の保存状態つき）
// 見える投稿は、自分の投稿とフォロー中の人の投稿だけ（Supabase側のRLSで制限）
export async function fetchPosts() {
  const me = await getMe();

  // posts を取得し、関連するテーブルも一度の問い合わせで一緒に取る
  //   author    … 投稿者のプロフィール（profiles テーブル）
  //   comments  … その投稿へのコメント。各コメントの書き手の表示名も取る
  // 新しい投稿が先頭に来るように、作成日時の降順で並べる
  const { data, error } = await supabase
    .from("posts")
    .select(
      `id, user_id, image_path, shop_name, city, latitude, longitude, rating, comment, created_at,
       author:profiles!user_id(display_name, favorite_foods, spicy_pref, sweet_pref, strength_pref),
       comments(id, body, created_at, commenter:profiles!user_id(display_name))`,
    )
    .order("created_at", { ascending: false });
  if (error) throw error;

  // 自分が保存した投稿のIDを取得する
  const { data: saves, error: sError } = await supabase
    .from("saved_posts")
    .select("post_id")
    .eq("user_id", me.id);
  if (sError) throw sError;

  // 検索が速い Set にして、投稿ごとに保存済みかどうかを判定する
  const savedIds = new Set(saves.map((s) => s.post_id));
  return data.map((row) => toPost(row, savedIds));
}

// 投稿を作成する（写真をアップロードしてから、posts に1行追加する）
//   post … CreatePost 画面で入力した内容。post.image は圧縮済みの data URL
export async function createPostRemote(post) {
  const me = await getMe();

  // data URL（"data:image/jpeg;base64,..."）を、アップロード用の Blob に変換する
  const blob = await (await fetch(post.image)).blob();
  // 保存先のパス。自分のUUIDのフォルダに、時刻をファイル名にして置く
  // （権限ルールで、自分のフォルダにしか書き込めないようにしてある）
  const path = `${me.id}/${Date.now()}.jpg`;

  // ① 写真をStorageにアップロードする
  const { error: upError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/jpeg" });
  if (upError) throw upError;

  // ② 投稿の情報を posts に保存する
  //   空の入力は null にして、DBに空文字が入らないようにする
  const { error } = await supabase.from("posts").insert({
    user_id: me.id,
    image_path: path,
    shop_name:
      post.location && post.location !== "場所未設定" ? post.location : null,
    city: post.city || null,
    latitude: post.gps?.latitude ?? null,
    longitude: post.gps?.longitude ?? null,
    rating: post.rating,
    comment: post.comment || null,
  });
  if (error) {
    // 投稿の保存に失敗したら、先にアップロードした写真も消して、ゴミを残さない
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
}

// 投稿を削除する（posts の行と、Storage の写真の両方）
// 自分の投稿しか消せない（権限ルールで制限）
// 関連するコメントと保存は、DB側の設定で投稿と一緒に自動的に消える
export async function deletePostRemote(post) {
  const { error } = await supabase.from("posts").delete().eq("id", post.id);
  if (error) throw error;
  // 行を消せたあとで写真を消す（写真の削除に失敗しても、投稿は消えた状態を保つ）
  await supabase.storage.from(BUCKET).remove([post.imagePath]);
}

/* ───────────────────────────────────────────────────────────
 * 3. 保存・コメント
 * ─────────────────────────────────────────────────────────── */

// 保存 / 保存解除を切り替える
//   postId    … 対象の投稿ID
//   nextSaved … 切り替えたあとの状態。true なら保存する、false なら保存を外す
export async function toggleSaveRemote(postId, nextSaved) {
  const me = await getMe();
  if (nextSaved) {
    // 保存する: saved_posts に「ユーザーと投稿の組み合わせ」を1行追加
    const { error } = await supabase
      .from("saved_posts")
      .insert({ user_id: me.id, post_id: postId });
    if (error) throw error;
  } else {
    // 保存を外す: その組み合わせの行を削除
    const { error } = await supabase
      .from("saved_posts")
      .delete()
      .eq("user_id", me.id)
      .eq("post_id", postId);
    if (error) throw error;
  }
}

// 投稿にコメントを追加する
export async function addCommentRemote(postId, text) {
  const me = await getMe();
  const { error } = await supabase
    .from("comments")
    .insert({ post_id: postId, user_id: me.id, body: text });
  if (error) throw error;
}

/* ───────────────────────────────────────────────────────────
 * 4. フォロー関係
 *
 * follows テーブルの1行が「follower_id が followee_id をフォローしている」を表す。
 *   status = "pending"  … 申請中（相手が許可するまで）
 *   status = "accepted" … 承認済み（フォロー成立）
 * 拒否・フォロー解除・フォロワー削除は、どれも行の削除で表現している。
 * ─────────────────────────────────────────────────────────── */

// 自分がフォローしている人の一覧（承認済みのみ）
export async function fetchFollowing() {
  const me = await getMe();
  const { data, error } = await supabase
    .from("follows")
    .select("followee:profiles!followee_id(id, display_name)")
    .eq("follower_id", me.id)
    .eq("status", "accepted")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((r) => ({
    id: r.followee.id,
    name: r.followee.display_name,
  }));
}

// 自分をフォローしている人（フォロワー）の一覧（承認済みのみ）
export async function fetchFollowers() {
  const me = await getMe();
  const { data, error } = await supabase
    .from("follows")
    .select("follower:profiles!follower_id(id, display_name)")
    .eq("followee_id", me.id)
    .eq("status", "accepted")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((r) => ({
    id: r.follower.id,
    name: r.follower.display_name,
  }));
}

// 自分に届いている友達申請の一覧（まだ許可も拒否もしていないもの）
export async function fetchRequests() {
  const me = await getMe();
  const { data, error } = await supabase
    .from("follows")
    .select("follower:profiles!follower_id(id, display_name)")
    .eq("followee_id", me.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((r) => ({
    id: r.follower.id,
    name: r.follower.display_name,
  }));
}

// ユーザーID（MG-xxxx）を入力して、友達申請を送る
// 戻り値は、画面にそのまま表示するメッセージの文字列
export async function sendFollowRequest(userCode) {
  const me = await getMe();
  // 小文字で入力されても検索できるよう、大文字にそろえる
  const code = userCode.trim().toUpperCase();
  if (!code) return "ユーザーIDを入力してください";

  // ユーザーIDは他人に見えないので、profiles を直接検索せず、
  // 「完全一致したときだけ相手を返す」DB側の関数（find_profile_by_code）を呼ぶ
  const { data: found, error } = await supabase.rpc("find_profile_by_code", {
    p_code: code,
  });
  if (error) throw error;
  const target = found?.[0];
  if (!target) return "そのユーザーが見つかりません";
  if (target.id === me.id) return "自分自身には申請できません";

  // follows に pending の行を追加して、申請とする
  const { error: iError } = await supabase
    .from("follows")
    .insert({ follower_id: me.id, followee_id: target.id });
  if (iError) {
    // 23505 は「同じ組み合わせがすでにある」エラー（申請済み、またはフォロー中）
    if (iError.code === "23505") return "すでに申請済み、またはフォロー中です";
    throw iError;
  }
  return `${target.display_name}さんに友達申請を送りました`;
}

// 受け取った申請に返事をする
//   accepted = true  … 許可。status を accepted に更新して、フォローを成立させる
//   accepted = false … 拒否。行を削除する
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

// フォローを解除する（自分が followee_id の人をフォローしている行を削除）
export async function unfollowRemote(followeeId) {
  const me = await getMe();
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", me.id)
    .eq("followee_id", followeeId);
  if (error) throw error;
}

// フォロワーを削除する（相手が自分をフォローしている行を削除）
// 解除と行き先が逆で、自分が followee_id（される側）になる
export async function removeFollowerRemote(followerId) {
  const me = await getMe();
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("followee_id", me.id);
  if (error) throw error;
}

/* ───────────────────────────────────────────────────────────
 * 5. マイページの人数表示
 * ─────────────────────────────────────────────────────────── */

// マイページに表示する、フォロー数とフォロワー数を取得する
// profile_counts は、承認済みの数をDB側で集計してくれるビュー
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