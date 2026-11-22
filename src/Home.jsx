/*
 * =====================================================================
 * Home.jsx ― ホーム画面（投稿の一覧と絞り込み）
 * =====================================================================
 *
 * 【役割】
 * 見える投稿をカードの形で縦に並べ、星評価・人・市で絞り込めるようにする。
 * 投稿のデータは自分では持たず、親の App.jsx から props で受け取る。
 * 保存・コメント・プロフィール表示などの操作も、App.jsx の関数を呼ぶだけで、
 * Supabaseとのやりとりはここでは行わない。
 *
 * 【ファイルの構成】
 *   1. import
 *   2. 小さな表示部品（Header / Stars）
 *   3. PostCard … 投稿1件分のカード
 *   4. Home     … ホーム画面本体（絞り込みと一覧）
 *
 * 【見た目】
 * クラス名のスタイルは Home.css（と共通の Common.css）で決めている。
 */

/* ───────────────────────────────────────────────────────────
 * 1. import
 * ─────────────────────────────────────────────────────────── */
import { useEffect, useMemo, useState } from "react";
import "./Home.css";
// LocationMap … 地図の表示部品
// ReverseLocationName … 座標から住所や場所名を表示する部品
// getCityName … 座標から市区町村名を取る関数
// getPostPosition … 投稿から地図用の座標を取り出す関数
import LocationMap, {
  ReverseLocationName,
  getCityName,
  getPostPosition,
} from "./LocationMap.jsx";

/* ───────────────────────────────────────────────────────────
 * 2. 小さな表示部品
 * ─────────────────────────────────────────────────────────── */

/*
 * 共通ヘッダー: 画面上部にタイトルと、右側のボタン（「＋ 投稿」）を表示する
 *   title  … 中央のタイトル
 *   right  … 右側に置く要素
 *   onBack … 渡すと左に戻るボタンを出す（ホームでは使わない）
 */
function Header({ title, right, onBack }) {
  return (
    <header className="topbar">
      {onBack ? (
        <button className="icon-button back" onClick={onBack}>
          ‹
        </button>
      ) : (
        <div className="header-spacer" />
      )}
      <h1>{title}</h1>
      <div className="header-right">{right}</div>
    </header>
  );
}

/* 星表示: 投稿一覧では「⭐️ 4.5」のように、星と数値を1つの評価表示として出す */
function Stars({ value }) {
  return (
    <span className="stars" aria-label={`評価 ${value}`}>
      ⭐️ {value}
    </span>
  );
}

/* ───────────────────────────────────────────────────────────
 * 3. PostCard（投稿カード）
 * ─────────────────────────────────────────────────────────── */

/*
 * 投稿1件分のカード
 *   post        … 表示する投稿
 *   onSave      … 📁を押したとき、投稿IDを渡して呼ぶ（保存状態の切り替え）
 *   onComment   … コメントを送るとき、投稿IDと本文を渡して呼ぶ
 *   onProfile   … 投稿者の名前を押したとき、投稿を渡して呼ぶ（プロフィールを開く）
 *   onMap       … 受け取っているが、このカードでは使っていない（地図はカード内に表示する）
 *   accountName … 自分の表示名。自分のコメントを右側に出すために使う
 *
 * カードの下半分（post-detail）は、状態 activeAction で表示を切り替える。
 *   "photo"   … 投稿の本文（初期状態）
 *   "comment" … コメント一覧と入力欄（💬を押す）
 *   "map"     … 場所の地図（📍を押す）
 * 同じボタンをもう一度押すと、本文の表示に戻る。
 */
