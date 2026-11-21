import { supabase } from "./supabase";

const domain = "@moglog.app";

// profilesの1行 + ユーザーID を、アプリが使っているaccountの形に変換する
// id は内部ID（UUID）。投稿者の判定に使う。userId は画面に表示するコード
const toAccount = (p, code) => ({
  id: p.id,
  userId: code,
  name: p.display_name,
  profile:
    p.spicy_pref === null
      ? null
      : {
          favoriteFoods: p.favorite_foods || "",
          辛さ: p.spicy_pref,
          甘さ: p.sweet_pref,
          濃さ: p.strength_pref,
        },
});

// 新規登録
export async function register(name, password) {
  for (let i = 0; i < 5; i++) {
    const code = `MG-${Math.floor(1000 + Math.random() * 9000)}`;
    const { data, error } = await supabase.auth.signUp({
      email: code.toLowerCase() + domain,
      password,
      options: { data: { display_name: name } },
    });
    if (!error) return { id: data.user.id, userId: code, name, profile: null };
    if (!/already|registered/i.test(error.message)) throw error;
    // IDが重複したときだけ、別の番号でやり直す
  }
  throw new Error("登録に失敗しました。もう一度お試しください");
}

// ログイン
export async function login(userId, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: userId.trim().toLowerCase() + domain,
    password,
  });
  if (error) throw error;

  const { data: profile, error: pError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single();
  if (pError) throw pError;

  const { data: codeRow, error: cError } = await supabase
    .from("user_codes")
    .select("code")
    .eq("user_id", data.user.id)
    .single();
  if (cError) throw cError;

  return toAccount(profile, codeRow.code);
}