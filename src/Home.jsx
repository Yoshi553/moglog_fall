import { useMemo, useState } from "react";
import "./Home.css";

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
            <b>{post.location}</b>
            <div className="inline-map">
              <span className="road r1" />
              <span className="road r2" />
              <span
                className="map-pin"
                style={{
                  left: `${post.pin?.x || 50}%`,
                  top: `${post.pin?.y || 50}%`,
                }}
              >
                📍
              </span>
            </div>
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
  const people = useMemo(
    () => ["all", ...new Set(posts.map((post) => post.name))],
    [posts],
  );
  const filtered = posts.filter(
    (post) =>
      (ratingFilter === "all" || post.rating === Number(ratingFilter)) &&
      (peopleFilter === "all" || post.name === peopleFilter),
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