function PostCard({ post, onSave, onComment, onProfile, onMap, accountName }) {
  const [expanded, setExpanded] = useState(false); // 本文を全文表示しているか
  const [activeAction, setActiveAction] = useState("photo"); // 今の表示（上の説明）
  const [comment, setComment] = useState(""); // 入力中のコメント

  // コメントの「送信」を押したときの処理
  const addComment = (event) => {
    event.preventEvent?.(); // （存在しないメソッドを安全に呼ぶ形のため、実際には何も起きない）
    // フォーム送信によるページの再読み込みを止める
    event.preventDefault();
    // 空白だけのコメントは送らない
    if (!comment.trim()) return;
    onComment(post.id, comment.trim());
    setComment("");
  };

  return (
    <article className="post-card">
      {/* ── 上部: 投稿者（アイコンと名前）と星評価 ── */}
      <div className="post-author">
        {/* 名前を押すと、投稿者のプロフィールのモーダルが開く */}
        <button className="author-button" onClick={() => onProfile(post)}>
          <span className="avatar">{post.avatar}</span>
          <b>{post.name}</b>
        </button>
        <Stars value={post.rating} />
      </div>

      {/* ── 写真 ── */}
      <div className="post-photo">
        <img src={post.image} alt={post.location || "投稿写真"} />
      </div>

      {/* ── アクションバー: 💬 コメント / 📍 地図 / 📁 保存 ── */}
      <div className="post-actions">
        {/* 💬: コメント欄の表示と非表示を切り替える。数字はコメントの件数 */}
        <button
          className={`post-action-button ${activeAction === "comment" ? "active-action" : ""}`}
          aria-label="コメント"
          onClick={() =>
            setActiveAction((current) =>
              current === "comment" ? "photo" : "comment",
            )
          }
        >
          <span>💬</span>
          <small>{post.comments.length}</small>
        </button>
        {/* 📍: 地図の表示と非表示を切り替える */}
        <button
          className={`post-action-button ${activeAction === "map" ? "active-action" : ""}`}
          aria-label="場所を確認"
          onClick={() =>
            setActiveAction((current) => (current === "map" ? "photo" : "map"))
          }
        >
          <span>📍</span>
        </button>
        {/* 📁: 保存と保存解除を切り替える。保存済みなら色が付く */}
        <button
          className={`post-action-button ${post.saved ? "saved-action" : ""}`}
          aria-label="保存"
          onClick={() => onSave(post.id)}
        >
          <span className={post.saved ? "saved" : ""}>📁</span>
        </button>
      </div>

      {/* ── 下部: activeAction に応じて、本文・コメント・地図のどれかを表示する ── */}
      <div className="post-detail">
        {/* 本文。通常は2行までで省略し、45文字を超えるときだけ「全文を読む」を出す */}
        {activeAction === "photo" && (
          <>
            <p
              className={expanded ? "photo-comment expanded" : "photo-comment"}
            >
              {post.comment}
            </p>
            {post.comment && post.comment.length > 45 && (
              <button
                className="read-more"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? "閉じる" : "全文を読む"}
              </button>
            )}
          </>
        )}

        {/* コメント欄。自分のコメントは右（mine）、他の人のコメントは左（other） */}
        {activeAction === "comment" && (
          <div className="comments-panel">
            {post.comments.map((item, index) => {
              const isMine = item.name === accountName;
              return (
                <div
                  className={`chat-row ${isMine ? "mine" : "other"}`}
                  key={`${item.name}-${index}`}
                >
                  {/* アイコンには、コメントした人の名前の1文字目を出す */}
                  <span className="chat-avatar">{item.name[0]}</span>
                  <div className="chat-bubble">
                    <b>{item.name}</b>
                    <span>{item.text}</span>
                  </div>
                </div>
              );
            })}
            {post.comments.length === 0 && (
              <p className="no-comments">まだコメントはありません</p>
            )}
            {/* コメントの入力欄 */}
            <form className="comment-form" onSubmit={addComment}>
              <input
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="コメントを書く"
              />
              <button>送信</button>
            </form>
          </div>
        )}

        {/* 地図。店名（または住所）と、ピンを立てた地図をカードの中に表示する */}
        {activeAction === "map" && (
          <div className="inline-place">
            <b>
              <ReverseLocationName post={post} />
            </b>
            <LocationMap post={post} className="inline-location-map" />
          </div>
        )}
      </div>
    </article>
  );
}

/* ───────────────────────────────────────────────────────────
 * 4. Home（ホーム画面本体）
 * ─────────────────────────────────────────────────────────── */

/*
 * ホーム画面: 星・人・市で投稿を絞り込み、投稿一覧を表示する
 *   posts       … 見える投稿の一覧（App.jsx が Supabase から読み込んだもの）
 *   onSave など … 操作用の関数。PostCard へそのまま渡す
 *   onCreate    … 「＋ 投稿」ボタンを押したとき、投稿作成画面へ進む
 *   accountName … 自分の表示名
 */
