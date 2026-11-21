import { useEffect, useMemo, useState } from "react";
import "./Home.css";
import LocationMap, { ReverseLocationName, getCityName, getPostPosition } from "./LocationMap.jsx";

/* 共通ヘッダー: ホーム画面のタイトルと投稿ボタンを表示する */
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

/* 星表示: 投稿一覧では⭐️と数値を一つの評価表示として統一する */
function Stars({ value }) {
  return <span className="stars" aria-label={`評価 ${value}`}>⭐️ {value}</span>;
}

/*
 * PostCard（投稿カード表示）
 * expandedは投稿本文の全文表示、activeActionは本文・コメント・地図のどれを表示中か、commentは入力中テキストを保持する。
 * 💬を押すとコメント領域へ切り替え、自分のコメントはmine、他人のコメントはotherとして左右配置する。
 * 📍を押すとカード内の地図へ切り替え、📁は親へ投稿IDを渡して保存状態を反転させる。
 * 投稿本文は通常2行相当を省略し、45文字を超える場合だけ「全文を読む」を表示する。
 */

/* 投稿カード: 写真本文、コメント、地図、保存の切り替えを行う */
function PostCard({ post, onSave, onComment, onProfile, onMap, accountName }) {
  const [expanded, setExpanded] = useState(false);
  const [activeAction, setActiveAction] = useState("photo");
  const [comment, setComment] = useState("");

  const addComment = (event) => {
    event.preventEvent?.();
    event.preventDefault();
    if (!comment.trim()) return;
    onComment(post.id, comment.trim());
    setComment("");
  };

  return (
    <article className="post-card">
      <div className="post-author">
        <button className="author-button" onClick={() => onProfile(post)}>
          <span className="avatar">{post.avatar}</span>
          <b>{post.name}</b>
        </button>
        <Stars value={post.rating} />
      </div>

      <div className="post-photo">
        <img src={post.image} alt={post.location || "投稿写真"} />
      </div>

      <div className="post-actions">
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
        <button
          className={`post-action-button ${activeAction === "map" ? "active-action" : ""}`}
          aria-label="場所を確認"
          onClick={() =>
            setActiveAction((current) => (current === "map" ? "photo" : "map"))
          }
        >
          <span>📍</span>
        </button>
        <button
          className={`post-action-button ${post.saved ? "saved-action" : ""}`}
          aria-label="保存"
          onClick={() => onSave(post.id)}
        >
          <span className={post.saved ? "saved" : ""}>📁</span>
        </button>
      </div>

      <div className="post-detail">
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

        {activeAction === "comment" && (
          <div className="comments-panel">
            {post.comments.map((item, index) => {
              const isMine = item.name === accountName;
              return (
                <div
                  className={`chat-row ${isMine ? "mine" : "other"}`}
                  key={`${item.name}-${index}`}
                >
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

        {activeAction === "map" && (
          <div className="inline-place">
            <b><ReverseLocationName post={post} /></b>
            <LocationMap post={post} className="inline-location-map" />
          </div>
        )}
      </div>
    </article>
  );
}

/* ホーム画面: 星・表示名で投稿を絞り込み、投稿一覧を表示する */
export default function Home({
  posts,
  onSave,
  onComment,
  onProfile,
  onMap,
  onCreate,
  accountName,
}) {
  const [ratingFilter, setRatingFilter] = useState("all");
  const [peopleFilter, setPeopleFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [cityByPost, setCityByPost] = useState({});
  const people = useMemo(
    () => ["all", ...new Set(posts.map((post) => post.name))],
    [posts],
  );
  useEffect(() => {
    let cancelled = false;
    Promise.all(posts.map(async (post) => {
      if (post.city) return [post.id, post.city];
      const position = getPostPosition(post);
      const city = position ? await getCityName(position) : "";
      return [post.id, city || "市区町村未設定"];
    })).then((entries) => {
      if (!cancelled) setCityByPost(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
  }, [posts]);

  const locations = useMemo(
    () => ["all", ...new Set(posts.map((post) => cityByPost[post.id]).filter(Boolean))],
    [posts, cityByPost],
  );
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
      <div className="filters">
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
