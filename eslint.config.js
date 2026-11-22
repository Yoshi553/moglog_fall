// ESLintの基本的なJavaScript用ルールを読み込む。
// JavaScriptの文法ミスや、問題のあるコードを検出するために使用する。
import js from '@eslint/js'

// ブラウザで利用できるグローバル変数の一覧を読み込む。
// 例えば、window、document、consoleなどを定義している。
// これによってESLintがブラウザ特有の変数を認識できるようになる。
import globals from 'globals'

// React Hooks専用のESLintプラグインを読み込む。
// useStateやuseEffectなどのReact Hooksについて、
// 正しい使い方ができているかチェックする。
import reactHooks from 'eslint-plugin-react-hooks'

// ReactのFast Refreshに関するESLintプラグインを読み込む。
// コンポーネントの更新などに関する問題を検出する。
import reactRefresh from 'eslint-plugin-react-refresh'

// ESLintの設定を作成するための関数を読み込む。
// defineConfig：ESLintの設定全体を定義する。
// globalIgnores：ESLintのチェック対象から除外するファイルを指定する。
import { defineConfig, globalIgnores } from 'eslint/config'


/* =========================================================
   ① ESLint全体の設定
   ========================================================= */

// defineConfigを使ってESLintの設定をまとめる。
// 配列の中に、適用するルールや対象ファイルなどを記述する。
export default defineConfig([


  /* -------------------------------------------------------
     ①-1 チェック対象から除外するファイル
     ------------------------------------------------------- */

  // distフォルダをESLintのチェック対象から除外する。
  // distはViteでアプリをビルドしたときに生成されるフォルダ。
  // ビルド後のファイルは自動生成されたものなので、
  // 通常は自分でESLintによるチェックを行う必要がない。
  globalIgnores(['dist']),


  /* -------------------------------------------------------
     ①-2 ESLintのチェック対象を指定
     ------------------------------------------------------- */

  {
    // 拡張子が.jsまたは.jsxのファイルをチェック対象にする。
    // **/* は、プロジェクト内のすべての階層を意味する。
    files: ['**/*.{js,jsx}'],


    /* -----------------------------------------------------
       ①-3 使用するESLintルールを指定
       ----------------------------------------------------- */

    extends: [

      // JavaScriptの基本的な推奨ルールを適用する。
      // 未定義の変数や、使用されていない変数などを検出する。
      js.configs.recommended,

      // React Hooksに関する推奨ルールを適用する。
      // Hooksを条件分岐やループの中で使用していないか、
      // useEffectの依存配列が適切かなどをチェックする。
      reactHooks.configs.flat.recommended,

      // ViteのReactプロジェクト向けのルールを適用する。
      // React Fast Refreshが正常に動作するための
      // コンポーネントの書き方などをチェックする。
      reactRefresh.configs.vite,

    ],


    /* -----------------------------------------------------
       ①-4 JavaScriptの実行環境に関する設定
       ----------------------------------------------------- */

    languageOptions: {

      // ブラウザで利用できるグローバル変数を認識させる。
      // 例えば、window、document、navigatorなど。
      // これによって、これらの変数を使っても
      // 未定義の変数として誤って警告されなくなる。
      globals: globals.browser,


      // JavaScriptの解析方法を設定する。
      parserOptions: {

        // JSXの記述を許可する。
        // Reactでは、JavaScriptの中にHTMLに似た構文（JSX）を書くため、
        // ESLintがその構文を正しく解析できるようにする。
        ecmaFeatures: {
          jsx: true
        },

      },

    },

  },

])