export default function Home({
  posts,
  onSave,
  onComment,
  onProfile,
  onMap,
  onCreate,
  accountName,
}) {
  // 絞り込みの選択状態。"all" は「絞り込まない」
  const [ratingFilter, setRatingFilter] = useState("all");
  const [peopleFilter, setPeopleFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  // 投稿IDごとの市区町村名。例: { "投稿ID": "渋谷区" }
  const [cityByPost, setCityByPost] = useState({});

  // 「人」の選択肢: 投稿に出てくる表示名を重複なしで並べる（先頭は「すべての人」）
  // posts が変わったときだけ作り直す（useMemo）
  const people = useMemo(
    () => ["all", ...new Set(posts.map((post) => post.name))],
    [posts],
  );

  // 各投稿の市区町村名を調べて、cityByPost に入れる
  //   ・投稿にすでに city があれば、それを使う
  //   ・なければ、位置情報の座標から市区町村名を取得する（通信が発生する）
  //   ・座標もなければ「市区町村未設定」にする
  useEffect(() => {
    // 調べている途中で posts が変わったり画面が閉じたりしたとき、古い結果を捨てるための印
    let cancelled = false;
    Promise.all(
      posts.map(async (post) => {
        if (post.city) return [post.id, post.city];
        const position = getPostPosition(post);
        const city = position ? await getCityName(position) : "";
        return [post.id, city || "市区町村未設定"];
      }),
    ).then((entries) => {
      if (!cancelled) setCityByPost(Object.fromEntries(entries));
    });
    // この処理が不要になったとき（再実行や画面を閉じたとき）に呼ばれる後片付け
    return () => {
      cancelled = true;
    };
  }, [posts]);

  // 「市」の選択肢: 調べ終わった市区町村名を重複なしで並べる（先頭は「すべての市」）
  const locations = useMemo(
    () => [
      "all",
      ...new Set(posts.map((post) => cityByPost[post.id]).filter(Boolean)),
    ],
    [posts, cityByPost],
  );

  // 3つの条件をすべて満たす投稿だけを残す（"all" の条件は、常に通過する）
  const filtered = posts.filter(
    (post) =>
      (ratingFilter === "all" || post.rating === Number(ratingFilter)) &&
      (peopleFilter === "all" || post.name === peopleFilter) &&
      (locationFilter === "all" || cityByPost[post.id] === locationFilter),
  );

  return (
    <main className="home-screen">
      <Header
        title="もぐろぐ"
        right={
          <button className="create-button" onClick={onCreate}>
            ＋ 投稿
          </button>
        }
      />

      {/* ── 絞り込み欄: 星評価 / 人 / 市 ── */}
      <div className="filters">
        {/* 星評価: 5から0まで0.5刻み。「0 ★」の投稿も絞り込める */}
        <select
          value={ratingFilter}
          onChange={(event) => setRatingFilter(event.target.value)}
          aria-label="星評価で絞り込み"
        >
          <option value="all">すべての星</option>
          {[5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5, 0].map((rating) => (
            <option key={rating} value={rating}>
              {rating === 0 ? "0 ★" : `${rating} ★`}
            </option>
          ))}
        </select>
        {/* 人: 投稿に出てくる表示名 */}
        <select
          value={peopleFilter}
          onChange={(event) => setPeopleFilter(event.target.value)}
          aria-label="人で絞り込み"
        >
          {people.map((person) => (
            <option key={person} value={person}>
              {person === "all" ? "すべての人" : person}
            </option>
          ))}
        </select>
        {/* 市: 投稿の市区町村名 */}
        <select
          value={locationFilter}
          onChange={(event) => setLocationFilter(event.target.value)}
          aria-label="場所で絞り込み"
        >
          {locations.map((location) => (
            <option key={location} value={location}>
              {location === "all" ? "すべての市" : location}
            </option>
          ))}
        </select>
      </div>

      {/* ── 投稿一覧: 絞り込んだ投稿を、カードとして縦に並べる ── */}
      <div className="feed-grid">
        {filtered.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onSave={onSave}
            onComment={onComment}
            onProfile={onProfile}
            onMap={onMap}
            accountName={accountName}
          />
        ))}
      </div>
    </main>
  );
}