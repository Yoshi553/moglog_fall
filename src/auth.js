/*
 * =====================================================================
 * auth.js ― 新規登録とログインの処理をまとめたファイル
 * =====================================================================
 *
 * 【役割】
 * ログイン画面（App.jsx の AuthScreen）から呼ばれて、
 *   ・register … 新しいアカウントを作る
 *   ・login    … 既存のアカウントでログインする
 * を行い、アプリが使うアカウント情報（account）を返す。
 *
 * 【仕組みのポイント：ユーザーIDでログインできる理由】
 * Supabase Auth は、標準ではメールアドレスとパスワードでログインする仕組み。
 * このアプリはメールアドレスを使わず「ユーザーID（MG-1234）+ パスワード」で
 * ログインさせたいので、次のように内部でメールアドレスに変換している。
 *
 *     ユーザーID  MG-1234   →   メールアドレス  mg-1234@moglog.app
 *
 * この @moglog.app は実在しないドメインで、メールは送られない。
 * （そのため Supabase 側で「Confirm email（メール確認）」をオフにしておく必要がある）
 *
 * 【パスワードの扱い】
 * パスワードはこのアプリのテーブルには保存しない。
 * Supabase Auth が暗号化（ハッシュ化）して、別の場所で管理している。
 *
 * 【新規登録のときにDBで自動的に起きること】
 * auth.users に行が追加されると、DB側のトリガー（handle_new_user）が
 * 次の2つを自動で作る。このファイルでは何もしなくてよい。
 *   ・profiles   … 表示名のプロフィール行
 *   ・user_codes … ユーザーID（本人しか読めない別テーブル）
 *
 * 【accountの形】
 *   {
 *     id      … 内部ID（UUID）。投稿者の判定など、アプリ内部で使う
 *     userId  … 画面に表示するユーザーID（MG-1234）。他人には教えたくない情報
 *     name    … 表示名
 *     profile … 好みの設定。まだ設定していなければ null
 *   }
 */

import { supabase } from "./supabase";

// ユーザーIDをメールアドレスに変換するときに、後ろに付ける文字列
const domain = "@moglog.app";

/*
 * DBから取った情報を、アプリが使っている account の形に変換する
 *   p    … profiles テーブルの1行
 *   code … user_codes テーブルから取ったユーザーID（MG-xxxx）
 *
 * 好みを設定済みかどうかは、辛さ（spicy_pref）が null かどうかで判定する。
 *   null     → まだ設定していない（profile を null にして、好み設定画面を出させる）
 *   null以外 → 設定済み（好みの値をまとめて profile に入れる）
 */
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

/*
 * 新規登録
 *   name     … 画面で入力された表示名
 *   password … 画面で入力されたパスワード
 * 成功すると、作成したアカウントの情報を返す。
 *
 * ユーザーIDは、ランダムに作った MG-1000〜MG-9999 の番号。
 * すでに使われているIDと重なったら登録に失敗するので、
 * 別の番号に変えて、最大5回までやり直す。
 */
export async function register(name, password) {
  for (let i = 0; i < 5; i++) {
    // 例: "MG-4821"
    const code = `MG-${Math.floor(1000 + Math.random() * 9000)}`;

    // Supabase Auth にアカウントを作る
    //   email   … ユーザーIDを小文字にして、後ろに @moglog.app を付けたもの
    //   options.data.display_name … 表示名。DB側のトリガーが profiles に書き込む
    const { data, error } = await supabase.auth.signUp({
      email: code.toLowerCase() + domain,
      password,
      options: { data: { display_name: name } },
    });

    // 成功。好みはまだ未設定なので、profile は null で返す
    if (!error) return { id: data.user.id, userId: code, name, profile: null };

    // 「すでに登録されている」以外のエラー（パスワードが短い、通信エラーなど）は、
    // やり直しても直らないので、そのままエラーとして呼び出し元へ返す
    if (!/already|registered/i.test(error.message)) throw error;

    // IDが重複したときだけ、ここでループの先頭に戻り、別の番号でやり直す
  }

  // 5回やっても重複が続いたときの最終的なエラー
  throw new Error("登録に失敗しました。もう一度お試しください");
}

/*
 * ログイン
 *   userId   … 画面で入力されたユーザーID（例: MG-1234）
 *   password … 画面で入力されたパスワード
 * 成功すると、ログインしたユーザーの account を返す。
 * IDかパスワードが違うときは、エラーを投げる（画面側がメッセージを出す）。
 */
export async function login(userId, password) {
  // ① Supabase Auth でログインする
  //   入力されたIDの前後の空白を取り、小文字にして、メールアドレスの形にする
  //   （登録時と同じ変換をするので、MG-1234 でも mg-1234 でも同じアカウントになる）
  const { data, error } = await supabase.auth.signInWithPassword({
    email: userId.trim().toLowerCase() + domain,
    password,
  });
  if (error) throw error;

  // ② プロフィール（表示名・好み）を取得する
  const { data: profile, error: pError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single();
  if (pError) throw pError;

  // ③ ユーザーID（MG-xxxx）を取得する
  //   user_codes は本人しか読めないテーブルなので、ログインしたあとでないと読めない
  const { data: codeRow, error: cError } = await supabase
    .from("user_codes")
    .select("code")
    .eq("user_id", data.user.id)
    .single();
  if (cError) throw cError;

  // ②と③をまとめて、アプリが使う account の形にして返す
  return toAccount(profile, codeRow.code);
}