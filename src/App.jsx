import { useEffect, useMemo, useRef, useState } from "react";
import exifr from "exifr";
import "./Common.css";
import LocationMap, { ReverseLocationName, getCityName } from "./LocationMap.jsx";
import { heicTo } from "heic-to";
import Home from "./Home.jsx";
import MyPage, { SocialListModal } from "./MyPage.jsx";

/* ── 初期データ ─────────────────────────────────────────── */
const seedPosts = [
  {
    id: "p1",
    userId: "MG-2048",
    name: "はるこ",
    avatar: "は",
    rating: 4.5,
    image:
      "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=900&h=900&fit=crop",
    location: "とんかつ みずき",
    comment:
      "だしが効いた塩ラーメンがとてもおいしい！スープまで飲み干したくなる優しい味でした。お店の方も穏やかで、ひと休みにぴったりです。",
    likes: 18,
    comments: [{ name: "みお", text: "行ってみたいです！" }],
    saved: false,
    pin: { x: 62, y: 44 },
  },
  {
    id: "p2",
    userId: "MG-3157",
    name: "たけし",
    avatar: "た",
    rating: 5,
    image:
      "https://images.unsplash.com/photo-1555126634-323283e090fa?w=900&h=900&fit=crop",
    location: "麺屋 そら",
    comment: "香ばしいチャーシューと、濃いめのスープが最高。",
    likes: 31,
    comments: [],
    saved: false,
    pin: { x: 48, y: 57 },
  },
  {
    id: "p3",
    userId: "MG-4821",
    name: "みお",
    avatar: "み",
    rating: 3.5,
    image:
      "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=900&h=900&fit=crop",
    location: "パン屋 あお",
    comment:
      "クロワッサンが外はサクサク、中はふんわり。コーヒーとの相性もよかったです。",
    likes: 12,
    comments: [
      { name: "はるこ", text: "今度行きます☕" },
      { name: "たけし", text: "おいしそう!" },
    ],
    saved: true,
    pin: { x: 38, y: 35 },
  },
  {
    id: "p4",
    userId: "MG-5532",
    name: "ゆう",
    avatar: "ゆ",
    rating: 4,
    image:
      "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=900&h=900&fit=crop",
    location: "フルーツカフェ",
    comment:
      "季節の果物をたっぷり使ったケーキ。甘さ控えめで食べやすかったです。",
    likes: 27,
    comments: [],
    saved: false,
    pin: { x: 71, y: 68 },
  },
];

/*
 * seedPosts（サンプル投稿一覧）
 * ローカルストレージに投稿がないときだけ最初に表示する初期データ。
 * id: 投稿を一意に識別し、削除・保存・コメントの対象にする。
 * userId: 投稿者のユーザーID。マイページの「自分の投稿」を絞り込む際に使う。
 * name/avatar: 表示名とアイコンの一文字目。
 * rating: 0〜5の評価。投稿一覧では⭐️ 数値として表示する。
 * image: 写真のURLまたはアップロード写真のdata URL。
 * location: 店名や場所名。
 * comment: 投稿者本文。長い場合は省略表示し、必要に応じて全文を展開する。
 * comments: 他ユーザーの{name, text}形式コメント配列。
 * saved: 保存済みかどうか。マイページの保存一覧へ反映する。
 * pin: 地図上のピン位置を横・縦の割合で保持する。
 */

/* コンポーネント: 星評価を「⭐️ 数値」で統一表示する */
function Stars({ value, size = "normal" }) {
  return (
    <span className={`stars ${size}`} aria-label={`評価 ${value}`}>
      ⭐️ {value}
    </span>
  );
}

/* コンポーネント: 画面上部の共通ヘッダー */
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

