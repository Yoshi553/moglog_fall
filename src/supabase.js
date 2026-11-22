// Supabaseと通信するためのcreateClient関数を読み込む。
// createClientは、Supabaseのデータベースなどにアクセスするための
// クライアント（接続するための機能）を作成する関数。
import { createClient } from '@supabase/supabase-js'


/* =========================================================
   ① Supabaseの接続情報を取得
   ========================================================= */

// import.meta.envを使って環境変数を取得する。
// 環境変数は、プログラムのコードとは別に管理する設定情報のこと。

// .envファイルに設定したSupabaseのURLを取得する。
// VITE_SUPABASE_URLという名前の環境変数から値を読み込む。
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

// Supabaseに接続するためのAPIキーを取得する。
// VITE_SUPABASE_ANON_KEYという名前の環境変数から値を読み込む。
// このキーはSupabaseのプロジェクトを識別し、
// アプリからSupabaseにアクセスするために使用する。
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY


/* =========================================================
   ② 接続情報の確認
   ========================================================= */

// 取得したSupabaseのURLをブラウザの開発者ツールの
// Consoleに表示する。
// URLが正しく読み込めているか確認するために使用する。
console.log('Supabase URL:', supabaseUrl)


/* =========================================================
   ③ Supabaseクライアントの作成
   ========================================================= */

// createClientを使ってSupabaseとの接続を作成する。
// 第1引数：SupabaseのプロジェクトURL
// 第2引数：SupabaseのAPIキー
//
// 作成した接続情報をsupabaseという名前でexportする。
// exportすることで、ほかのファイルからも利用できるようにする。
//
// 例えば、api.jsなどでこのsupabaseを読み込むことで、
// データベースへのデータ取得・登録・更新・削除などを実行できる。
export const supabase = createClient(
  supabaseUrl,
  supabaseKey
)