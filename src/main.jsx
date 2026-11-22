/*
 * =====================================================================
 * main.jsx ― アプリの入り口（最初に実行されるファイル）
 * =====================================================================
 *
 * 【役割】
 * index.html にある <div id="root"> の中に、React のアプリ（App.jsx）を表示する。
 * アプリ全体の起動スイッチにあたるファイルで、画面の中身はここには書かない。
 *
 * 【起動の流れ】
 *   index.html → main.jsx（ここ）→ App.jsx → Home.jsx / MyPage.jsx など
 *
 * 【CSSの読み込み順について】
 * ここで index.css を、次の行で App.jsx を読み込む。
 * App.jsx の中で Common.css が読み込まれるため、順番は次のようになる。
 *     index.css → Common.css → （Home.css / MyPage.css は、それぞれの画面ファイルの読み込み時）
 * 同じ強さの指定が重なったときは、あとに読み込まれたほうが勝つので、
 * body や button などの共通の指定は、基本的に Common.css が index.css より優先される。
 */

// StrictMode … 開発中に、コードの問題を見つけやすくするための React の機能
import { StrictMode } from 'react'
// createRoot … 画面にアプリを表示するための React の関数
import { createRoot } from 'react-dom/client'
// アプリ全体の基本スタイル（フォント・背景・見出しなど）
import './index.css'
// アプリ本体
import App from './App.jsx'

// index.html の <div id="root"> を探し、その中にアプリを表示する
createRoot(document.getElementById('root')).render(
  // StrictMode で包むと、開発中（npm run dev）だけ、次のような動きになる。
  //   ・useEffect が、確認のために2回実行される
  //     （投稿の読み込みなどの通信が、2回走ることがある）
  //   ・問題になりそうな書き方に、警告が出る
  // 本番（公開後）の動きには、影響しない。
  <StrictMode>
    <App />
  </StrictMode>,
)