/* ログインと新規登録を切り替える画面 */
function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");

  const submit = (event) => {
    event.preventDefault();
    setError("");
    const accounts = JSON.parse(
      localStorage.getItem("moglog_accounts") || "[]",
    );

    if (mode === "register") {
      if (!name.trim() || !password.trim())
        return setError("表示名とパスワードを入力してください");
      let id;
      do {
        id = `MG-${Math.floor(1000 + Math.random() * 9000)}`;
      } while (accounts.some((item) => item.userId === id));
      const account = {
        userId: id,
        name: name.trim(),
        password,
        profile: null,
      };
      accounts.push(account);
      localStorage.setItem("moglog_accounts", JSON.stringify(accounts));
      onLogin(account);
      return;
    }

    const account = accounts.find(
      (item) => item.userId === userId.trim() && item.password === password,
    );
    if (account) onLogin(account);
    else setError("ユーザーIDまたはパスワードが違います");
  };

  return (
    <main className="auth-screen">
      <div className="brand-mark">
        <span>もぐ</span>
        <span>ろぐ</span>
      </div>
      <h1 className="brand-name">もぐろぐ</h1>
      <p className="tagline">おいしいを記録しよう</p>
      <form className="auth-card" onSubmit={submit}>
        {mode === "register" ? (
          <>
            <label>
              表示名
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例：はるこ"
              />
            </label>
            <label>
              パスワード
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="好きなパスワード"
              />
            </label>
          </>
        ) : (
          <>
            <label>
              ユーザーID
              <input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="MG-1234"
              />
            </label>
            <label>
              パスワード
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワード"
              />
            </label>
          </>
        )}
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" type="submit">
          {mode === "register" ? "はじめる" : "ログイン"}
        </button>
        <button
          className="text-button"
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError("");
          }}
        >
          {mode === "login" ? "初めての方はこちら" : "すでにアカウントがある方"}
        </button>
      </form>
    </main>
  );
}

/* 初回ログイン時の好み設定。濃さは薄味・普通・濃い味の3段階 */
function ProfileSetup({ account, onSave }) {
  const [foods, setFoods] = useState(account.profile?.favoriteFoods || "");
  const [preferences, setPreferences] = useState(
    account.profile
      ? {
          辛さ: account.profile["辛さ"] ?? 2,
          甘さ: account.profile["甘さ"] ?? 2,
          濃さ: account.profile["濃さ"] ?? 1,
        }
      : { 辛さ: 2, 甘さ: 2, 濃さ: 1 },
  );
  const save = () => onSave({ favoriteFoods: foods, ...preferences });

  return (
    <main className="setup-screen">
      <div className="setup-illustration">🍽️</div>
      <h1>あなたの好みは？？</h1>
      <p className="setup-subtitle">あなたの投稿が他の人の参考になりやすくなります。</p>
      <section className="profile-form">
        <label>
          好きな食べ物 <span>任意</span>
          <input
            value={foods}
            onChange={(e) => setFoods(e.target.value)}
            placeholder="例：ラーメン"
          />
        </label>
        {["辛さ", "甘さ", "濃さ"].map((key) => (
          <div className="scale-row" key={key}>
            <b>{key}の好み</b>
            <div
              className={
                key === "濃さ"
                  ? "scale-options strength-options"
                  : "scale-options"
              }
            >
              {(key === "濃さ" ? [0, 1, 2, 3, 4] : [0, 1, 2, 3, 4]).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={preferences[key] === value ? "selected" : ""}
                  onClick={() =>
                    setPreferences((old) => ({ ...old, [key]: value }))
                  }
                >
                  <span>
                    {key === "濃さ"
                      ? ["薄味", "やや薄", "普通", "やや濃い", "濃い味"][value]
                      : ["苦手", "やや苦手", "普通", "やや好き", "好き"][value]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
        <button className="primary-button" onClick={save}>
          保存して完了
        </button>
      </section>
    </main>
  );
}

/* 投稿カード。コメントは投稿者のコメントと、他の人のコメントの両方を表示する */
function LegacyPostCard({
  post,
  onSave,
  onComment,
  onProfile,
  onMap,
  accountName,
}) {
  const [expanded, setExpanded] = useState(false);
  const [activeAction, setActiveAction] = useState("photo");
  const [comment, setComment] = useState("");

  const addComment = (event) => {
    event.preventDefault();
    if (!comment.trim()) return;
    onComment(post.id, comment.trim());
    setComment("");
  };

  const selectComment = () =>
    setActiveAction((current) => (current === "comment" ? "photo" : "comment"));
  const selectLocation = () =>
    setActiveAction((current) => (current === "map" ? "photo" : "map"));

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
          onClick={selectComment}
        >
          <span>💬</span>
          <small>{post.comments.length}</small>
        </button>
        <button
          className={`post-action-button ${activeAction === "map" ? "active-action" : ""}`}
          aria-label="場所を確認"
          onClick={selectLocation}
        >
          <span>📍</span>
        </button>
        <button
          className="post-action-button"
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
                  <span className="chat-avatar">⚪</span>
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
                onChange={(e) => setComment(e.target.value)}
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

/* ホーム画面。星評価は0を含めて絞り込む */
function LegacyHome({
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
          onChange={(e) => setRatingFilter(e.target.value)}
          aria-label="星評価で絞り込み"
        >
          <option value="all">すべての星</option>
          {[5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5, 0].map((n) => (
            <option key={n} value={n}>
              {n === 0 ? "0 ★" : `${n} ★`}
            </option>
          ))}
        </select>
        <select
          value={peopleFilter}
          onChange={(e) => setPeopleFilter(e.target.value)}
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

/* 投稿作成画面。スマホの写真選択に対応し、場所は店名で入力する */
function CreatePost({ account, onCancel, onCreate }) {
  const [image, setImage] = useState("");
  const [location, setLocation] = useState("");
  const [city, setCity] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [gps, setGps] = useState(null);
  const [pin, setPin] = useState(null);
  const [locationStatus, setLocationStatus] = useState("写真を選ぶと位置情報を確認できます");

  const selectPosition = async (position) => {
    setPin(position);
    setGps(position);
    setLocationStatus("位置情報が設定されています。ピンをドラッグして調整できます。");
    setCity(await getCityName(position));
  };

  const chooseImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const position = await exifr.gps(file);
      if (position?.latitude != null && position?.longitude != null) {
        const photoPosition = { latitude: position.latitude, longitude: position.longitude };
        setGps(photoPosition);
        setPin(photoPosition);
        setCity(await getCityName(photoPosition));
        setLocationStatus("写真から位置情報を取得しました。ピンをドラッグして調整できます。");
      } else {
        setGps(null);
        setPin(null);
        setCity("");
        setLocationStatus("この写真には位置情報がありません。地図をタップしてピンを設定できます。");
      }
    } catch {
      setGps(null);
      setPin(null);
      setCity("");
      setLocationStatus("位置情報を読み取れませんでした。地図をタップしてピンを設定できます。");
    }

    let uploadFile = file;

    const isHeic =
      /\.hei(c|f)$/i.test(file.name) ||
      file.type === "image/heic" ||
      file.type === "image/heif";

    // HEICをJPEGに変換
    if (isHeic) {
      try {
        uploadFile = await heicTo({
          blob: file,
          type: "image/jpeg",
          quality: 0.92,
        });
      } catch {
        alert(
          "HEIC写真をJPEGに変換できませんでした。JPEG形式でアップロードしてください。",
        );
        return;
      }
    }

    // 写真を読み込む
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement("canvas");

        // 最大サイズを1200pxにする
        const maxSize = 1200;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));

        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // JPEG形式に圧縮
        const compressedImage = canvas.toDataURL("image/jpeg", 0.7);

        setImage(compressedImage);
      };

      img.src = reader.result;
    };

    reader.readAsDataURL(uploadFile);
  };

  const submit = () => {
    if (!image) return;
    onCreate({
      id: `p-${Date.now()}`,
      userId: account.userId,
      name: account.name,
      avatar: account.name[0] || "も",
      rating,
      image,
      location: location || "場所未設定",
      comment,
      comments: [],
      saved: false,
      gps,
      pin,
      city,
    });
  };

  return (
    <main className="create-screen">
      <Header title="投稿作成" onBack={onCancel} />
      <section className="create-form">
        <label className="photo-picker">
          {image ? (
            <img src={image} alt="選択した写真" />
          ) : (
            <>
              <span>📷</span>
              <b>写真を選ぶ</b>
            </>
          )}
          <input
            type="file"
            accept="image/*,.heic,.heif"
            onChange={chooseImage}
          />
        </label>
        <label>
          店名（任意）
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="例：俺の生きる道"
          />
        </label>
        <label>
          市区町村（任意）
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="例：渋谷区"
          />
        </label>
        <div className="location-picker">
          <b>位置情報</b>
          <p className="location-message">{locationStatus}</p>
          {gps && (
            <>
              <small className="gps-coordinate">
                緯度 {gps.latitude.toFixed(6)} / 経度 {gps.longitude.toFixed(6)}
              </small>
              <small className="reverse-address">
                <ReverseLocationName
                  post={{ location, gps }}
                  position={pin}
                  fallback="住所を取得中..."
                />
              </small>
            </>
          )}
          <div className="leaflet-location-map" aria-label="地図上のピン。タップまたはドラッグで位置を変更できます">
            <LocationMap
              position={pin}
              editable
              onPositionChange={selectPosition}
              className="create-location-map"
            />
          </div>
        </div>
        <div className="rating-picker">
          <b>評価</b>
          <p>0~5まで0.5刻みで選択</p>
          <div
            className="rating-line"
            aria-label="評価を0から5まで0.5刻みで選択"
          >
            {[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((n) => (
              <button
                type="button"
                key={n}
                className={`rating-dot ${n % 1 === 0 ? "integer" : "half"} ${n <= rating ? "selected" : ""}`}
                onClick={() => setRating(n)}
                aria-label={`${n}`}
              >
                <span />
              </button>
            ))}
          </div>
          <div className="rating-scale">
            <span></span>
            <strong>⭐️{rating} / 5</strong>
            <span></span>
          </div>
        </div>
        <label>
          コメント(任意)
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows="5"
            placeholder="みんなに感想を伝えましょう。"
          />
        </label>
        <button className="create-submit-button" onClick={submit}>投稿する</button>
      </section>
    </main>
  );
}

/* プロフィール詳細。友達のユーザーIDは表示しない */
function ProfileModal({ post, onClose }) {
  const profile = post.profile || {
    favoriteFoods: "ラーメン・スイーツ",
    辛さ: 2,
    甘さ: 3,
    濃さ: 1,
  };
  const preferenceLabels = {
    辛さ: ["苦手", "やや苦手", "普通", "やや好き", "好き"],
    甘さ: ["苦手", "やや苦手", "普通", "やや好き", "好き"],
    濃さ: ["薄味", "やや薄味", "普通", "やや濃い味", "濃い味"],
  };
  return (
    <div className="overlay" onClick={onClose}>
      <section className="profile-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ×
        </button>
        <span className="large-avatar">{post.avatar}</span>
        <h2>{post.name}</h2>
        <h3>好きな食べ物</h3>
        <p>{profile.favoriteFoods || "未設定"}</p>
        <div className="profile-preference-grid">
          {["辛さ", "甘さ", "濃さ"].map((key) => (
            <div key={key}>
              <b>{key}</b>
              <span>{preferenceLabels[key][profile[key] ?? 2]}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function MapModal({ post, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <section className="map-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ×
        </button>
        <h2><ReverseLocationName post={post} /></h2>
        <LocationMap post={post} className="big-location-map" />
      </section>
    </div>
  );
}

/* 保存投稿詳細。保存した投稿をタップすると内容全体を確認できる */
function SavedPostModal({ post, onClose, onComment, accountName, onSave }) {
  const [activeAction, setActiveAction] = useState("photo");
  const [comment, setComment] = useState("");
  const addComment = (event) => {
    event.preventDefault();
    if (!comment.trim()) return;
    onComment(post.id, comment.trim());
    setComment("");
  };

  return (
    <div className="overlay" onClick={onClose}>
      <section
        className={`saved-detail-modal`}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          ×
        </button>
        <img src={post.image} alt={post.location} />
        <div className="saved-detail-copy">
          <b>{post.name}</b>
          <Stars value={post.rating} />
          <h3><ReverseLocationName post={post} /></h3>
          {activeAction === "photo" && (
            <p className="saved-photo-comment">
              {post.comment || "コメントはありません"}
            </p>
          )}
          {activeAction === "comment" && (
            <div className="comments-panel">
              {post.comments.map((item, index) => {
                const isMine = item.name === accountName;
                return (
                  <div
                    className={`chat-row ${isMine ? "mine" : "other"}`}
                    key={index}
                  >
                    <span className="chat-avatar">⚪</span>
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
        <div className="saved-actions">
          <button
            className={activeAction === "comment" ? "active-action" : ""}
            onClick={() =>
              setActiveAction((current) =>
                current === "comment" ? "photo" : "comment",
              )
            }
          >
            💬
          </button>
          <button
            className={activeAction === "map" ? "active-action" : ""}
            onClick={() =>
              setActiveAction((current) =>
                current === "map" ? "photo" : "map",
              )
            }
          >
            📍
          </button>
          <button className={post.saved ? "active-save-action" : ""} onClick={() => onSave(post.id)} aria-label="保存">📁</button>
        </div>
      </section>
    </div>
  );
}

function LegacySocialListModal({ type, onClose, onAddFriend }) {
  const [friendId, setFriendId] = useState("");
  const [message, setMessage] = useState("");
  const follows = [
    "はるこ",
    "たけし",
    "みお",
    "ゆう",
    "さくら",
    "けん",
    "あや",
    "りく",
    "なお",
    "めぐ",
    "つばさ",
    "ひなた",
  ];
  const followers = [
    "みお",
    "ゆう",
    "さくら",
    "けん",
    "あおい",
    "そら",
    "りん",
    "かなた",
    "ゆな",
    "れん",
    "まこ",
    "はる",
    "のん",
    "こう",
    "みさ",
    "たいき",
    "えみ",
    "じゅん",
  ];
  const people = type === "follow" ? follows : followers;

  const addFriend = (event) => {
    event.preventDefault();
    const accounts = JSON.parse(
      localStorage.getItem("moglog_accounts") || "[]",
    );
    const found = accounts.find((item) => item.userId === friendId.trim());
    if (!friendId.trim()) setMessage("友達のユーザーIDを入力してください");
    else if (!found) setMessage("そのユーザーIDが見つかりません");
    else {
      onAddFriend(found);
      setMessage(`${found.name}さんを友達に追加しました`);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <section
        className="social-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          ×
        </button>
        <h2>{type === "follow" ? "フォロー" : "フォロワー"}</h2>
        {type === "follow" && (
          <form className="friend-search" onSubmit={addFriend}>
            <input
              value={friendId}
              onChange={(event) => setFriendId(event.target.value)}
              placeholder="友達のユーザーIDを検索"
            />
            <button>友達追加</button>
          </form>
        )}
        {message && <p className="friend-message">{message}</p>}
        <div className="social-list">
          {people.map((name) => (
            <button key={name}>
              <span className="small-avatar">{name[0]}</span>
              <b>{name}</b>
              {type === "follow" && <small>フォロー中</small>}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function LegacyMyPage({
  account,
  posts,
  onEditProfile,
  onOpenSavedPost,
  onOpenOwnPost,
  onCopyId,
  onSocial,
  onUpdateName,
  onEditPreferences,
  onDeletePost,
  onLogout,
}) {
  const saved = posts.filter((post) => post.saved);
  const ownPosts = posts.filter((post) => post.userId === account.userId);
  const profile = account.profile;
  const copyId = async () => {
    try {
      await navigator.clipboard?.writeText(account.userId);
    } catch {
      /* コピーAPI未対応時も完了表示を出す */
    }
    onCopyId();
  };
  return (
    <main className="mypage-screen">
      <Header title="マイページ" />
      <section className="my-profile">
        <span className="large-avatar">{account.name[0]}</span>
        <div>
          <h2>{account.name}</h2>
          <button className="copy-id" onClick={copyId}>
            {account.userId} <span>コピー</span>
          </button>
        </div>
        <button className="edit-profile" onClick={onEditProfile}>
          プロフィール編集
        </button>
      </section>
      {profile && (
        <section className="preference-summary">
          <h3>私の好み</h3>
          <p>
            <b>好きな食べ物</b>
            <span>{profile.favoriteFoods || "未設定"}</span>
          </p>
          {["辛さ", "甘さ", "濃さ"].map((key) => (
            <p key={key}>
              <b>{key}</b>
              <span>
                {key === "濃さ"
                  ? ["薄味", "普通", "濃い味"][profile[key] ?? 1]
                  : ["苦手", "やや苦手", "普通", "やや好き", "好き"][
                      profile[key]
                    ]}
              </span>
            </p>
          ))}
        </section>
      )}
      <section className="social-counts">
        <button onClick={() => onSocial("follow")}>
          <strong>15</strong>
          <span>フォロー</span>
        </button>
        <button onClick={() => onSocial("follower")}>
          <strong>15</strong>
          <span>フォロワー</span>
        </button>
        <button
          onClick={() =>
            document
              .querySelector(".saved-posts")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        >
          <strong>{saved.length}</strong>
          <span>保存</span>
        </button>
      </section>
      <section className="own-posts">
        <h3>
          自分の投稿 <span>{ownPosts.length}</span>
        </h3>
        <div>
          {ownPosts.length ? (
            ownPosts.map((post) => (
              <button key={post.id} onClick={() => onOpenOwnPost(post)}>
                <img src={post.image} alt={`${post.location}の投稿`} />
              </button>
            ))
          ) : (
            <p className="empty">投稿はまだありません</p>
          )}
        </div>
      </section>
      <section className="saved-posts">
        <h3>
          保存した投稿 <span>{saved.length}</span>
        </h3>
        <div>
          {saved.length ? (
            saved.map((post) => (
              <button key={post.id} onClick={() => onOpenSavedPost(post)}>
                <img src={post.image} alt={`${post.location}の保存投稿`} />
              </button>
            ))
          ) : (
            <p className="empty">保存した投稿はまだありません</p>
          )}
        </div>
      </section>
    </main>
  );
}

function App() {
  const [account, setAccount] = useState(() =>
    JSON.parse(localStorage.getItem("moglog_current") || "null"),
  );
  const [screen, setScreen] = useState(
    account ? (account.profile ? "home" : "setup") : "auth",
  );
  const [tab, setTab] = useState("home");
  const [posts, setPosts] = useState(
    () =>
      JSON.parse(localStorage.getItem("moglog_posts") || "null") || seedPosts,
  );
  const [modalPost, setModalPost] = useState(null);
  const [mapPost, setMapPost] = useState(null);
  const [savedPost, setSavedPost] = useState(null);
  const [socialType, setSocialType] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(
    () => localStorage.setItem("moglog_posts", JSON.stringify(posts)),
    [posts],
  );

  const login = (nextAccount) => {
    setAccount(nextAccount);
    localStorage.setItem("moglog_current", JSON.stringify(nextAccount));
    setScreen(nextAccount.profile ? "home" : "setup");
  };
  const saveProfile = (profile) => {
    const next = { ...account, profile };
    setAccount(next);
    localStorage.setItem("moglog_current", JSON.stringify(next));
    const accounts = JSON.parse(
      localStorage.getItem("moglog_accounts") || "[]",
    ).map((item) => (item.userId === next.userId ? next : item));
    localStorage.setItem("moglog_accounts", JSON.stringify(accounts));
    setScreen("home");
  };
  const updateName = (name) => {
    const next = { ...account, name };
    setAccount(next);
    localStorage.setItem("moglog_current", JSON.stringify(next));
    const accounts = JSON.parse(localStorage.getItem("moglog_accounts") || "[]").map((item) => item.userId === next.userId ? next : item);
    localStorage.setItem("moglog_accounts", JSON.stringify(accounts));
  };
  const toggleSave = (id) => {
    // toggleSave：対象投稿のsavedだけ反転し、配列全体を新しくして再描画させる。
    setPosts((old) =>
      old.map((post) =>
        post.id === id ? { ...post, saved: !post.saved } : post,
      ),
    );
  };
  const addComment = (id, text) =>
    setPosts((old) =>
      old.map((post) =>
        post.id === id
          ? {
              ...post,
              comments: [...post.comments, { name: account.name, text }],
            }
          : post,
      ),
    ); // addComment：対象投稿のcomments配列末尾へ現在ログインユーザー名と本文を追加する。
  const openProfile = (post) =>
    setModalPost(
      post.profile
        ? post
        : {
            ...post,
            profile:
              account.profile && post.userId === account.userId
                ? account.profile
                : post.profile,
          },
    );
  const createPost = (post) => {
    setPosts((old) => [{ ...post, profile: account.profile }, ...old]);
    setScreen("home");
    setTab("home");
  }; // createPost：新しい投稿オブジェクトを配列先頭へ追加し、ホーム画面へ戻る。
  const deletePost = (postId) => {
    setPosts((old) => old.filter((post) => post.id !== postId));
    setSavedPost(null);
  }; // deletePost：対象投稿ID以外だけを残して配列から削除し、保存詳細モーダルも閉じる。

  const logout = () => {
    localStorage.removeItem("moglog_current");
    setAccount(null);
    setTab("home");
    setScreen("auth");
  }; // logout：moglog_currentを削除し、アカウント状態とタブをリセットしてログイン画面へ戻す。

  /*
   * App（アプリ全体の親コンポーネント）
   * accountは現在ログイン中のユーザー。moglog_currentへ保存し、再読み込み時にログイン状態を復元する。
   * screenはログイン、好み設定、通常画面、投稿作成を切り替え、tabはホーム／マイページを切り替える。
   * postsは全投稿配列。moglog_postsへ保存し、コメント追加・保存切り替え・投稿削除で配列を更新する。
   * modalPost・savedPost・mapPost・socialTypeはそれぞれプロフィール・保存投稿・地図・フォロー一覧モーダルの対象を保持する。
   */

  // screenがauthならログイン画面、setupなら初回好み設定だけを表示する。
  if (screen === "auth") return <AuthScreen onLogin={login} />;
  if (screen === "setup") return <ProfileSetup account={account} onSave={saveProfile} />;

  // 通常画面では投稿作成・ホーム・マイページを同じapp-shell内へ描画し、下部ナビで切り替える。
  return (
    <div className="app-shell">
      {screen === "create" ? (
        <CreatePost account={account} onCancel={() => setScreen("home")} onCreate={createPost} />
      ) : tab === "home" ? (
        <Home posts={posts} onSave={toggleSave} onComment={addComment} onProfile={openProfile} onMap={setMapPost} onCreate={() => setScreen("create")} accountName={account?.name} />
      ) : (
        <MyPage account={account} posts={posts} onEditProfile={() => setScreen("setup")} onEditPreferences={() => setScreen("setup")} onUpdateName={updateName} onOpenSavedPost={setSavedPost} onOpenOwnPost={setSavedPost} onCopyId={() => { setToast("ユーザーIDをコピーしました"); setTimeout(() => setToast(""), 1800); }} onSocial={setSocialType} onDeletePost={deletePost} onLogout={logout} />
      )}

      {screen !== "create" && (
        <nav className="bottom-nav">
          <button className={tab === "home" ? "active" : ""} onClick={() => { setTab("home"); setScreen("home"); }}><span>⌂</span><small>ホーム</small></button>
          <button className={tab === "mypage" ? "active" : ""} onClick={() => { setTab("mypage"); setScreen("home"); }}><span>♙</span><small>マイページ</small></button>
        </nav>
      )}

      {modalPost && <ProfileModal post={modalPost} onClose={() => setModalPost(null)} />}
      {mapPost && <MapModal post={mapPost} onClose={() => setMapPost(null)} />}
      {savedPost && <SavedPostModal post={savedPost} onClose={() => setSavedPost(null)} onComment={addComment} accountName={account?.name} onSave={(id) => { const target = posts.find((post) => post.id === id); toggleSave(id); if (target?.saved) setSavedPost(null); }} />}
      {socialType && <SocialListModal type={socialType} onClose={() => setSocialType(null)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

export default App;
